#!/usr/bin/env python3
"""
Baixa legitimamente os PDFs oficiais públicos da prova objetiva de ingresso da PRF 2021
e do gabarito definitivo diretamente do CDN oficial do Cebraspe, calcula SHA-256
e extrai todos os 112 itens oficiais Certo/Errado (9 a 120) com PyMuPDF.
"""

import hashlib
import json
import re
import urllib.request
from pathlib import Path
import pymupdf as fitz

OUT_DIR = Path("acervo/prf_2021")
OUT_DIR.mkdir(parents=True, exist_ok=True)

EXAM_URL = "https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/578_PRF_001_01.PDF"
KEY_URL = "https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/GAB_DEFINITIVO_578_PRF_001_01.PDF"

EXAM_PDF = OUT_DIR / "578_PRF_001_01.PDF"
KEY_PDF = OUT_DIR / "GAB_DEFINITIVO_578_PRF_001_01.PDF"


def download_file(url: str, dest: Path) -> str:
    if not dest.exists():
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            dest.write_bytes(resp.read())
    return hashlib.sha256(dest.read_bytes()).hexdigest()


def parse_cebraspe_gabarito(pdf_path: Path) -> dict[int, str]:
    doc = fitz.open(str(pdf_path))
    full_text = "\n".join(page.get_text("text") for page in doc)
    doc.close()

    tokens = [l.strip() for l in full_text.splitlines() if l.strip()]
    mapping: dict[int, str] = {}

    i = 0
    while i < len(tokens):
        if tokens[i].isdigit() and int(tokens[i]) >= 9:
            nums: list[int] = []
            while i < len(tokens) and tokens[i].isdigit():
                val = int(tokens[i])
                if val > 0:
                    nums.append(val)
                i += 1
            ans_list: list[str] = []
            while i < len(tokens) and tokens[i].upper() in ("C", "E", "X"):
                ans_list.append(tokens[i].upper())
                i += 1
            if nums and ans_list:
                for num, ans in zip(nums, ans_list):
                    mapping[num] = "ANULADA" if ans == "X" else ans
                continue
        i += 1
    return mapping


def classify_prf_subject(num: int, text: str) -> str:
    lower = text.lower()
    if 56 <= num <= 85:
        if "crime" in lower or "pena" in lower or "embriaguez" in lower or "homicídio culposo" in lower:
            return "crimes-de-transito"
        return "normas-gerais-de-circulacao-e-conduta"
    if 9 <= num <= 20:
        return "interpretacao-e-compreensao-de-textos"
    if "constituição" in lower or "direito fundamental" in lower or "habeas" in lower or "segurança pública" in lower or "nacionalidade" in lower:
        return "direitos-e-garantias-fundamentais"
    if "administração pública" in lower or "ato administrativo" in lower or "servidor" in lower or "improbidade" in lower or "licitação" in lower or "responsabilidade civil do estado" in lower:
        return "atos-e-poderes-administrativos"
    if "inquérito" in lower or "flagrante" in lower or "processo penal" in lower or "prisão" in lower:
        return "inquerito-policial"
    if "crime" in lower or "pena" in lower or "dolo" in lower or "culpa" in lower or "peculato" in lower or "homicídio" in lower or "código penal" in lower:
        return "teoria-do-crime-e-imputabilidade"
    return "normas-gerais-de-circulacao-e-conduta"


