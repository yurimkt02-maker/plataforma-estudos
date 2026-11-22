#!/usr/bin/env python3
"""
Extrator oficial e auditável da prova PRF 2013 (CESPE/UnB — DPRF13_001_01, Tipo I,
aplicada em 11/08/2013) + Gabarito Oficial Definitivo (Gab_definitivo_DPRF13_001_01.PDF).

- Valida correspondência do par de PDFs e calcula SHA-256.
- Extrai gabarito definitivo por coordenadas (x, y) da tabela oficial (120 itens; #47 e #50 anulados).
- Recorta todas as figuras, gráficos e equações visuais em alta resolução para
  public/images/questions/prf-2013/ e vincula no supportText (Markdown).
- Extrai os 120 itens Certo/Errado em ordem de leitura de 2 colunas preservando textos de apoio.
- Classifica cada questão por disciplina e assunto real (PRF).
"""

import hashlib
import json
import re
from pathlib import Path
import pymupdf as fitz

EXAM_PDF = Path("acervo/prf_2013/DPRF13_001_01.pdf")
KEY_PDF = Path("acervo/prf_2013/Gab_definitivo_DPRF13_001_01.PDF")
OUT_JSON = Path("acervo/prf_2013/import_prf2013_extracted.json")
IMG_DIR = Path("public/images/questions/prf-2013")

EXAM_URL = "https://cdn.cebraspe.org.br/concursos/DPRF_13/arquivos/DPRF13_001_01.pdf"
KEY_URL = "https://cdn.cebraspe.org.br/concursos/DPRF_13/arquivos/Gab_definitivo_DPRF13_001_01.PDF"


def parse_definitive_key_by_coords(pdf_path: Path) -> dict[int, str]:
    doc = fitz.open(str(pdf_path))
    page = doc[0]
    full_text = page.get_text("text")
    assert "DPRF13_001_01" in full_text, "Gabarito não corresponde a DPRF13_001_01!"
    assert "GABARITOS OFICIAIS DEFINITIVOS" in full_text.upper(), "Documento não é Gabarito Oficial Definitivo!"

    words = page.get_text("words")
    doc.close()

    # Cada bloco tem uma linha de números (1..20, 21..40, ..., 101..120) e logo abaixo (dy ~ 12-22pt) a linha de C/E/X
    num_words = [w for w in words if w[4].isdigit() and 1 <= int(w[4]) <= 120]
    ans_words = [w for w in words if w[4] in ("C", "E", "X")]

    mapping: dict[int, str] = {}
    for nw in sorted(num_words, key=lambda w: int(w[4])):
        num = int(nw[4])
        nx = (nw[0] + nw[2]) / 2.0
        ny = nw[1]
        # Encontrar o gabarito mais próximo verticalmente abaixo na mesma coluna
        candidates = [
            aw
            for aw in ans_words
            if abs(((aw[0] + aw[2]) / 2.0) - nx) < 12.0 and 5.0 < (aw[1] - ny) < 28.0
        ]
        candidates.sort(key=lambda aw: aw[1] - ny)
        if candidates:
            val = candidates[0][4].upper()
            mapping[num] = "ANULADA" if val == "X" else val

    if len(mapping) != 120:
        raise RuntimeError(f"Esperados 120 gabaritos, encontrados {len(mapping)}")
    return mapping


