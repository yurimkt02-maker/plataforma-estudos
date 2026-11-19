#!/usr/bin/env python3
"""
Baixa a prova objetiva e gabarito definitivo oficiais da PRF 2018/2019 (Edital 2018,
aplicação 03/02/2019) e extrai tanto os itens 1-8 (Inglês) da PRF 2021 quanto
os 120 itens completos da PRF 2019 com o extrator aprimorado PyMuPDF.
"""

import hashlib
import json
import re
import urllib.request
from pathlib import Path
import pymupdf as fitz


def download_file(url: str, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            dest.write_bytes(resp.read())
    return hashlib.sha256(dest.read_bytes()).hexdigest()


def parse_cebraspe_gabarito_any(pdf_path: Path) -> dict[int, str]:
    doc = fitz.open(str(pdf_path))
    full_text = "\n".join(page.get_text("text") for page in doc)
    doc.close()

    tokens = [l.strip() for l in full_text.splitlines() if l.strip()]
    mapping: dict[int, str] = {}

    i = 0
    while i < len(tokens):
        if tokens[i].isdigit() and 1 <= int(tokens[i]) <= 150:
            nums: list[int] = []
            while i < len(tokens) and tokens[i].isdigit():
                val = int(tokens[i])
                if 1 <= val <= 150:
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


def classify_prf_subject(num: int, text: str, is_english: bool = False) -> str:
    if is_english and 1 <= num <= 8:
        return "interpretacao-e-compreensao-de-textos"
    lower = text.lower()
    if any(k in lower for k in ("trânsito", "ctb", "veículo", "condutor", "rodovia", "cnh", "habilitação", "resolução", "contran", "infração de trânsito", "sinalização", "velocidade", "embriaguez")):
        if any(k in lower for k in ("crime", "pena", "detenção", "reclusão", "embriaguez", "homicídio culposo")):
            return "crimes-de-transito"
        return "normas-gerais-de-circulacao-e-conduta"
    if any(k in lower for k in ("constituição", "direito fundamental", "habeas", "segurança pública", "nacionalidade", "direitos humanos", "art. 5", "poder executivo", "união")):
        return "direitos-e-garantias-fundamentais"
    if any(k in lower for k in ("administração pública", "ato administrativo", "servidor", "improbidade", "licitação", "responsabilidade civil do estado", "poder de polícia", "poder hierárquico", "agente público")):
        return "atos-e-poderes-administrativos"
    if any(k in lower for k in ("inquérito", "flagrante", "processo penal", "prisão", "prova ilícita", "busca e apreensão")):
        return "inquerito-policial"
    if any(k in lower for k in ("crime", "pena", "dolo", "culpa", "peculato", "homicídio", "código penal", "ilicitude", "culpabilidade", "tipicidade", "imputabilidade", "furto", "roubo", "corrupção")):
        return "teoria-do-crime-e-imputabilidade"
    if any(k in lower for k in ("texto", "parágrafo", "período", "oração", "vírgula", "crase", "pronome", "verbo", "sujeito", "sentido", "palavras", "vocábulo", "redação oficial")):
        return "interpretacao-e-compreensao-de-textos"
    if 51 <= num <= 90:
        return "normas-gerais-de-circulacao-e-conduta"
    return "interpretacao-e-compreensao-de-textos"


def extract_cebraspe_items(
    pdf_path: Path,
    answer_map: dict[int, str],
    is_english: bool = False,
    assets_dir: Path | None = None,
) -> tuple[list[dict], list[dict]]:
    doc = fitz.open(str(pdf_path))
    column_chunks: list[tuple[int, str]] = []
    extracted_images: list[dict] = []

    for p_idx in range(len(doc)):
        page = doc[p_idx]
        w, h = page.rect.width, page.rect.height

        # Detect embedded images/figures on the page for asset metadata
        if assets_dir is not None:
            imgs = page.get_images(full=True)
            for img_idx, img in enumerate(imgs):
                xref = img[0]
                try:
                    base = doc.extract_image(xref)
                    if base and base.get("width", 0) >= 80 and base.get("height", 0) >= 60:
                        ext = base.get("ext", "png")
                        fname = f"{pdf_path.stem}_p{p_idx + 1}_img{img_idx + 1}.{ext}"
                        assets_dir.mkdir(parents=True, exist_ok=True)
                        (assets_dir / fname).write_bytes(base["image"])
                        extracted_images.append({
                            "pageNumber": p_idx + 1,
                            "fileName": fname,
                            "width": base.get("width"),
                            "height": base.get("height"),
                        })
                except Exception:
                    pass

        left_rect = fitz.Rect(0, 42, w / 2, h - 22)
        right_rect = fitz.Rect(w / 2, 42, w, h - 22)
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
            if ("CEBRASPE" in line or "CESPE" in line) and "PRF" in line:
                continue
            if line in ("BLOCO I", "BLOCO II", "BLOCO III", "ESPAÇO LIVRE", "PROVA OBJETIVA"):
                continue
            ordered_lines.append((page_num, line))

    expected_nums = sorted(answer_map.keys())
    item_starts: list[tuple[int, int, int, str]] = []
    search_from = 0
    for target_num in expected_nums:
        pattern = re.compile(rf"^{target_num}\s+(.+)$")
        found = False
        for k in range(search_from, len(ordered_lines)):
            pnum, ltxt = ordered_lines[k]
            m = pattern.match(ltxt)
            if m and re.search(r"[A-Za-zÀ-ÿ]{2,}", m.group(1)):
                item_starts.append((target_num, k, pnum, m.group(1).strip()))
                search_from = k + 1
                found = True
                break
        if not found:
            for k in range(search_from, len(ordered_lines) - 1):
                pnum, ltxt = ordered_lines[k]
                next_txt = ordered_lines[k + 1][1].strip()
                if ltxt == str(target_num) and re.search(r"[A-Za-zÀ-ÿ]{2,}", next_txt):
                    item_starts.append((target_num, k, pnum, next_txt))
                    search_from = k + 2
                    found = True
                    break
        if not found:
            # Handle visual/diagram-only items (e.g. PRF 2019 items 24, 25, 26 where the item body is a figure)
            for k in range(search_from, len(ordered_lines)):
                pnum, ltxt = ordered_lines[k]
                if ltxt == str(target_num):
                    item_starts.append((target_num, k, pnum, f"[ITEM VISUAL / FIGURA #{target_num} — PÁG. {pnum}] Consulte a figura oficial do item #{target_num} na página {pnum} da prova para julgar."))
                    search_from = k + 1
                    found = True
                    break

    group_header_re = re.compile(
        r"^(Texto\s+\w+|Text\s+\w+|No que se refere|Considerando|Acerca|Com relação|Julgue|A respeito|Com base|Quanto|Em relação|Tendo em vista|A figura|Um\s+policial|Em\s+determinada|Determinado|Based on|Judge|According to)",
        re.IGNORECASE,
    )

    items: list[dict] = []
    current_context = ""
    images_by_page: dict[int, list[str]] = {}
    for im in extracted_images:
        images_by_page.setdefault(im["pageNumber"], []).append(im["fileName"])

    for i, (num, start_idx, page_num, first_body) in enumerate(item_starts):
        end_idx = item_starts[i + 1][1] if i + 1 < len(item_starts) else len(ordered_lines)

        prev_end = item_starts[i - 1][1] + 1 if i > 0 else 0
        if start_idx > prev_end:
            between_lines = [ordered_lines[b][1] for b in range(prev_end, start_idx)]
            joined_between = " ".join(between_lines)
            instr_match = re.search(
                r"((?:No que se refere|Considerando|Acerca|Com relação|Julgue|A respeito|Com base|Quanto|Em relação|Tendo em vista|Based on|According to)[^.]+(?:julgue os (?:próximos )?itens[^.]*\.|itens a seguir\.|itens que se seguem\.|judge the following items[^.]*\.))",
                joined_between,
                re.IGNORECASE,
            )
            if instr_match:
                current_context = re.sub(r"\s+", " ", instr_match.group(1)).strip()
            elif is_english and len(joined_between) > 80:
                current_context = re.sub(r"\s+", " ", joined_between).strip()[:1200]

        body_parts = [first_body]
        for k in range(start_idx + 1, end_idx):
            ltxt = ordered_lines[k][1]
            if group_header_re.match(ltxt) and (
                "julgue" in " ".join(ordered_lines[m][1] for m in range(k, min(end_idx, k + 5))).lower()
                or "judge" in " ".join(ordered_lines[m][1] for m in range(k, min(end_idx, k + 5))).lower()
                or ltxt.startswith("Texto ")
                or ltxt.startswith("Text ")
            ):
                break
            body_parts.append(ltxt)

        statement = re.sub(r"\s+", " ", " ".join(body_parts)).strip()
        is_visual_only = statement.startswith("[ITEM VISUAL / FIGURA")
        ans = answer_map[num]
        page_imgs = images_by_page.get(page_num, [])
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
                "subjectSlug": classify_prf_subject(num, statement, is_english=is_english),
                "pageNumber": page_num,
                "pageImages": page_imgs,
                "requiresHumanReview": is_visual_only,
                "reviewReason": (
                    f"Item baseado em figura/diagrama (Página {page_num}). Validar recorte visual antes da publicação."
                    if is_visual_only
                    else None
                ),
            }
        )

    return items, extracted_images


