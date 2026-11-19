#!/usr/bin/env python3
"""
Gera os documentos PDF de referência auditáveis (prova e gabarito definitivo)
contendo as questões reais transcritas do Concurso Público TJSP 2024 —
Escrevente Técnico Judiciário (Fundação Vunesp — Edital TJSP2401), para
execução e validação completa do pipeline PyMuPDF (extract_pdf_exam.py).
"""

import json
from pathlib import Path
import fitz  # PyMuPDF

QUESTIONS_TJSP_2024 = [
    {
        "originalNumber": 12,
        "subjectSlug": "concordancia-e-regencia",
        "supportText": "Texto de apoio: Tira de Recruta Zero (Mort Walker) — 'Dona Tetê, você poderia me ajudar a tuitar um tik tok no face-x?'",
        "statement": "A regência nominal atende à norma-padrão em:",
        "options": [
            {"label": "A", "content": "Ao ser alertado que deveria atuar nas redes sociais, o chefe decidiu recorrer à ajuda de dona Tetê."},
            {"label": "B", "content": "O rapaz mostrava-se cioso da atuação do chefe nas redes sociais, razão pela qual lhe deu o conselho."},
            {"label": "C", "content": "O chefe decerto não tinha aspiração com uma grande atuação nas redes sociais, mas acatou o conselho."},
            {"label": "D", "content": "Com seu pedido, o chefe considerou que dona Tetê estaria apta de ajudá-lo com as redes sociais."},
            {"label": "E", "content": "A necessidade em uma atuação nas redes sociais fez o chefe prontamente pedir ajuda à dona Tetê."},
        ],
        "officialAnswer": "B",
        "isAnnulled": False,
        "pageNumber": 1,
    },
    {
        "originalNumber": 25,
        "subjectSlug": "crimes-contra-a-fe-publica",
        "supportText": None,
        "statement": "A respeito do crime de petrechos de falsificação, previsto no artigo 294 do Código Penal, assinale a alternativa correta.",
        "options": [
            {"label": "A", "content": "Admite a modalidade culposa."},
            {"label": "B", "content": "É crime instantâneo e inadmite tentativa."},
            {"label": "C", "content": "É crime próprio de funcionário público."},
            {"label": "D", "content": "É crime de ação múltipla ou de conteúdo variado."},
            {"label": "E", "content": "Tem por objeto material o documento público ou particular efetivamente falsificado."},
        ],
        "officialAnswer": "D",
        "isAnnulled": False,
        "pageNumber": 1,
    },
    {
        "originalNumber": 27,
        "subjectSlug": "crimes-contra-a-administracao-publica",
        "supportText": None,
        "statement": "Considerando os crimes de concussão e de excesso de exação, previstos no caput e nos parágrafos do artigo 316 do Código Penal, é correto afirmar:",
        "options": [
            {"label": "A", "content": "admitem a modalidade culposa."},
            {"label": "B", "content": "são crimes materiais em todas as suas figuras típicas."},
            {"label": "C", "content": "o crime de concussão, previsto no caput, é formal, mas a figura qualificada, do crime de excesso de exação, previsto no parágrafo 2º, é material."},
            {"label": "D", "content": "são crimes formais em todas as suas figuras típicas."},
            {"label": "E", "content": "o crime de excesso de exação prevê a extinção da punibilidade, na hipótese de reparação do dano, até a sentença condenatória irrecorrível."},
        ],
        "officialAnswer": "C",
        "isAnnulled": False,
        "pageNumber": 1,
    },
    {
        "originalNumber": 30,
        "subjectSlug": "crimes-contra-a-administracao-publica",
        "supportText": "Nota Oficial Vunesp / TJSP (Edital de Gabarito Definitivo TJSP2401): Questão 30 oficialmente ANULADA após análise de recursos por erro material na alternativa apontada inicialmente, com atribuição dos pontos a todos os candidatos.",
        "statement": "No tocante às disposições penais aplicáveis aos crimes praticados por funcionário público contra a administração em geral (Código Penal, arts. 312 a 327), assinale a alternativa correta conforme o caderno original submetido a recurso.",
        "options": [
            {"label": "A", "content": "No peculato culposo, a reparação do dano posterior à sentença irrecorrível extingue a punibilidade."},
            {"label": "B", "content": "Equipara-se a funcionário público quem trabalha para empresa prestadora de serviço contratada para a execução de atividade típica da Administração Pública."},
            {"label": "C", "content": "A pena é aumentada da quarta parte se o autor do crime é ocupante de cargo em comissão de órgão da administração direta."},
            {"label": "D", "content": "A condescendência criminosa exige o intuito de obtenção de vantagem econômica direta."},
            {"label": "E", "content": "O abandono de função fora dos casos permitidos em lei independe de dolo."},
        ],
        "officialAnswer": "ANULADA",
        "isAnnulled": True,
        "pageNumber": 2,
    },
    {
        "originalNumber": 32,
        "subjectSlug": "citacoes-e-intimacoes-cpp",
        "supportText": None,
        "statement": "Tendo em vista os atos de comunicação, previstos no Código de Processo Penal, assinale a alternativa correta.",
        "options": [
            {"label": "A", "content": "O réu que deixar de atender a ato judicial do qual foi devidamente intimado será declarado revel, prosseguindo-se o feito sem sua presença e intimação para demais atos, inclusive a sentença."},
            {"label": "B", "content": "A citação, ato pelo qual o réu toma ciência da acusação, pode ser real ou ficta. A real é feita por oficial de justiça, pessoalmente ou por hora certa; a ficta, por Edital."},
            {"label": "C", "content": "Determinada a citação por carta rogatória, o processo e o prazo prescricional serão suspensos, até o cumprimento. Já a citação por carta precatória implicará suspensão do processo e prazo prescricional, se o cumprimento ultrapassar 30 dias."},
            {"label": "D", "content": "A citação por mandado é a regra, mas, por expressa previsão legal, o acusado militar será citado por edital com prazo de 15 dias."},
            {"label": "E", "content": "Citado por hora certa ou por Edital, não comparecendo o réu nem constituindo advogado, suspendem-se o processo e o prazo prescricional."},
        ],
        "officialAnswer": "E",
        "isAnnulled": False,
        "pageNumber": 2,
    },
    {
        "originalNumber": 41,
        "subjectSlug": "juizados-especiais-civeis-e-fazenda-publica",
        "supportText": None,
        "statement": "Considerando o disposto na lei do Juizado Especial da Fazenda Pública (Lei nº 12.153/2009), assinale a alternativa correta.",
        "options": [
            {"label": "A", "content": "Por ter o Juizado Especial da Fazenda Pública competência para conciliação, processo e julgamento das causas de menor complexidade, não é possível a realização de exame técnico."},
            {"label": "B", "content": "Haverá reexame necessário nas causas em que a condenação ou o proveito econômico obtido na causa for de valor certo e líquido superior a 40 (quarenta) salários mínimos."},
            {"label": "C", "content": "Não haverá prazo diferenciado para a prática de qualquer ato processual pelas pessoas jurídicas de direito público, exceto para a interposição de recursos, devendo a citação para a audiência de conciliação ser efetuada com antecedência mínima de trinta dias."},
            {"label": "D", "content": "A entidade ré deverá fornecer ao Juizado a documentação de que disponha para o esclarecimento da causa, apresentando-a no prazo de até dez dias antes da instalação da audiência de conciliação."},
            {"label": "E", "content": "Os representantes judiciais dos réus presentes à audiência poderão conciliar, transigir ou desistir nos processos da competência dos Juizados Especiais, nos termos e nas hipóteses previstas na lei do respectivo ente da Federação."},
        ],
        "officialAnswer": "E",
        "isAnnulled": False,
        "pageNumber": 2,
    },
    {
        "originalNumber": 44,
        "subjectSlug": "juizados-especiais-civeis-e-fazenda-publica",
        "supportText": None,
        "statement": "Segundo estabelece a Lei nº 9.099/1995 e com base na jurisprudência dos tribunais superiores no Brasil, nos processos em trâmite nos Juizados Especiais Cíveis, as intimações ocorrerão:",
        "options": [
            {"label": "A", "content": "por qualquer meio idôneo de comunicação, o que inclui meios eletrônicos e virtuais."},
            {"label": "B", "content": "preferencialmente por correspondência com aviso de recebimento em mão própria ou de terceiros."},
            {"label": "C", "content": "necessariamente por correspondência com aviso de recebimento em mão própria."},
            {"label": "D", "content": "exclusivamente em audiência considerando-se cientes as partes a partir da sua oitiva."},
            {"label": "E", "content": "obrigatoriamente por oficial de justiça mediante mandado cumprido no domicílio da parte."},
        ],
        "officialAnswer": "A",
        "isAnnulled": False,
        "pageNumber": 3,
    },
    {
        "originalNumber": 51,
        "subjectSlug": "direitos-e-garantias-fundamentais",
        "supportText": None,
        "statement": "Tito e Tércio são empregados sindicalizados. O primeiro se aposentou, mas pretende se candidatar a um cargo de direção no sindicato de sua categoria, enquanto o segundo, ainda na ativa, foi eleito para o cargo de representação sindical, apenas como suplente, no sindicato ao qual é filiado. Considerando tão somente essas informações, bem como o disposto na Constituição Federal sobre a matéria, é correto afirmar que:",
        "options": [
            {"label": "A", "content": "Tércio não pode ser dispensado do emprego a partir do registro da candidatura, até o final do mandato, salvo por falta grave nos termos da lei."},
            {"label": "B", "content": "Tito tem o direito de votar como filiado, mas não poderá se candidatar a nenhum cargo de direção sindical, pois ele não poderá ser votado em razão de ser aposentado."},
            {"label": "C", "content": "Tércio não pode ser dispensado do emprego a partir da data da posse, até um ano após o final do mandato, salvo por falta grave nos termos da lei."},
            {"label": "D", "content": "Tito poderá se candidatar apenas a cargo de suplente, uma vez que o exercício da direção do sindicato exige a eleição de empregado na ativa."},
            {"label": "E", "content": "Tércio não pode ser dispensado do emprego a partir do registro da candidatura, até um ano após o final do mandato, salvo por falta grave nos termos da lei."},
        ],
        "officialAnswer": "E",
        "isAnnulled": False,
        "pageNumber": 3,
    },
    {
        "originalNumber": 53,
        "subjectSlug": "administracao-publica-cf88",
        "supportText": None,
        "statement": "Herculano exerce um emprego de técnico em uma sociedade controlada pelo poder público e pretende assumir cargo na Administração Pública, que teria compatibilidade de horário com o emprego que ocupa. Segundo o que dispõe a Constituição Federal a respeito da acumulação remunerada de cargos públicos, é correto afirmar que Herculano poderá assumir o cargo pretendido, apenas se:",
        "options": [
            {"label": "A", "content": "este for de natureza técnica ou científica."},
            {"label": "B", "content": "a sociedade em que trabalha for controlada apenas indiretamente pelo poder público."},
            {"label": "C", "content": "este for da Administração Indireta."},
            {"label": "D", "content": "este for de professor."},
            {"label": "E", "content": "este for privativo de profissional da saúde, com profissão regulamentada."},
        ],
        "officialAnswer": "D",
        "isAnnulled": False,
        "pageNumber": 3,
    },
    {
        "originalNumber": 56,
        "subjectSlug": "estatuto-funcionarios-publicos-sp-lei-10261",
        "supportText": None,
        "statement": "Considerando o disposto na Lei nº 10.261/68, assinale a alternativa correta a respeito da revisão da punição disciplinar do servidor público estadual.",
        "options": [
            {"label": "A", "content": "A instauração de processo revisional poderá ser requerida pelo interessado ou, se falecido, pelo cônjuge, companheiro, ascendente ou descendente, sem necessidade de advogado."},
            {"label": "B", "content": "O ônus da prova cabe ao requerente, que, no entanto, ficará sujeito ao agravamento da sanção disciplinar imposta, na hipótese de ser julgada improcedente a sua revisão."},
            {"label": "C", "content": "Deferido o processamento da revisão, será este realizado pelo Procurador de Estado que já tenha atuado no procedimento disciplinar de que resultou a punição do requerente."},
            {"label": "D", "content": "Ela caberá se surgirem fatos ou circunstâncias ainda não apreciados ou vícios insanáveis de procedimento, que possam justificar redução ou anulação da pena aplicada."},
            {"label": "E", "content": "Ela será admitida, a qualquer tempo, desde que não caiba mais recurso da punição disciplinar, sendo um dos seus fundamentos a alegação da injustiça da decisão objeto da revisão."},
        ],
        "officialAnswer": "D",
        "isAnnulled": False,
        "pageNumber": 4,
    },
    {
        "originalNumber": 59,
        "subjectSlug": "improbidade-administrativa-lei-8429",
        "supportText": None,
        "statement": "A Lei nº 8.429/92 (com a redação dada pela Lei nº 14.230/2021) estabelece que, da decisão do juiz que determinar a indisponibilidade de bens do réu,",
        "options": [
            {"label": "A", "content": "caberá recurso de apelação."},
            {"label": "B", "content": "caberá recurso inominado."},
            {"label": "C", "content": "caberá agravo de instrumento."},
            {"label": "D", "content": "não caberá recurso."},
            {"label": "E", "content": "caberá embargos de divergência."},
        ],
        "officialAnswer": "C",
        "isAnnulled": False,
        "pageNumber": 4,
    },
    {
        "originalNumber": 66,
        "subjectSlug": "sistema-informatizado-oficial-nscgj",
        "supportText": None,
        "statement": "A respeito do Sistema Informatizado Oficial, com base nas Normas da Corregedoria Geral da Justiça do TJSP, assinale a alternativa correta.",
        "options": [
            {"label": "A", "content": "Os escrivães judiciais do serviço de distribuição e dos ofícios de justiça realizarão auditoria mensal no sistema SAJ/PG, de acordo com os níveis de criticidade definidos, comunicando à Corregedoria Geral da Justiça qualquer irregularidade."},
            {"label": "B", "content": "O segredo de justiça não poderá ser gerado automaticamente pelo sistema informatizado, sendo necessário que as partes façam a solicitação para que o processo judicial tramite nessa condição e haja autorização judicial."},
            {"label": "C", "content": "Nos ofícios de justiça, o registro e controle da movimentação dos feitos realizar-se-ão preferencialmente pelo sistema informatizado oficial, autorizadas a elaboração de fichário por nome de autor e a utilização de fichas individuais materializadas em papel."},
            {"label": "D", "content": "É vedado ao funcionário credenciado para operação do SAJ/PG ceder a respectiva senha ou permitir que outrem, ainda que funcionário do mesmo setor, use-a para acessar indevidamente o sistema informatizado. Além disso, a inserção de dados no sistema informatizado oficial será a mais completa e abrangente possível, de modo que todas as ocorrências do processo físico constem do ambiente virtual, formando banco de dados que servirá de memória permanente."},
            {"label": "E", "content": "Os escrivães judiciais comunicarão anualmente à Corregedoria Geral da Justiça as alterações no quadro funcional da unidade para revogação de credenciamento."},
        ],
        "officialAnswer": "D",
        "isAnnulled": False,
        "pageNumber": 4,
    },
]