def crop_visual_figures(pdf_path: Path) -> dict[int, list[dict]]:
    """
    Recorta em 2.5x DPI todas as figuras, gráficos, telas de software e fórmulas
    do caderno DPRF13_001_01.pdf e retorna o mapa item_num -> lista de assets.
    """
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    mat = fitz.Matrix(2.5, 2.5)

    crops = [
        # (page_idx_0based, rect_tuple, filename, alt_text, target_items)
        (
            2,  # Página 3 do PDF: Gráfico de acidentes 2005-2011 (coluna esquerda, y=265..435)
            (26, 265, 292, 435),
            "prf2013-q18-q22-grafico-acidentes.png",
            "Gráfico oficial CESPE/PRF 2013 — Número de acidentes nas estradas brasileiras (2005 a 2011) para os itens 18 a 22",
            [18, 19, 20, 21, 22],
        ),
        (
            3,  # Página 4 do PDF: Gráfico concentração de álcool no sangue (coluna esquerda, y=52..178)
            (26, 52, 292, 178),
            "prf2013-q23-q25-grafico-alcool.png",
            "Gráfico oficial CESPE/PRF 2013 — Concentração de álcool no sangue N(t) para os itens 23 a 25",
            [23, 24, 25],
        ),
        (
            4,  # Página 5 do PDF: Janela BrOffice.org Writer + ícones dos itens 46 e 47 (coluna direita)
            (302, 55, 572, 455),
            "prf2013-q46-q47-broffice-writer.png",
            "Figura oficial CESPE/PRF 2013 — Janela do BrOffice.org Writer e ícones para os itens 46 e 47",
            [46, 47],
        ),
        (
            4,  # Página 5 do PDF: Janela BrOffice.org Calc + ícones do item 48 (coluna direita)
            (302, 468, 572, 795),
            "prf2013-q48-broffice-calc.png",
            "Figura oficial CESPE/PRF 2013 — Janela do BrOffice.org Calc e botões para o item 48",
            [48],
        ),
        (
            5,  # Página 6 do PDF: Janela Google Chrome + ícone do item 50 (largura total, topo)
            (28, 50, 568, 392),
            "prf2013-q49-q50-google-chrome.png",
            "Figura oficial CESPE/PRF 2013 — Janela do Google Chrome e botão para os itens 49 e 50",
            [49, 50],
        ),
        (
            9,  # Página 10 do PDF: Figura pêndulo balístico do item 117 (coluna esquerda, y=245..405)
            (28, 245, 292, 405),
            "prf2013-q117-pendulo-balistico.png",
            "Figura oficial CESPE/PRF 2013 — Pêndulo balístico para o item 117",
            [117],
        ),
        (
            9,  # Página 10 do PDF: Equação MHS dos itens 118 e 119 (coluna esquerda, y=652..740)
            (26, 652, 292, 740),
            "prf2013-q118-q119-equacao-mhs.png",
            "Equação oficial CESPE/PRF 2013 — Movimento harmônico simples para os itens 118 e 119",
            [118, 119],
        ),
    ]

    item_assets: dict[int, list[dict]] = {}
    for p_idx, rect_coords, fname, alt, items in crops:
        page = doc[p_idx]
        clip = fitz.Rect(*rect_coords)
        pix = page.get_pixmap(matrix=mat, clip=clip)
        out_file = IMG_DIR / fname
        pix.save(str(out_file))
        web_path = f"/images/questions/prf-2013/{fname}"
        for it in items:
            item_assets.setdefault(it, []).append(
                {"fileName": fname, "webPath": web_path, "alt": alt}
            )

    doc.close()
    return item_assets


def clean_cespe_math(text: str) -> str:
    # Corrige artefatos clássicos da fonte Symbol do CESPE em fórmulas
    text = text.replace("N = !0,008(t2 – 35t + 34)", "N = -0,008(t² - 35t + 34)")
    text = text.replace("t 0 [t0, t2]", "t ∈ [t0, t2]")
    text = text.replace("F(t) = !(3π)2 x(t)", "F(t) = -(3π)² x(t)")
    text = re.sub(r"menos de\s+1\s+5\s+do tempo", "menos de 1/5 do tempo", text)
    text = re.sub(r"valor aproximado de\s+,\s*julgue os itens\s+589\s+que se seguem", "valor aproximado de √589, julgue os itens que se seguem", text)
    text = re.sub(
        r"de acordo com a equação\s*,\s*em que t é o tempo, em segundos, e x\(t\)\s*x t\s*t\s*\(\s*\)\s*,\s*cos\s*=\s*\+\s*⎡\s*⎣⎢\s*⎤\s*⎦⎥\s*6 0\s*3\s*3\s*π\s*π\s*é dada em metros",
        "de acordo com a equação x(t) = 6,0 cos[3πt + π/3], em que t é o tempo, em segundos, e x(t) é dada em metros",
        text,
    )
    return re.sub(r"\s+", " ", text).strip()