def extract_prf_items(pdf_path: Path, answer_map: dict[int, str]) -> list[dict]:
    doc = fitz.open(str(pdf_path))
    column_chunks: list[tuple[int, str]] = []

    for p_idx in range(len(doc)):
        page = doc[p_idx]
        w, h = page.rect.width, page.rect.height
        left_rect = fitz.Rect(0, 48, w / 2, h - 25)
        right_rect = fitz.Rect(w / 2, 48, w, h - 25)
        for rect in (left_rect, right_rect):
            txt = page.get_text("text", clip=rect)
            if txt.strip():
                column_chunks.append((p_idx + 1, txt))
    doc.close()

    # Build a single ordered line list with page numbers
    ordered_lines: list[tuple[int, str]] = []
    for page_num, chunk in column_chunks:
        for raw_line in chunk.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if "CEBRASPE" in line and "PRF" in line:
                continue
            if line in ("BLOCO I", "BLOCO II", "BLOCO III", "ESPAÇO LIVRE"):
                continue
            ordered_lines.append((page_num, line))

    # Sequential scan for items 9..120 (exact ascending order prevents false matches on numbers inside text)
    expected_nums = sorted(answer_map.keys())
    items: list[dict] = []
    idx_line = 0
    current_context = ""

    # Find starting line for each expected item in order
    item_starts: list[tuple[int, int, int, str]] = []  # (num, line_idx, page_num, first_line_body)
    search_from = 0
    for target_num in expected_nums:
        pattern = re.compile(rf"^{target_num}\s+(.+)$")
        found = False
        for k in range(search_from, len(ordered_lines)):
            pnum, ltxt = ordered_lines[k]
            m = pattern.match(ltxt)
            if m:
                item_starts.append((target_num, k, pnum, m.group(1).strip()))
                search_from = k + 1
                found = True
                break
        if not found:
            # Also handle standalone number on a line followed by text on next line
            for k in range(search_from, len(ordered_lines) - 1):
                pnum, ltxt = ordered_lines[k]
                if ltxt == str(target_num):
                    item_starts.append((target_num, k, pnum, ordered_lines[k + 1][1].strip()))
                    search_from = k + 2
                    break

    # Extract full text of each item cleanly between item_starts[i] and item_starts[i+1],
    # stripping any next-group instruction ("Julgue os itens...", "Acerca...", "Considerando...", "Texto ...")
    group_header_re = re.compile(
        r"^(Texto\s+\w+|No que se refere|Considerando|Acerca|Com relação|Julgue|A respeito|Com base|Quanto|Em relação|Tendo em vista|A figura|Um\s+policial|Em\s+determinada|Determinado)"
    )

    for i, (num, start_idx, page_num, first_body) in enumerate(item_starts):
        end_idx = item_starts[i + 1][1] if i + 1 < len(item_starts) else len(ordered_lines)

        # Capture clean Cebraspe group instruction immediately preceding this item
        prev_end = item_starts[i - 1][1] + 1 if i > 0 else 0
        if start_idx > prev_end:
            between_lines = [ordered_lines[b][1] for b in range(prev_end, start_idx)]
            joined_between = " ".join(between_lines)
            instr_match = re.search(
                r"((?:No que se refere|Considerando|Acerca|Com relação|Julgue|A respeito|Com base|Quanto|Em relação|Tendo em vista)[^.]+(?:julgue os (?:próximos )?itens[^.]*\.|itens a seguir\.|itens que se seguem\.))",
                joined_between,
                re.IGNORECASE,
            )
            if instr_match:
                current_context = re.sub(r"\s+", " ", instr_match.group(1)).strip()

        body_parts = [first_body]
        for k in range(start_idx + 1, end_idx):
            ltxt = ordered_lines[k][1]
            # Stop appending to this item if the next group header starts
            if group_header_re.match(ltxt) and (
                "julgue" in " ".join(ordered_lines[m][1] for m in range(k, min(end_idx, k + 5))).lower()
                or ltxt.startswith("Texto ")
            ):
                break
            body_parts.append(ltxt)

        statement = re.sub(r"\s+", " ", " ".join(body_parts)).strip()
        ans = answer_map[num]
        items.append(
            {
                "originalNumber": num,
                "questionType": "TRUE_FALSE",
                "statement": statement,
                "supportText": current_context if current_context else None,
                "options": [
                    {"label": "C", "content": "Certo"},
                    {"label": "E", "content": "Errado"},
                ],
                "officialAnswer": ans,
                "isAnnulled": ans == "ANULADA",
                "subjectSlug": classify_prf_subject(num, statement),
                "pageNumber": page_num,
            }
        )

    return items


def main() -> None:
    exam_sha = download_file(EXAM_URL, EXAM_PDF)
    key_sha = download_file(KEY_URL, KEY_PDF)
    print(f"Exam PDF SHA-256: {exam_sha}")
    print(f"Answer Key PDF SHA-256: {key_sha}")

    answer_map = parse_cebraspe_gabarito(KEY_PDF)
    print(f"Parsed {len(answer_map)} official answers from Cebraspe Definitive Answer Key.")
    annulled = [k for k, v in answer_map.items() if v == "ANULADA"]
    print(f"Officially annulled items in PRF 2021 (9-120): {annulled}")

    extracted_items = extract_prf_items(EXAM_PDF, answer_map)
    print(f"Extracted {len(extracted_items)} structured items from official PRF 2021 PDF.")

    payload = {
        "editionCode": "PRF-2021-POLICIAL",
        "versionLabel": "Caderno Padrão",
        "examPdfSha256": exam_sha,
        "examPdfOfficialUrl": EXAM_URL,
        "answerKeySha256": key_sha,
        "answerKeyOfficialUrl": KEY_URL,
        "idempotencyKey": f"PRF-2021-POLICIAL::Caderno Padrão::{exam_sha[:16]}",
        "totalDetected": len(extracted_items),
        "extractedItems": extracted_items,
    }
    out_json = OUT_DIR / "import_prf2021_extracted.json"
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved extracted payload to {out_json}")


if __name__ == "__main__":
    main()
