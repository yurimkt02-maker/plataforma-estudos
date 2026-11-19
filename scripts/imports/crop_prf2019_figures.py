#!/usr/bin/env python3
"""
Recorta em alta resolução (2x DPI) as figuras oficiais dos itens 24, 25 e 26
(Página 3) da prova PRF 2019 (440_PRF_001_00_PAG_9.PDF) para public/assets/exams/prf_2019/.
"""

from pathlib import Path
import pymupdf as fitz

PDF_PATH = Path("acervo/prf_2019/440_PRF_001_00_PAG_9.PDF")
OUT_DIR = Path("public/assets/exams/prf_2019")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def crop_rect(page: fitz.Page, rect: fitz.Rect, dest: Path) -> None:
    mat = fitz.Matrix(2.2, 2.2)
    pix = page.get_pixmap(matrix=mat, clip=rect, alpha=False)
    pix.save(str(dest))
    print(f"Salvo {dest} ({pix.width}x{pix.height}px)")


def main() -> None:
    doc = fitz.open(str(PDF_PATH))
    page = doc[2]  # Página 3 (0-indexed)

    # Figura base: Vista frontal e vista da esquerda + instrução (sem o número 24 abaixo)
    crop_rect(page, fitz.Rect(24, 44, 298, 200), OUT_DIR / "prf2019_p3_base_vistas.png")
    # Item 24
    crop_rect(page, fitz.Rect(24, 212, 200, 290), OUT_DIR / "prf2019_item_24.png")
    # Item 25
    crop_rect(page, fitz.Rect(24, 298, 200, 384), OUT_DIR / "prf2019_item_25.png")
    # Item 26
    crop_rect(page, fitz.Rect(24, 390, 200, 484), OUT_DIR / "prf2019_item_26.png")

    doc.close()


if __name__ == "__main__":
    main()