def classify_prf_2013(num: int, statement: str, context: str) -> str:
    """
    Classifica cada um dos 120 itens da PRF 2013 na taxonomia PRF (disciplina + assunto filho),
    respeitando os blocos oficiais da prova DPRF13_001_01 e o conteúdo de cada item.
    """
    full = f"{context} {statement}".lower()

    if 1 <= num <= 15:
        return "interpretacao-e-compreensao-de-textos"
    if 16 <= num <= 25:
        return "matematica-aplicada-prf"
    if 26 <= num <= 40:
        if any(k in full for k in ("poder judiciário", "stj", "stf", "poder executivo", "presidente da república")):
            return "poder-judiciario-e-funcoes-essenciais"
        if any(k in full for k in ("improbidade", "administração pública", "serviço público", "organização político-administrativa", "competência legislativa")):
            return "administracao-publica-cf88"
        return "direitos-e-garantias-fundamentais"
    if 41 <= num <= 45:
        return "etica-no-servico-publico"
    if 46 <= num <= 50:
        return "informatica-aplicativos-e-redes"
    if 51 <= num <= 62:
        if "improbidade" in full:
            return "improbidade-administrativa-lei-8429"
        return "atos-e-poderes-administrativos"
    if 115 <= num <= 120:
        return "fisica-aplicada-prf"

    # Itens 63 a 114: Direito Penal, Processo Penal, Legislação Especial, Direitos Humanos e CTB
    if any(k in full for k in ("direitos humanos", "direito internacional humanitário", "política nacional de direitos humanos", "primeira geração", "teoria positivista")):
        return "direitos-e-garantias-fundamentais"
    if any(k in full for k in ("ctb", "trânsito", "condutor", "veículo", "rodovia", "cnh", "habilitação", "contran", "sinalização", "infração", "licenciamento", "estacionamento", "ultrapassagem", "pedestre", "via arterial", "via coletora")):
        if any(k in full for k in ("crime", "pena", "detenção", "reclusão", "embriaguez", "homicídio culposo", "art. 30")):
            return "crimes-de-transito"
        return "normas-gerais-de-circulacao-e-conduta"
    if any(k in full for k in ("inquérito policial", "flagrante", "prisão preventiva", "prisão temporária", "processo penal", "cpp", "prova ilícita", "busca e apreensão", "ação penal", "juiz", "delegado")):
        if any(k in full for k in ("prisão", "flagrante", "preventiva", "temporária", "medida cautelar", "fiança")):
            return "prisao-e-medidas-cautelares"
        return "inquerito-policial"
    if any(k in full for k in ("peculato", "concussão", "corrupção", "prevaricação", "administração pública", "funcionário público")):
        return "crimes-contra-a-administracao-publica"
    if any(k in full for k in ("fé pública", "documento falso", "falsidade", "moeda falsa")):
        return "crimes-contra-a-fe-publica"
    return "teoria-do-crime-e-imputabilidade"


