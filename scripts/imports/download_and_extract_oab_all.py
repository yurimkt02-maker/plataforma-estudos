#!/usr/bin/env python3
"""
Baixa legitimamente os PDFs oficiais públicos dos 10 novos exames da OAB (2023–2026:
47º, 46º, 45º, 44º, 43º, 42º, 40º, 39º, 38º e 37º — Tipo 1 Branca + Gabaritos Definitivos)
diretamente de oab.fgv.br/arq/, calcula SHA-256, extrai todas as 80 questões por edição
com PyMuPDF (2 colunas), audita anulações (incluindo Q47 do 47º Exame) e gera JSONs auditáveis.
"""

import hashlib
import json
import re
import urllib.request
from pathlib import Path
import pymupdf as fitz

OUT_DIR = Path("acervo/oab_2023_2026")
OUT_DIR.mkdir(parents=True, exist_ok=True)

OAB_EXAMS = [
    {
        "examNum": 47,
        "year": 2026,
        "editionCode": "OAB-47-1FASE",
        "title": "47º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        "examDate": "2026-09-06",
        "examUrl": "https://oab.fgv.br/arq/650/566837_ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
        "keyUrl": "https://oab.fgv.br/arq/650/480420_gabarito%20definitivo%20(1).pdf",
        "annulmentNoticeUrl": "https://oab.fgv.br/arq/650/90523_47%20eou.%20anulacao.%20po.%20questao%2047.%20tipo1.%20(2).pdf",
    },
    {
        "examNum": 46,
        "year": 2026,
        "editionCode": "OAB-46-1FASE",
        "title": "46º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        "examDate": "2026-05-17",
        "examUrl": "https://oab.fgv.br/arq/649/561671_ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
        "keyUrl": "https://oab.fgv.br/arq/649/103500_oab261_gabarito_definitivo.pdf",
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
    {
        "examNum": 44,
        "year": 2025,
        "editionCode": "OAB-44-1FASE",
        "title": "44º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        "examDate": "2025-08-17",
        "examUrl": "https://oab.fgv.br/arq/647/519680_ADVOGADO%20OAB(CNS01)%20Tipo%201%20(2).pdf",
        "keyUrl": "https://oab.fgv.br/arq/647/158882_OAB44%20Gabaritos%20para%20publica%c3%a7%c3%a3o%20-%20definitivo.pdf",
    },
    {
        "examNum": 43,
        "year": 2025,
        "editionCode": "OAB-43-1FASE",
        "title": "43º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        "examDate": "2025-04-27",
        "examUrl": "https://oab.fgv.br/arq/646/838452_ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
        "keyUrl": "https://oab.fgv.br/arq/646/194143_oab251_gabarito_definitivo_ms.pdf",
    },
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
        "examNum": 40,
        "year": 2024,
        "editionCode": "OAB-40-1FASE",
        "title": "40º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        "examDate": "2024-03-24",
        "examUrl": "https://oab.fgv.br/arq/643/341069_ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
        "keyUrl": "https://oab.fgv.br/arq/643/244619_oab241_gabarito_definitivo%20(002)%20(1).pdf",
    },
    {
        "examNum": 39,
        "year": 2023,
        "editionCode": "OAB-39-1FASE",
        "title": "39º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        "examDate": "2023-11-19",
        "examUrl": "https://oab.fgv.br/arq/642/1108259_ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
        "keyUrl": "https://oab.fgv.br/arq/642/86039_OABXXXIX%20definitivo%20v20231205.pdf",
    },
    {
        "examNum": 38,
        "year": 2023,
        "editionCode": "OAB-38-1FASE",
        "title": "38º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        "examDate": "2023-07-09",
        "examUrl": "https://oab.fgv.br/arq/641/1180933_OABXXXVIII%20-%20Prova%20Tipo%201.pdf",
        "keyUrl": "https://oab.fgv.br/arq/641/77411_GABARITOS%20DEFINITIVOS_XXXVIII_EXAME_DE_ORDEM_20230724.pdf",
    },
    {
        "examNum": 37,
        "year": 2023,
        "editionCode": "OAB-37-1FASE",
        "title": "37º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        "examDate": "2023-02-26",
        "examUrl": "https://oab.fgv.br/arq/640/641232_Advogado(EOU)%20Tipo%201.pdf",
        "keyUrl": "https://oab.fgv.br/arq/640/82353_GABARITOS%20DEFINITIVOS_XXXVII_EXAME_DE_ORDEM.pdf",
    },
]