def main() -> None:
    # 1. PRF 2021 Itens 1-8 (Inglês) para completar 120/120
    ing_pdf = Path("acervo/prf_2021/578_PRF_ING_01.PDF")
    ing_key = Path("acervo/prf_2021/GAB_DEFINITIVO_578_PRF_ING_01.PDF")
    ing_sha = hashlib.sha256(ing_pdf.read_bytes()).hexdigest()
    ing_key_sha = hashlib.sha256(ing_key.read_bytes()).hexdigest()
    ing_map = parse_cebraspe_gabarito_any(ing_key)
    ing_items, _ = extract_cebraspe_items(ing_pdf, ing_map, is_english=True)
    print(f"[PRF 2021 Inglês 1-8] Gabarito: {len(ing_map)} | Extraídos: {len(ing_items)} | Anulados: {[k for k, v in ing_map.items() if v == 'ANULADA']}")

    ing_payload = {
        "editionCode": "PRF-2021-POLICIAL",
        "versionLabel": "Caderno Padrão",
        "examPdfSha256": ing_sha,
        "examPdfOfficialUrl": "https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/578_PRF_ING_01.PDF",
        "answerKeySha256": ing_key_sha,
        "answerKeyOfficialUrl": "https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/GAB_DEFINITIVO_578_PRF_ING_01.PDF",
        "idempotencyKey": f"PRF-2021-POLICIAL::Caderno Padrão::ING-1-8::{ing_sha[:16]}",
        "totalDetected": len(ing_items),
        "extractedItems": ing_items,
    }
    Path("acervo/prf_2021/import_prf2021_ing_1_8_extracted.json").write_text(
        json.dumps(ing_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 2. PRF 2018/2019 (Prova Completa 1-120)
    prf19_dir = Path("acervo/prf_2019")
    prf19_exam_url = "https://cdn.cebraspe.org.br/concursos/prf_18/arquivos/440_PRF_001_00_PAG_9.PDF"
    prf19_key_url = "https://cdn.cebraspe.org.br/concursos/prf_18/arquivos/GAB_DEFINITIVO_MATRIZ_440_PRF_001_00_PAG_9.PDF"
    prf19_pdf = prf19_dir / "440_PRF_001_00_PAG_9.PDF"
    prf19_key = prf19_dir / "GAB_DEFINITIVO_MATRIZ_440_PRF_001_00_PAG_9.PDF"

    prf19_sha = download_file(prf19_exam_url, prf19_pdf)
    prf19_key_sha = download_file(prf19_key_url, prf19_key)
    prf19_map = parse_cebraspe_gabarito_any(prf19_key)
    prf19_items, prf19_imgs = extract_cebraspe_items(
        prf19_pdf, prf19_map, is_english=False, assets_dir=prf19_dir / "assets"
    )
    print(f"[PRF 2019 Completa 1-120] Gabarito: {len(prf19_map)} | Extraídos: {len(prf19_items)} | Imagens: {len(prf19_imgs)} | Anulados: {[k for k, v in prf19_map.items() if v == 'ANULADA']}")

    prf19_payload = {
        "editionCode": "PRF-2019-POLICIAL",
        "versionLabel": "Caderno Padrão",
        "examPdfSha256": prf19_sha,
        "examPdfOfficialUrl": prf19_exam_url,
        "answerKeySha256": prf19_key_sha,
        "answerKeyOfficialUrl": prf19_key_url,
        "idempotencyKey": f"PRF-2019-POLICIAL::Caderno Padrão::{prf19_sha[:16]}",
        "totalDetected": len(prf19_items),
        "extractedItems": prf19_items,
    }
    (prf19_dir / "import_prf2019_extracted.json").write_text(
        json.dumps(prf19_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
