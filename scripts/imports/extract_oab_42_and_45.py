#!/usr/bin/env python3
"""
Extrai 100% deterministicamente todas as 80 questões do 42º Exame e todas as 80 questões
do 45º Exame de Ordem Unificado (FGV — Tipo 1 Branca) a partir dos PDFs oficiais baixados
de oab.fgv.br, recuperando a tabela cmap exata de Calibri (GID -> Unicode) sem OCR.
"""

import hashlib
import json
import re
import struct
from pathlib import Path
import pymupdf as fitz

from download_and_extract_oab_all import (
    classify_oab_20_disciplines,
    parse_oab_gabarito_tipo1,
)


def load_ttf_gid_to_unicode(ttf_path: Path) -> dict[int, str]:
    data = ttf_path.read_bytes()
    num_tables = struct.unpack(">H", data[4:6])[0]
    cmap_offset = None
    for i in range(num_tables):
        off = 12 + i * 16
        if data[off : off + 4] == b"cmap":
            cmap_offset = struct.unpack(">I", data[off + 8 : off + 12])[0]
            break
    if cmap_offset is None:
        raise RuntimeError(f"Tabela cmap não encontrada em {ttf_path}")

    num_subtables = struct.unpack(">H", data[cmap_offset + 2 : cmap_offset + 4])[0]
    subtable_off = None
    for i in range(num_subtables):
        rec = cmap_offset + 4 + i * 8
        pid, eid, rel = struct.unpack(">HHI", data[rec : rec + 8])
        if pid == 3 and eid == 1:
            subtable_off = cmap_offset + rel
            break
    if subtable_off is None:
        raise RuntimeError("Subtabela cmap Format 4 não encontrada")

    seg_count_x2 = struct.unpack(">H", data[subtable_off + 6 : subtable_off + 8])[0]
    seg_count = seg_count_x2 // 2
    end_codes_off = subtable_off + 14
    start_codes_off = end_codes_off + seg_count_x2 + 2
    id_delta_off = start_codes_off + seg_count_x2
    id_range_off = id_delta_off + seg_count_x2

    gid_to_char: dict[int, str] = {}
    for i in range(seg_count):
        end_c = struct.unpack(">H", data[end_codes_off + i * 2 : end_codes_off + i * 2 + 2])[0]
        start_c = struct.unpack(">H", data[start_codes_off + i * 2 : start_codes_off + i * 2 + 2])[0]
        id_delta = struct.unpack(">h", data[id_delta_off + i * 2 : id_delta_off + i * 2 + 2])[0]
        id_range = struct.unpack(">H", data[id_range_off + i * 2 : id_range_off + i * 2 + 2])[0]
        if start_c == 0xFFFF:
            continue
        for c in range(start_c, end_c + 1):
            if id_range == 0:
                gid = (c + id_delta) & 0xFFFF
            else:
                addr = id_range_off + i * 2 + id_range + (c - start_c) * 2
                gid = struct.unpack(">H", data[addr : addr + 2])[0]
                if gid != 0:
                    gid = (gid + id_delta) & 0xFFFF
            if gid != 0 and gid not in gid_to_char:
                gid_to_char[gid] = chr(c)
    return gid_to_char


def decode_calibri_gid_text(text: str, gid_map: dict[int, str]) -> str:
    out = []
    for ch in text:
        if ch in (" ", "\n", "\r", "\t"):
            out.append(ch)
            continue
        code = ord(ch)
        if code in gid_map:
            out.append(gid_map[code])
        else:
            out.append(ch)
    return "".join(out)


def extract_decoded_oab_questions(
    pdf_path: Path,
    answer_map: dict[int, str],
    exam_num: int,
    gid_map: dict[int, str],
    gid_map_bold: dict[int, str],
) -> list[dict]:
    doc = fitz.open(str(pdf_path))
    ordered_lines: list[tuple[int, str]] = []

    for p_idx in range(len(doc)):
        page = doc[p_idx]
        w, h = page.rect.width, page.rect.height
        # Pular capa (página 0) e páginas em branco
        if p_idx == 0:
            continue
        for rect in (fitz.Rect(0, 42, w / 2, h - 25), fitz.Rect(w / 2, 42, w, h - 25)):
            d = page.get_text("dict", clip=rect)
            for b in d["blocks"]:
                if b.get("type") != 0:
                    continue
                for l in b["lines"]:
                    parts = []
                    for s in l["spans"]:
                        txt = s["text"]
                        font_name = s.get("font", "")
                        if "Calibri" in font_name:
                            use_map = gid_map_bold if "Bold" in font_name else gid_map
                            txt = decode_calibri_gid_text(txt, use_map)
                        parts.append(txt)
                    line = re.sub(r"\s+", " ", "".join(parts)).strip()
                    if not line:
                        continue
                    if re.match(
                        r"^(\d+o?\s*EXAME|ORDEM DOS ADVOGADOS|Tipo\s*(1\s*[–-]\s*)?Branca|FGV|Página \d+|PROVA OBJETIVA)",
                        line,
                        re.IGNORECASE,
                    ):
                        continue
                    ordered_lines.append((p_idx + 1, line))
    doc.close()

    starts: list[tuple[int, int, int, str]] = []
    search_from = 0
    for qnum in range(1, 81):
        pat_inline = re.compile(rf"^(?:Questão\s+)?0?{qnum}\s*[\.\-\)]\s*(.*)$", re.IGNORECASE)
        for k in range(search_from, len(ordered_lines)):
            pnum, ltxt = ordered_lines[k]
            if ltxt == str(qnum) or re.match(rf"^Questão\s+0?{qnum}$", ltxt, re.IGNORECASE):
                starts.append((qnum, k, pnum, ""))
                search_from = k + 1
                break
            m = pat_inline.match(ltxt)
            if m and (len(m.group(1)) == 0 or re.search(r"[A-Za-zÀ-ÿ]{3,}", m.group(1))):
                starts.append((qnum, k, pnum, m.group(1).strip()))
                search_from = k + 1
                break

    items: list[dict] = []
    opt_re = re.compile(r"^\(?([A-D])\)[\.\-\s]*(.*)$")

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
                "subjectSlug": classify_oab_20_disciplines(qnum, statement, exam_num),
                "pageNumber": page_num,
            }
        )

    return items


