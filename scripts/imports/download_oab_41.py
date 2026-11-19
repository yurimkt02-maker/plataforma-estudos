#!/usr/bin/env python3
"""
Baixa os PDFs oficiais públicos do 41º Exame de Ordem Unificado (FGV — 1ª Fase)
diretamente de oab.fgv.br/arq/644/, calcula SHA-256 e extrai todas as 80 questões
de múltipla escolha (A-D) + gabarito definitivo oficial (incluindo anuladas).
"""

import hashlib
import json
import re
import urllib.request
from pathlib import Path
import pymupdf as fitz

OUT_DIR = Path("acervo/oab_41")
OUT_DIR.mkdir(parents=True, exist_ok=True)

EXAM_URL = "https://oab.fgv.br/arq/644/552356_ADVOGADO%20OAB(CNS01)%20Tipo%201%20(1).pdf"
KEY_URL = "https://oab.fgv.br/arq/644/84844_oab242_gabarito_definitivo.pdf"

EXAM_PDF = OUT_DIR / "552356_OAB41_TIPO1_BRANCA.pdf"
KEY_PDF = OUT_DIR / "84844_OAB41_GABARITO_DEFINITIVO.pdf"


def download_file(url: str, dest: Path) -> str:
    if not dest.exists():
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            dest.write_bytes(resp.read())
    return hashlib.sha256(dest.read_bytes()).hexdigest()


def parse_oab_gabarito(pdf_path: Path) -> dict[int, str]:
    doc = fitz.open(str(pdf_path))
    full_text = "\n".join(page.get_text("text") for page in doc)
    doc.close()

    print("=== RAW OAB GABARITO TEXT (first 2500 chars) ===")
    print(full_text[:2500])

    # Parse Tipo 1 (Branca) section
    # Usually structured as blocks of question numbers followed by A/B/C/D/*
    # Let's isolate the Tipo 1 section before Tipo 2
    t1_match = re.search(r"Tipo\s*1(.*?)(?:Tipo\s*2|$)", full_text, flags=re.IGNORECASE | re.DOTALL)
    section = t1_match.group(1) if t1_match else full_text

    tokens = [t.strip() for t in re.split(r"[\s\n]+", section) if t.strip()]
    mapping: dict[int, str] = {}
    i = 0
    while i < len(tokens):
        if tokens[i].isdigit() and 1 <= int(tokens[i]) <= 80:
            nums: list[int] = []
            while i < len(tokens) and tokens[i].isdigit() and 1 <= int(tokens[i]) <= 80:
                nums.append(int(tokens[i]))
                i += 1
            ans: list[str] = []
            while i < len(tokens) and tokens[i].upper() in ("A", "B", "C", "D", "*", "ANULADA", "-"):
                val = tokens[i].upper()
                ans.append("ANULADA" if val in ("*", "ANULADA", "-") else val)
                i += 1
            if nums and ans:
                for n, a in zip(nums, ans):
                    mapping[n] = a
                continue
        i += 1
    return mapping


def classify_oab_subject(num: int) -> str:
    # Ordem oficial padronizada da FGV no Exame de Ordem Unificado (1 a 80):
    if 1 <= num <= 8:
        return "direitos-e-prerrogativas-do-advogado"
    if 9 <= num <= 10:
        return "direitos-e-garantias-fundamentais"
    if 11 <= num <= 16:
        return "direitos-e-garantias-fundamentais"
    if 17 <= num <= 21:
        return "direitos-e-garantias-fundamentais"
    if 22 <= num <= 26:
        return "atos-e-poderes-administrativos"
    if 27 <= num <= 33:
        return "atos-e-poderes-administrativos"
    if 34 <= num <= 44:
        return "direitos-e-garantias-fundamentais"
    if 45 <= num <= 57:
        return "juizados-especiais-civeis-e-fazenda-publica"
    if 58 <= num <= 63:
        return "teoria-do-crime-e-imputabilidade"
    if 64 <= num <= 69:
        return "inquerito-policial"
    return "direitos-e-garantias-fundamentais"