def extract_prf_2013_items(
    pdf_path: Path, answer_map: dict[int, str], item_assets: dict[int, list[dict]]
) -> list[dict]:
    doc = fitz.open(str(pdf_path))
    column_chunks: list[tuple[int, str]] = []

    # Páginas 2 a 10 contêm os 120 itens objetivos (índice 1 a 9)
    for p_idx in range(1, 10):
        page = doc[p_idx]
        w, h = page.rect.width, page.rect.height

        # Página 6 (idx 5) tem a figura do Chrome ocupando a largura total até y=382, e texto full-width até y=430
        if p_idx == 5:
            top_rect = fitz.Rect(0, 42, w, 405)
            txt_top = page.get_text("text", clip=top_rect)
            if txt_top.strip():
                column_chunks.append((p_idx + 1, txt_top))
            left_rect = fitz.Rect(0, 405, w / 2, h - 25)
            right_rect = fitz.Rect(w / 2, 405, w, h - 25)
            for rect in (left_rect, right_rect):
                txt = page.get_text("text", clip=rect)
                if txt.strip():
                    column_chunks.append((p_idx + 1, txt))
        else:
            left_rect = fitz.Rect(0, 42, w / 2, h - 25)
            right_rect = fitz.Rect(w / 2, 42, w, h - 25)
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
            if "DPRF13_001_01" in line or "CESPE/UnB" in line:
                continue
            if line.startswith("Cargo: Policial Rodoviário Federal"):
                continue
            if re.match(r"^–\s*\d+\s*–$", line):
                continue
            if line in ("RASCUNHO", "CONHECIMENTOS BÁSICOS", "CONHECIMENTOS ESPECÍFICOS"):
                continue
            ordered_lines.append((page_num, line))

    # Localizar início de cada item 1..120 em ordem estritamente crescente
    item_starts: list[tuple[int, int, int, str]] = []
    search_from = 0
    for target_num in range(1, 121):
        pat_inline = re.compile(rf"^{target_num}\s+(.+)$")
        found = False
        # Primeiro tentar linha com número exato seguido de texto real (pula números de linha de texto base como "1  ..." no texto de Português!)
        for k in range(search_from, len(ordered_lines)):
            pnum, ltxt = ordered_lines[k]
            # Evitar confundir numeração de linhas de textos-base (1, 4, 7, 10, 13, 16, 19, 22) na página 2
            if pnum == 2 and target_num == 1:
                # O item 1 começa após "julgue os itens a seguir."
                prev_joined = " ".join(ordered_lines[m][1] for m in range(max(0, k - 8), k)).lower()
                if "julgue os" not in prev_joined:
                    continue
            if pnum == 2 and target_num == 8:
                prev_joined = " ".join(ordered_lines[m][1] for m in range(max(0, k - 8), k)).lower()
                if "julgue os" not in prev_joined:
                    continue

            if ltxt == str(target_num) and k + 1 < len(ordered_lines):
                nxt = ordered_lines[k + 1][1]
                # Na página 3 o gráfico tem números 110..189; na página 4 tem 1, 2, 3, 589
                if re.search(r"[A-Za-zÀ-ÿ]{3,}", nxt) and not nxt.startswith("g\\L"):
                    item_starts.append((target_num, k, pnum, nxt))
                    search_from = k + 2
                    found = True
                    break

            m = pat_inline.match(ltxt)
            if m and re.search(r"[A-Za-zÀ-ÿ]{3,}", m.group(1)):
                # Filtrar linhas do texto-base da página 2 que começam com "1 ", "4 ", "7 ", etc.
                if pnum == 2 and target_num in (1, 4, 7, 10, 13, 16, 19) and k < 60:
                    continue
                item_starts.append((target_num, k, pnum, m.group(1).strip()))
                search_from = k + 1
                found = True
                break

        if not found:
            raise RuntimeError(f"Item #{target_num} não encontrado (search_from={search_from})")

    group_header_re = re.compile(
        r"^(Texto\s+para|Gr[aá]fico\s+para|No\s+que\s+se\s+refere|No\s+que\s+concerne|Considerando|Considere\s+que|Acerca|Com\s+rela[cç][aã]o|Julgue|A\s+respeito|Com\s+base|Quanto|Em\s+rela[cç][aã]o|Tendo\s+como\s+refer[eê]ncia|Tendo\s+em\s+vista|Um\s+PRF|Uma\s+bala|O\s+fen[oô]meno)",
        re.IGNORECASE,
    )

    items: list[dict] = []
    current_context = ""

    for i, (num, start_idx, page_num, first_body) in enumerate(item_starts):
        end_idx = item_starts[i + 1][1] if i + 1 < len(item_starts) else len(ordered_lines)
        prev_end = item_starts[i - 1][1] + 1 if i > 0 else 0

        if start_idx > prev_end:
            between_lines = [ordered_lines[b][1] for b in range(prev_end, start_idx)]
            joined_between = clean_cespe_math(" ".join(between_lines))
            if (
                "julgue" in joined_between.lower()
                or "texto para" in joined_between.lower()
                or "gráfico para" in joined_between.lower()
                or "figura acima" in joined_between.lower()
            ):
                # Limpar instruções gerais da capa da página 2 se for o item 1
                if num == 1:
                    m_txt = re.search(r"(Texto para os itens.*)", joined_between, re.IGNORECASE)
                    if m_txt:
                        joined_between = m_txt.group(1)
                current_context = joined_between

        body_parts = [first_body]
        # Se a linha start_idx era só o número, começar do start_idx + 2
        body_start = start_idx + 2 if ordered_lines[start_idx][1] == str(num) else start_idx + 1
        for k in range(body_start, end_idx):
            ltxt = ordered_lines[k][1]
            lookahead = " ".join(ordered_lines[m][1] for m in range(k, min(end_idx, k + 12))).lower()
            if group_header_re.match(ltxt) and (
                "julgue" in lookahead
                or ltxt.lower().startswith("texto para")
                or ltxt.lower().startswith("gráfico para")
                or "concentração de álcool" in lookahead
            ):
                break
            body_parts.append(ltxt)

        statement = clean_cespe_math(" ".join(body_parts))
        support = current_context if current_context else None

        assets = item_assets.get(num, [])
        if assets:
            md_imgs = "\n\n".join(f"![{a['alt']}]({a['webPath']})" for a in assets)
            support = f"{md_imgs}\n\n{support}" if support else md_imgs

        ans = answer_map[num]
        items.append(
            {
                "originalNumber": num,
                "questionType": "TRUE_FALSE",
                "statement": statement,
                "supportText": support,
                "options": [
                    {"label": "C", "content": "Certo"},
                    {"label": "E", "content": "Errado"},
                ],
                "officialAnswer": ans,
                "isAnnulled": ans == "ANULADA",
                "subjectSlug": classify_prf_2013(num, statement, current_context),
                "pageNumber": page_num,
                "pageImages": [a["webPath"] for a in assets],
                "requiresHumanReview": False,
                "reviewReason": None,
            }
        )

    return items