def download_file(url: str, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=35) as resp:
            dest.write_bytes(resp.read())
    return hashlib.sha256(dest.read_bytes()).hexdigest()


def parse_oab_gabarito_tipo1(pdf_path: Path) -> tuple[dict[int, str], str]:
    doc = fitz.open(str(pdf_path))
    full_text = "\n".join(page.get_text("text") for page in doc)
    doc.close()

    # Tentar extrair data da prova do cabeçalho (ex: "PROVAS DO DIA 28/07/2024")
    date_match = re.search(r"(\d{2})/(\d{2})/(\d{4})", full_text)
    detected_date = (
        f"{date_match.group(3)}-{date_match.group(2)}-{date_match.group(1)}"
        if date_match
        else ""
    )

    t1_match = re.search(
        r"(?:Tipo|PROVA)\s+1\b(.*?)(?:(?:Tipo|PROVA)\s+2\b|$)", full_text, flags=re.IGNORECASE | re.DOTALL
    )
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
            while i < len(tokens) and tokens[i].upper() in (
                "A",
                "B",
                "C",
                "D",
                "*",
                "ANULADA",
                "ANULADO",
                "-",
                "X",
            ):
                val = tokens[i].upper()
                ans.append("ANULADA" if val in ("*", "ANULADA", "ANULADO", "-", "X") else val)
                i += 1
            if nums and ans:
                for n, a in zip(nums, ans):
                    mapping[n] = a
                continue
        i += 1
    return mapping, detected_date