def main() -> None:
    gid_map = load_ttf_gid_to_unicode(Path(r"C:\Windows\Fonts\calibri.ttf"))
    gid_map_bold = load_ttf_gid_to_unicode(Path(r"C:\Windows\Fonts\calibrib.ttf"))

    targets = [
        {
            "examNum": 42,
            "year": 2024,
            "editionCode": "OAB-42-1FASE",
            "title": "42º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
            "examDate": "2024-12-01",
            "examUrl": "https://oab.fgv.br/arq/645/402439_OAB%2042%20-%20ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
            "keyUrl": "https://oab.fgv.br/arq/645/273585_OAB42%20Gabaritos%20para%20publica%c3%a7%c3%a3o%20-%20V20241203%20(003).pdf",
        },
        {
            "examNum": 45,
            "year": 2025,
            "editionCode": "OAB-45-1FASE",
            "title": "45º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
            "examDate": "2025-12-21",
            "examUrl": "https://oab.fgv.br/arq/648/405589_ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
            "keyUrl": "https://oab.fgv.br/arq/648/85707_OAB45%20Gabaritos%20para%20publica%c3%a7%c3%a3o%20-%20v3.pdf",
        },
    ]

    for ex in targets:
        num = ex["examNum"]
        ex_dir = Path(f"acervo/oab_2023_2026/oab_{num}")
        exam_pdf = ex_dir / f"OAB_{num}_TIPO1_BRANCA.pdf"
        key_pdf = ex_dir / f"OAB_{num}_GABARITO_DEFINITIVO.pdf"

        exam_sha = hashlib.sha256(exam_pdf.read_bytes()).hexdigest()
        key_sha = hashlib.sha256(key_pdf.read_bytes()).hexdigest()
        answer_map, detected_date = parse_oab_gabarito_tipo1(key_pdf)

        items = extract_decoded_oab_questions(exam_pdf, answer_map, num, gid_map, gid_map_bold)
        valid_4opts = [
            q for q in items if len(q["options"]) == 4 and len(q["statement"]) >= 20
        ]
        # Verificar se restou qualquer caractere corrompido (Latin Extended-A/B > 0x017F inesperado)
        corrupted = [
            q["originalNumber"]
            for q in items
            if re.search(r"[\u0100-\u024F\u03E0-\u03FF]", q["statement"] + " ".join(o["content"] for o in q["options"]))
        ]
        annulled = sorted([q["originalNumber"] for q in items if q["isAnnulled"]])

        payload = {
            "examNum": num,
            "year": ex["year"],
            "editionCode": ex["editionCode"],
            "title": ex["title"],
            "examDate": detected_date or ex["examDate"],
            "versionLabel": "Tipo 1 - Branca",
            "examPdfSha256": exam_sha,
            "examPdfOfficialUrl": ex["examUrl"],
            "answerKeySha256": key_sha,
            "answerKeyOfficialUrl": ex["keyUrl"],
            "idempotencyKey": f"{ex['editionCode']}::Tipo 1 - Branca::{exam_sha[:16]}",
            "totalDetected": len(items),
            "totalComplete": len(valid_4opts),
            "annulledNumbers": annulled,
            "extractedItems": items,
        }
        out_json = ex_dir / f"import_oab{num}_extracted.json"
        out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        print(
            f"[OAB {num}º | {ex['year']} | {payload['examDate']}] Gab={len(answer_map)} | Ext={len(items)} | Valid={len(valid_4opts)}/80 | Corrupted={len(corrupted)} | Anuladas={annulled}"
        )
        if items:
            print(f"   Amostra Q1: {items[0]['statement'][:120]}...")
            print(f"   Amostra Q80: {items[-1]['statement'][:120]}...")


if __name__ == "__main__":
    main()
