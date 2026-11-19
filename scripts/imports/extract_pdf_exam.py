#!/usr/bin/env python3
"""
Ferramenta administrativa local de extração de provas e gabaritos oficiais em PDF (PyMuPDF / fitz).
Extrai enunciados, alternativas, blocos de apoio, figuras e páginas de referência,
calcula o hash SHA-256 oficial dos documentos e gera o pacote JSON auditável para o
painel administrativo de curadoria (/admin/importacoes) e Prisma Postgres.

Uso:
  python scripts/imports/extract_pdf_exam.py \
    --exam-pdf caminho/para/prova.pdf \
    --answer-key-pdf caminho/para/gabarito.pdf \
    --edition-code TJSP-2024-ESCREVENTE \
    --version-label "Versão 1" \
    --question-type MULTIPLE_CHOICE \
    --output import_payload.json
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


def compute_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def parse_answer_key_text(text: str) -> Dict[int, str]:
    """
    Extrai pares (numero_questao -> resposta) de tabelas de gabarito oficial
    (padrões Vunesp, FGV e Cebraspe).
    """
    mapping: Dict[int, str] = {}
    pattern = re.compile(r"\b(\d{1,3})\s*[-–:.\s]\s*([A-E]|C|E|ANULADA|\*)\b", re.IGNORECASE)
    for match in pattern.finditer(text):
        number = int(match.group(1))
        ans = match.group(2).upper()
        if 1 <= number <= 250 and number not in mapping:
            mapping[number] = ans
    return mapping


def parse_questions_from_pages(
    pages_data: List[Dict[str, Any]],
    question_type: str,
    answer_keys: Dict[int, str],
) -> List[Dict[str, Any]]:
    """
    Estrutura questões numeradas e suas respectivas alternativas (A-E ou Certo/Errado),
    preservando o número da página de origem para rastreabilidade documental.
    """
    full_items: List[Dict[str, Any]] = []
    q_header_re = re.compile(
        r"(?:QUEST[ÃA]O\s+|ITEM\s+|^)(\d{1,3})\s*[.\-–)]\s*(.+)",
        re.IGNORECASE | re.DOTALL,
    )
    opt_re = re.compile(r"^\s*\(?([A-E])\)?[.\-–)]\s*(.+)", re.DOTALL)

    for page_info in pages_data:
        page_num = page_info["pageNumber"]
        blocks = page_info["blocks"]

        current_q: Optional[Dict[str, Any]] = None
        for block_text in blocks:
            cleaned = block_text.strip()
            if not cleaned:
                continue

            q_match = q_header_re.match(cleaned)
            if q_match and len(cleaned) > 25:
                if current_q is not None:
                    full_items.append(current_q)

                q_num = int(q_match.group(1))
                stmt = q_match.group(2).strip()
                official_ans = answer_keys.get(q_num, "PENDING")

                current_q = {
                    "originalNumber": q_num,
                    "questionType": question_type,
                    "statement": stmt,
                    "options": (
                        [
                            {"label": "C", "content": "Certo"},
                            {"label": "E", "content": "Errado"},
                        ]
                        if question_type == "TRUE_FALSE"
                        else []
                    ),
                    "officialAnswer": official_ans,
                    "isAnnulled": official_ans in ("ANULADA", "*"),
                    "subjectSlug": "a-classificar",
                    "pageNumber": page_num,
                }
                continue

            if current_q is not None and question_type == "MULTIPLE_CHOICE":
                for line in cleaned.splitlines():
                    o_match = opt_re.match(line.strip())
                    if o_match:
                        current_q["options"].append(
                            {
                                "label": o_match.group(1).upper(),
                                "content": o_match.group(2).strip(),
                            }
                        )
                    elif current_q["options"]:
                        current_q["options"][-1]["content"] += " " + line.strip()
                    else:
                        current_q["statement"] += "\n" + line.strip()

        if current_q is not None:
            full_items.append(current_q)

    return full_items


def extract_pdf_with_pymupdf(pdf_path: Path) -> List[Dict[str, Any]]:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print(
            "ERRO: PyMuPDF (fitz) não está instalado. Instale com: pip install pymupdf",
            file=sys.stderr,
        )
        sys.exit(1)

    doc = fitz.open(str(pdf_path))
    pages_output: List[Dict[str, Any]] = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        raw_blocks = page.get_text("blocks")
        # Ordena blocos por coordenada vertical (y0) e horizontal (x0)
        sorted_blocks = sorted(raw_blocks, key=lambda b: (round(b[1], 1), round(b[0], 1)))
        text_blocks = [b[4] for b in sorted_blocks if b[6] == 0 and b[4].strip()]
        pages_output.append(
            {
                "pageNumber": page_index + 1,
                "blocks": text_blocks,
                "imageCount": len(page.get_images(full=True)),
            }
        )

    doc.close()
    return pages_output


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extrator local auditável de provas em PDF (PyMuPDF) para Prisma Postgres."
    )
    parser.add_argument("--exam-pdf", required=True, help="Caminho para o PDF oficial da prova")
    parser.add_argument("--answer-key-pdf", required=True, help="Caminho para o PDF do gabarito definitivo")
    parser.add_argument("--edition-code", required=True, help="Código da edição (ex: TJSP-2024-ESCREVENTE)")
    parser.add_argument("--version-label", default="Versão 1", help="Rótulo de versão do caderno")
    parser.add_argument(
        "--question-type",
        choices=["MULTIPLE_CHOICE", "TRUE_FALSE"],
        default="MULTIPLE_CHOICE",
    )
    parser.add_argument("--exam-url", required=True, help="URL oficial de origem da prova")
    parser.add_argument("--answer-key-url", required=True, help="URL oficial do gabarito definitivo")
    parser.add_argument("--output", default="import_payload.json", help="Arquivo JSON de saída")
    args = parser.parse_args()

    exam_path = Path(args.exam_pdf)
    key_path = Path(args.answer_key_pdf)

    if not exam_path.exists():
        print(f"Arquivo de prova não encontrado: {exam_path}", file=sys.stderr)
        sys.exit(1)
    if not key_path.exists():
        print(f"Arquivo de gabarito não encontrado: {key_path}", file=sys.stderr)
        sys.exit(1)

    exam_sha256 = compute_sha256(exam_path)
    key_sha256 = compute_sha256(key_path)

    exam_pages = extract_pdf_with_pymupdf(exam_path)
    key_pages = extract_pdf_with_pymupdf(key_path)
    key_full_text = "\n".join(
        "\n".join(p["blocks"]) for p in key_pages
    )
    answer_map = parse_answer_key_text(key_full_text)
    extracted_items = parse_questions_from_pages(
        exam_pages, args.question_type, answer_map
    )

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "editionCode": args.edition_code,
        "versionLabel": args.version_label,
        "examPdfSha256": exam_sha256,
        "examPdfOfficialUrl": args.exam_url,
        "answerKeySha256": key_sha256,
        "answerKeyOfficialUrl": args.answer_key_url,
        "idempotencyKey": f"{args.edition_code}::{args.version_label}::{exam_sha256[:16]}",
        "totalDetected": len(extracted_items),
        "extractedItems": extracted_items,
    }

    output_path = Path(args.output)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Extração concluída com sucesso: {len(extracted_items)} itens gravados em {output_path}")


if __name__ == "__main__":
    main()
