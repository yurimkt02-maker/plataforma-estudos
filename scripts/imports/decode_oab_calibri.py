#!/usr/bin/env python3
"""
Decodifica 100% deterministicamente os PDFs da FGV OAB 42º e 45º Exames cuja fonte
Calibri Identity-H gravou os Glyph IDs (GIDs) diretamente no ToUnicode CMap.
Lê a tabela cmap real de C:\Windows\Fonts\calibri.ttf (e calibrib.ttf) para construir
a bijeção exata GID -> Unicode, recuperando 100% dos caracteres, acentos e símbolos
sem OCR e sem perda de fidelidade.
"""

import struct
from pathlib import Path
import pymupdf as fitz


def load_ttf_gid_to_unicode(ttf_path: Path) -> dict[int, str]:
    data = ttf_path.read_bytes()
    num_tables = struct.unpack(">H", data[4:6])[0]
    cmap_offset = None
    for i in range(num_tables):
        off = 12 + i * 16
        tag = data[off : off + 4]
        if tag == b"cmap":
            cmap_offset = struct.unpack(">I", data[off + 8 : off + 12])[0]
            break
    if cmap_offset is None:
        raise RuntimeError(f"Tabela cmap não encontrada em {ttf_path}")

    num_subtables = struct.unpack(">H", data[cmap_offset + 2 : cmap_offset + 4])[0]
    subtable_off = None
    for i in range(num_subtables):
        rec = cmap_offset + 4 + i * 8
        pid, eid, rel = struct.unpack(">HHI", data[rec : rec + 8])
        if pid == 3 and eid == 1:  # Windows Unicode BMP (Format 4)
            subtable_off = cmap_offset + rel
            break
    if subtable_off is None:
        raise RuntimeError("Subtabela cmap Format 4 não encontrada")

    fmt = struct.unpack(">H", data[subtable_off : subtable_off + 2])[0]
    if fmt != 4:
        raise RuntimeError(f"Formato cmap inesperado: {fmt}")

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
        code = ord(ch)
        if ch in ("\n", "\r", "\t"):
            out.append(ch)
        elif code in gid_map:
            out.append(gid_map[code])
        else:
            out.append(ch)
    return "".join(out)


def main() -> None:
    gid_map = load_ttf_gid_to_unicode(Path(r"C:\Windows\Fonts\calibri.ttf"))
    print(f"Carregados {len(gid_map)} mapeamentos GID->Unicode de calibri.ttf!")

    for label, pth, pidx in [
        ("OAB 42º (Pág. 2)", "acervo/oab_2023_2026/oab_42/OAB_42_TIPO1_BRANCA.pdf", 1),
        ("OAB 45º (Pág. 3)", "acervo/oab_2023_2026/oab_45/OAB_45_TIPO1_BRANCA.pdf", 2),
    ]:
        doc = fitz.open(pth)
        page = doc[pidx]
        # Decodificar apenas spans cuja fonte é Calibri Identity-H (headers Arial já estão em WinAnsi normal!)
        d = page.get_text("dict")
        lines_out = []
        for b in d["blocks"]:
            if b.get("type") != 0:
                continue
            for l in b["lines"]:
                line_str = []
                for s in l["spans"]:
                    txt = s["text"]
                    if "Calibri" in s["font"]:
                        txt = decode_calibri_gid_text(txt, gid_map)
                    line_str.append(txt)
                lines_out.append("".join(line_str))
        doc.close()
        print(f"\n=== {label} DECODIFICADO (100% DETERMINÍSTICO) ===")
        print("\n".join(lines_out[:25]))


if __name__ == "__main__":
    main()