def extract_oab_questions(pdf_path: Path, answer_map: dict[int, str]) -> list[dict]:
    doc = fitz.open(str(pdf_path))
    column_chunks: list[tuple[int, str]] = []

    for p_idx in range(len(doc)):
        page = doc[p_idx]
        w, h = page.rect.width, page.rect.height
        # Skip cover page (page 0 usually instructions)
        txt_full = page.get_text("text")
        if p_idx == 0 and "1" not in txt_full and "Questão" not in txt_full:
            continue
        left_rect = fitz.Rect(0, 42, w / 2, h - 30)
        right_rect = fitz.Rect(w / 2, 42, w, h - 30)
        for rect in (left_rect, right_rect):
            txt = page.get_text("text", clip=rect)
            if txt.strip():
                column_chunks.append((p_idx + 1, txt))
    doc.close()

    ordered_lines: list[tuple[int, str]] = []
    for page_num, chunk in column_chunks:
        for raw_line in chunk.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if re.match(r"^(41º Exame de Ordem|ORDEM DOS ADVOGADOS|Tipo 1|Branca|FGV|Página \d+)$", line, re.IGNORECASE):
                continue
            ordered_lines.append((page_num, line))

    # Find each question 1..80 sequentially
    starts: list[tuple[int, int, int, str]] = []
    search_from = 0
    for qnum in range(1, 81):
        found = False
        pat_inline = re.compile(rf"^(?:Questão\s+)?{qnum}\s*[\.\-\)]\s*(.*)$", re.IGNORECASE)
        for k in range(search_from, len(ordered_lines)):
            pnum, ltxt = ordered_lines[k]
            if ltxt == str(qnum) or re.match(rf"^Questão\s+0?{qnum}$", ltxt, re.IGNORECASE):
                starts.append((qnum, k, pnum, ""))
                search_from = k + 1
                found = True
                break
            m = pat_inline.match(ltxt)
            if m and (len(m.group(1)) == 0 or re.search(r"[A-Za-zÀ-ÿ]{3,}", m.group(1))):
                starts.append((qnum, k, pnum, m.group(1).strip()))
                search_from = k + 1
                found = True
                break
        if not found:
            print(f"  [WARN] Question #{qnum} not detected in sequential scan")

    items: list[dict] = []
    opt_re = re.compile(r"^\(?([A-D])\)[\.\-\s]+(.*)$")

    for i, (qnum, start_idx, page_num, first_body) in enumerate(starts):
        end_idx = starts[i + 1][1] if i + 1 < len(starts) else len(ordered_lines)
        block_lines = ([first_body] if first_body else []) + [
            ordered_lines[k][1] for k in range(start_idx + 1, end_idx)
        ]

        stmt_parts: list[str] = []
        options: dict[str, list[str]] = {}
        current_opt: str | None = None

        for line in block_lines:
            m = opt_re.match(line)
            if m:
                current_opt = m.group(1).upper()
                options[current_opt] = [m.group(2).strip()] if m.group(2).strip() else []
            elif current_opt is not None:
                options[current_opt].append(line)
            else:
                stmt_parts.append(line)

        statement = re.sub(r"\s+", " ", " ".join(stmt_parts)).strip()
        formatted_opts = [
            {"label": lbl, "content": re.sub(r"\s+", " ", " ".join(options[lbl])).strip()}
            for lbl in ("A", "B", "C", "D")
            if lbl in options
        ]
        ans = answer_map.get(qnum, "")
        items.append(
            {
                "originalNumber": qnum,
                "questionType": "MULTIPLE_CHOICE",
                "statement": statement,
                "supportText": None,
                "options": formatted_opts,
                "officialAnswer": ans,
                "isAnnulled": ans == "ANULADA",
                "subjectSlug": classify_oab_subject(qnum),
                "pageNumber": page_num,
            }
        )

    return items


def main() -> None:
    exam_sha = download_file(EXAM_URL, EXAM_PDF)
    key_sha = download_file(KEY_URL, KEY_PDF)
    print(f"OAB 41 Exam PDF SHA-256: {exam_sha}")
    print(f"OAB 41 Key PDF SHA-256: {key_sha}")

    answer_map = parse_oab_gabarito(KEY_PDF)
    print(f"\nParsed {len(answer_map)} official answers for Tipo 1 (Branca).")
    print(f"Annulled in OAB 41 Tipo 1: {[k for k, v in answer_map.items() if v == 'ANULADA']}")

    items = extract_oab_questions(EXAM_PDF, answer_map)
    valid_4opts = [q for q in items if len(q["options"]) == 4 and len(q["statement"]) >= 20]
    print(f"Extracted {len(items)} questions | Complete (4 options + statement >= 20 chars): {len(valid_4opts)}")
    if len(valid_4opts) < 80:
        bad = [(q["originalNumber"], len(q["options"]), len(q["statement"])) for q in items if len(q["options"]) != 4 or len(q["statement"]) < 20]
        print("Items needing parser adjustment:", bad[:15])

    payload = {
        "editionCode": "OAB-41-1FASE",
        "versionLabel": "Tipo 1 - Branca",
        "examPdfSha256": exam_sha,
        "examPdfOfficialUrl": EXAM_URL,
        "answerKeySha256": key_sha,
        "answerKeyOfficialUrl": KEY_URL,
        "idempotencyKey": f"OAB-41-1FASE::Tipo 1 - Branca::{exam_sha[:16]}",
        "totalDetected": len(items),
        "extractedItems": items,
    }
    out_json = OUT_DIR / "import_oab41_extracted.json"
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved OAB 41 payload to {out_json}")


if __name__ == "__main__":
    main()