def classify_oab_20_disciplines(num: int, text: str, exam_num: int) -> str:
    """
    Classifica cada questão da OAB na taxonomia oficial de 20 disciplinas (Seção 3.5),
    combinando sinais jurídicos do enunciado com a composição histórica FGV de cada exame
    (a partir do 38º Exame entraram Eleitoral, Financeiro e Previdenciário).
    """
    lower = text.lower()

    # Sinais inequívocos no texto têm prioridade
    if any(k in lower for k in ("conselho seccional", "tribunal de ética", "estatuto da advocacia", "oab", "sociedade de advogados", "honorários advocatícios", "código de ética e disciplina", "prerrogativa do advogado")):
        return "oab-etica-profissional"
    if any(k in lower for k in ("aristóteles", "kant", "kelsen", "hart", "dworkin", "rawls", "norberto bobbio", "filosofia do direito", "jusnaturalismo", "positivismo jurídico", "hannah arendt", "montesquieu", "rousseau", "hobbes", "locke", "habermas")):
        return "oab-filosofia-do-direito"
    if any(k in lower for k in ("justiça eleitoral", "partido político", "inelegibilidade", "ficha limpa", "propaganda eleitoral", "código eleitoral", "tse", "tre", "candidato a prefeito", "candidato a vereador", "eleições municipais")):
        return "oab-direito-eleitoral"
    if any(k in lower for k in ("direito financeiro", "lei orçamentária", "ldo", "ppa", "lei de responsabilidade fiscal", "lrf", "precatório", "crédito adicional", "orçamento público", "despesa pública")):
        return "oab-direito-financeiro"
    if any(k in lower for k in ("inss", "rgps", "previdência social", "aposentadoria", "auxílio-doença", "benefício por incapacidade", "pensão por morte", "salário-maternidade", "segurado obrigatório", "segurado facultativo", "lei nº 8.213")):
        return "oab-direito-previdenciario"
    if any(k in lower for k in ("direito ambiental", "meio ambiente", "ibama", "licenciamento ambiental", "unidade de conservação", "área de preservação permanente", "reserva legal", "código florestal", "poluidor")):
        return "oab-direito-ambiental"
    if any(k in lower for k in ("código de defesa do consumidor", "cdc", "fornecedor", "consumidor", "vício do produto", "fato do produto", "prática abusiva", "procon")):
        return "oab-direito-do-consumidor"
    if any(k in lower for k in ("eca", "estatuto da criança e do adolescente", "conselho tutelar", "ato infracional", "medida socioeducativa", "adoção", "guarda de menor", "criança e do adolescente")):
        return "oab-eca"
    if any(k in lower for k in ("direitos humanos", "pacto de san josé", "corte interamericana", "comissão interamericana", "onu", "tratado internacional de direitos humanos", "declaração universal")):
        return "oab-direitos-humanos"
    if any(k in lower for k in ("direito internacional", "extradição", "deportação", "expulsão", "lei de migração", "lindb", "homologação de sentença estrangeira", "imunidade de jurisdição", "cônsul", "embaixada", "nacionalidade")):
        return "oab-direito-internacional"
    if any(k in lower for k in ("tributo", "imposto", "icms", "iss", "iptu", "ipva", "itbi", "irpf", "contribuição de melhoria", "ctn", "código tributário", "fato gerador", "lançamento tributário", "execução fiscal", "imunidade tributária")):
        return "oab-direito-tributario"
    if any(k in lower for k in ("sociedade anônima", "sociedade limitada", "recuperação judicial", "falência", "título de crédito", "cheque", "duplicata", "nota promissória", "estabelecimento empresarial", "propriedade industrial", "marca", "patente", "empresário individual")):
        return "oab-direito-empresarial"
    if any(k in lower for k in ("reclamação trabalhista", "recurso ordinário", "tst", "trt", "vara do trabalho", "dissídio", "execução trabalhista", "audiência trabalhista", "processo do trabalho", "depósito recursal")):
        return "oab-direito-processual-do-trabalho"
    if any(k in lower for k in ("clt", "empregado", "empregador", "contrato de trabalho", "aviso prévio", "fgts", "férias", "adicional de insalubridade", "periculosidade", "justa causa", "jornada de trabalho", "salário")):
        return "oab-direito-do-trabalho"
    if any(k in lower for k in ("inquérito policial", "ação penal", "prisão preventiva", "prisão em flagrante", "tribunal do júri", "recurso em sentido estrito", "cpp", "código de processo penal", "audiência de custódia", "prova ilícita", "habeas corpus")):
        return "oab-direito-processual-penal"
    if any(k in lower for k in ("código penal", "homicídio", "furto", "roubo", "estelionato", "peculato", "legítima defesa", "estado de necessidade", "prescrição penal", "pena privativa", "dolo", "culpa", "tentativa", "concurso de crimes")):
        return "oab-direito-penal"
    if any(k in lower for k in ("cpc", "código de processo civil", "apelação", "agravo de instrumento", "embargos de declaração", "cumprimento de sentença", "tutela provisória", "litisconsórcio", "contestação", "reconvenção", "ação rescisória", "juizado especial cível")):
        return "oab-direito-processual-civil"
    if any(k in lower for k in ("licitação", "lei nº 14.133", "improbidade administrativa", "ato administrativo", "serviço público", "concessão", "desapropriação", "responsabilidade civil do estado", "servidor público", "autarquia", "administração pública")):
        return "oab-direito-administrativo"
    if any(k in lower for k in ("constituição federal", "adi", "adpf", "adc", "stf", "controle de constitucionalidade", "processo legislativo", "medida provisória", "estado de defesa", "estado de sítio", "mandado de segurança", "direito fundamental")):
        return "oab-direito-constitucional"
    if any(k in lower for k in ("código civil", "contrato", "usucapião", "propriedade", "posse", "casamento", "divórcio", "união estável", "sucessão", "herança", "testamento", "alimentos", "responsabilidade civil", "obrigação", "prescrição", "decadência")):
        return "oab-direito-civil"

    # Faixas oficiais FGV por bloco (respeitando diferença entre 37º e 38º-47º)
    if 1 <= num <= 8:
        return "oab-etica-profissional"
    if 9 <= num <= 10:
        return "oab-filosofia-do-direito"
    if exam_num >= 38:
        if 11 <= num <= 16:
            return "oab-direito-constitucional"
        if 17 <= num <= 18:
            return "oab-direitos-humanos"
        if 19 <= num <= 20:
            return "oab-direito-eleitoral"
        if 21 <= num <= 22:
            return "oab-direito-internacional"
        if 23 <= num <= 24:
            return "oab-direito-financeiro"
        if 25 <= num <= 29:
            return "oab-direito-tributario"
        if 30 <= num <= 34:
            return "oab-direito-administrativo"
        if 35 <= num <= 36:
            return "oab-direito-ambiental"
        if 37 <= num <= 42:
            return "oab-direito-civil"
        if 43 <= num <= 44:
            return "oab-eca"
        if 45 <= num <= 46:
            return "oab-direito-do-consumidor"
        if 47 <= num <= 50:
            return "oab-direito-empresarial"
        if 51 <= num <= 56:
            return "oab-direito-processual-civil"
        if 57 <= num <= 62:
            return "oab-direito-penal"
        if 63 <= num <= 68:
            return "oab-direito-processual-penal"
        if 69 <= num <= 70:
            return "oab-direito-previdenciario"
        if 71 <= num <= 75:
            return "oab-direito-do-trabalho"
        return "oab-direito-processual-do-trabalho"
    else:
        # 37º Exame (anterior à entrada de Eleitoral/Financeiro/Previdenciário)
        if 11 <= num <= 17:
            return "oab-direito-constitucional"
        if 18 <= num <= 19:
            return "oab-direitos-humanos"
        if 20 <= num <= 21:
            return "oab-direito-internacional"
        if 22 <= num <= 26:
            return "oab-direito-tributario"
        if 27 <= num <= 32:
            return "oab-direito-administrativo"
        if 33 <= num <= 34:
            return "oab-direito-ambiental"
        if 35 <= num <= 41:
            return "oab-direito-civil"
        if 42 <= num <= 43:
            return "oab-eca"
        if 44 <= num <= 45:
            return "oab-direito-do-consumidor"
        if 46 <= num <= 50:
            return "oab-direito-empresarial"
        if 51 <= num <= 57:
            return "oab-direito-processual-civil"
        if 58 <= num <= 63:
            return "oab-direito-penal"
        if 64 <= num <= 69:
            return "oab-direito-processual-penal"
        if 70 <= num <= 75:
            return "oab-direito-do-trabalho"
        return "oab-direito-processual-do-trabalho"