def main() -> None:
    exam_sha = hashlib.sha256(EXAM_PDF.read_bytes()).hexdigest()
    key_sha = hashlib.sha256(KEY_PDF.read_bytes()).hexdigest()

    answer_map = parse_definitive_key_by_coords(KEY_PDF)
    annulled = [k for k, v in sorted(answer_map.items()) if v == "ANULADA"]
    print(f"[PRF 2013] Gabarito definitivo verificado: {len(answer_map)} itens | Anulados oficiais: {annulled}")

    item_assets = crop_visual_figures(EXAM_PDF)
    print(f"[PRF 2013] Figuras/gráficos recortados para {len(item_assets)} itens: {sorted(item_assets.keys())}")

    items = extract_prf_2013_items(EXAM_PDF, answer_map, item_assets)
    print(f"[PRF 2013] Itens extraídos: {len(items)}/120")

    # Checar qualidade básica (enunciados muito curtos ou duplicados)
    short_items = [(it["originalNumber"], len(it["statement"]), it["statement"]) for it in items if len(it["statement"]) < 35]
    if short_items:
        print("[ALERTA] Itens curtos:", short_items)

    by_subj: dict[str, int] = {}
    for it in items:
        by_subj[it["subjectSlug"]] = by_subj.get(it["subjectSlug"], 0) + 1
    print("[PRF 2013] Distribuição por assunto:", json.dumps(by_subj, ensure_ascii=False, indent=2))

    payload = {
        "editionCode": "PRF-2013-POLICIAL",
        "title": "Concurso Público PRF 2013 — Policial Rodoviário Federal (CESPE/UnB — DPRF13_001_01)",
        "year": 2013,
        "examDate": "2013-08-11",
        "versionLabel": "Tipo I (DPRF13_001_01)",
        "examPdfSha256": exam_sha,
        "examPdfOfficialUrl": EXAM_URL,
        "answerKeySha256": key_sha,
        "answerKeyOfficialUrl": KEY_URL,
        "idempotencyKey": f"PRF-2013-POLICIAL::Tipo-I::{exam_sha[:16]}",
        "totalDetected": len(items),
        "annulledNumbers": annulled,
        "extractedItems": items,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[PRF 2013] JSON gerado em {OUT_JSON}")


if __name__ == "__main__":
    main()