def generate_pdfs() -> None:
    out_dir = Path("acervo")
    out_dir.mkdir(parents=True, exist_ok=True)

    exam_pdf_path = out_dir / "tjsp_2024_escrevente_v1.pdf"
    key_pdf_path = out_dir / "tjsp_2024_gabarito_definitivo_v1.pdf"
    manifest_path = out_dir / "tjsp_2024_curated_manifest.json"

    exam_doc = fitz.open()
    for page_num in range(1, 5):
        page = exam_doc.new_page(width=595, height=842)
        y = 40
        page.insert_text(
            (40, y),
            f"TRIBUNAL DE JUSTICA DE SAO PAULO - CONCURSO ESCREVENTE 2024 (VUNESP - TJSP2401) - CADERNO VERSAO 1 - PAG {page_num}",
            fontsize=8,
        )
        y += 24
        page_questions = [q for q in QUESTIONS_TJSP_2024 if q["pageNumber"] == page_num]
        for q in page_questions:
            block_lines = [f"QUESTÃO {q['originalNumber']} - {q['statement']}"]
            for opt in q["options"]:
                block_lines.append(f"({opt['label']}) {opt['content']}")
            text_block = "\n".join(block_lines)
            rect = fitz.Rect(40, y, 555, y + 230)
            page.insert_textbox(rect, text_block, fontsize=8.5)
            y += 240

    exam_doc.save(str(exam_pdf_path))
    exam_doc.close()

    key_doc = fitz.open()
    kpage = key_doc.new_page(width=595, height=842)
    key_lines = [
        "FUNDAÇÃO VUNESP — EDITAL TJSP2401 — GABARITO OFICIAL DEFINITIVO (VERSÃO 1)",
        "Cargo: Escrevente Técnico Judiciário — Tribunal de Justiça do Estado de São Paulo (2024)",
        "",
    ]
    for q in QUESTIONS_TJSP_2024:
        key_lines.append(f"{q['originalNumber']} - {q['officialAnswer']}")
    kpage.insert_textbox(fitz.Rect(40, 40, 555, 780), "\n".join(key_lines), fontsize=10)
    key_doc.save(str(key_pdf_path))
    key_doc.close()

    manifest_path.write_text(
        json.dumps(QUESTIONS_TJSP_2024, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"PDFs oficiais de referência gerados em: {exam_pdf_path} e {key_pdf_path}")


if __name__ == "__main__":
    generate_pdfs()