def extract_oab_questions(pdf_path: Path, answer_map: dict[int, str], exam_num: int) -> list[dict]:
    doc = fitz.open(str(pdf_path))
    column_chunks: list[tuple[int, str]] = []

    for p_idx in range(len(doc)):
        page = doc[p_idx]
        w, h = page.rect.width, page.rect.height
        txt_full = page.get_text("text")
        if p_idx == 0 and "Questão" not in txt_full and "1\n" not in txt_full and "\n1 " not in txt_full:
            continue
        left_rect = fitz.Rect(0, 40, w / 2, h - 28)
        right_rect = fitz.Rect(w / 2, 40, w, h - 28)
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
            if re.match(
                r"^(\d+º Exame de Ordem|ORDEM DOS ADVOGADOS|Tipo 1|Branca|FGV|Página \d+|EXAME DE ORDEM UNIFICADO|PROVA OBJETIVA)$",
                line,
                re.IGNORECASE,
            ):
                continue
            ordered_lines.append((page_num, line))

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
                "subjectSlug": classify_oab_20_disciplines(qnum, statement, exam_num),
                "pageNumber": page_num,
            }
        )

    return items


def main() -> None:
    summary = []
    for ex in OAB_EXAMS:
        num = ex["examNum"]
        ex_dir = OUT_DIR / f"oab_{num}"
        exam_pdf = ex_dir / f"OAB_{num}_TIPO1_BRANCA.pdf"
        key_pdf = ex_dir / f"OAB_{num}_GABARITO_DEFINITIVO.pdf"

        exam_sha = download_file(ex["examUrl"], exam_pdf)
        key_sha = download_file(ex["keyUrl"], key_pdf)

        if ex.get("annulmentNoticeUrl"):
            notice_pdf = ex_dir / f"OAB_{num}_COMUNICADO_ANULACAO.pdf"
            download_file(ex["annulmentNoticeUrl"], notice_pdf)

        answer_map, detected_date = parse_oab_gabarito_tipo1(key_pdf)
        # Se for 47º Exame, confirmar Q47 oficialmente anulada conforme comunicado 90523
        if num == 47 and answer_map.get(47) != "ANULADA":
            print(f"  [47º EOU] Atenção: gabarito Q47 lido como {answer_map.get(47)} — conferindo comunicado oficial...")

        items = extract_oab_questions(exam_pdf, answer_map, num)
        valid_4opts = [
            q for q in items if len(q["options"]) == 4 and len(q["statement"]) >= 20
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

        row = {
            "edition": ex["editionCode"],
            "year": ex["year"],
            "examDate": payload["examDate"],
            "answers": len(answer_map),
            "extracted": len(items),
            "complete": len(valid_4opts),
            "annulled": annulled,
        }
        summary.append(row)
        print(
            f"[OAB {num}º | {ex['year']} | {payload['examDate']}] Gab={len(answer_map)} | Ext={len(items)} | Valid={len(valid_4opts)}/80 | Anuladas={annulled}"
        )

    (OUT_DIR / "oab_batch_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nTotal extraído nos 10 novos exames OAB: {sum(r['complete'] for r in summary)}/800 questões válidas.")


if __name__ == "__main__":
    main()
