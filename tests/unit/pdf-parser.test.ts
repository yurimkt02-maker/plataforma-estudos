import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_PENDING_SLUG,
  detectMissingVisualOrTable,
  extractPdfPages,
  inferSubjectSlugFromText,
  parseAnswerKeyText,
  parseExamBookletText,
} from "@/features/imports/pdf-parser";

describe("Parser Serverless de PDFs Oficiais (Vunesp / FGV / Cebraspe)", () => {
  it("extrai gabarito definitivo Vunesp com questões anuladas (TJSP 24/11/2024)", () => {
    const vunespKeyText = `
      FUNDAÇÃO VUNESP — TJSP2401 — GABARITO DEFINITIVO (24/11/2024)
      VERSÃO 1
      01 - B   02 - D   21 - ANULADA   25 - D   80 - ANULADA
    `;
    const map = parseAnswerKeyText(vunespKeyText, "MULTIPLE_CHOICE", "Versão 1");
    expect(map[1]).toEqual({ answerValue: "B", isAnnulled: false });
    expect(map[2]).toEqual({ answerValue: "D", isAnnulled: false });
    expect(map[21]).toEqual({ answerValue: "ANULADA", isAnnulled: true });
    expect(map[25]).toEqual({ answerValue: "D", isAnnulled: false });
    expect(map[80]).toEqual({ answerValue: "ANULADA", isAnnulled: true });
  });

  it("extrai questões Vunesp (A-E), preserva texto de apoio e sinaliza CLASSIFICATION_PENDING quando assunto não é inequívoco", () => {
    const pages = [
      `
      FUNDAÇÃO VUNESP
      Leia o texto a seguir para responder às questões 01 e 02. O debate contemporâneo sobre políticas públicas exige análise rigorosa.
      QUESTÃO 01 - Considerando o disposto na Lei nº 10.261/68, assinale a alternativa correta a respeito da revisão da punição disciplinar.
      (A) A instauração depende de advogado constituído.
      (B) A sanção disciplinar pode ser agravada em revisão.
      (C) O Procurador que atuou no PAD conduzirá a revisão.
      (D) Caberá revisão quando surgirem fatos ou circunstâncias ainda não apreciados ou vícios insanáveis.
      (E) A alegação de injustiça da decisão é fundamento suficiente.
      QUESTÃO 02 - Assinale a alternativa correta segundo o caso hipotético apresentado na tabela abaixo sobre receitas municipais.
      (A) Opção A detalhada.
      (B) Opção B detalhada.
      (C) Opção C detalhada.
      (D) Opção D detalhada.
      (E) Opção E detalhada.
      `,
    ];

    const answerMap = {
      1: { answerValue: "D", isAnnulled: false },
      2: { answerValue: "C", isAnnulled: false },
    };

    const items = parseExamBookletText({
      pages,
      answerMap,
      questionType: "MULTIPLE_CHOICE",
    });

    expect(items).toHaveLength(2);
    expect(items[0]?.subjectSlug).toBe("estatuto-funcionarios-publicos-sp-lei-10261");
    expect(items[0]?.classificationStatus).toBe("CLASSIFIED");
    expect(items[0]?.supportText).toContain("Leia o texto a seguir");

    // Questão 02 não tem assunto jurídico inequívoco -> CLASSIFICATION_PENDING e sinalização de tabela!
    expect(items[1]?.subjectSlug).toBe(CLASSIFICATION_PENDING_SLUG);
    expect(items[1]?.classificationStatus).toBe("CLASSIFICATION_PENDING");
    expect(items[1]?.hasMissingVisualOrTable).toBe(true);
    expect(items[1]?.visualWarning).toContain("tabela abaixo");
  });

  it("NÃO classifica automaticamente por carreira (PRF/OAB) quando o assunto não está explícito", () => {
    const genericPrf = inferSubjectSlugFromText(
      "Um projétil de massa igual a 15 g desloca-se horizontalmente com velocidade constante."
    );
    expect(genericPrf.subjectSlug).toBe(CLASSIFICATION_PENDING_SLUG);
    expect(genericPrf.classificationStatus).toBe("CLASSIFICATION_PENDING");

    const genericOab = inferSubjectSlugFromText(
      "Joana celebrou contrato de compra e venda de imóvel com cláusula resolutiva expressa."
    );
    expect(genericOab.subjectSlug).toBe(CLASSIFICATION_PENDING_SLUG);
    expect(genericOab.classificationStatus).toBe("CLASSIFICATION_PENDING");
  });

  it("detecta referências visuais/tabulares (figura, gráfico, charge, tabela)", () => {
    expect(
      detectMissingVisualOrTable("Observe a figura a seguir que representa um gráfico.").hasMissingVisualOrTable
    ).toBe(true);
    expect(
      detectMissingVisualOrTable("Assinale a alternativa correta sobre o prazo recursal.").hasMissingVisualOrTable
    ).toBe(false);
  });

  it("extrai gabarito tabular FGV isolando corretamente a seção Tipo 1", () => {
    const fgvText = `
      41º EXAME DE ORDEM UNIFICADO - PROVA TIPO 1
      1 2 3 4 5
      B A B D A
      41º EXAME DE ORDEM UNIFICADO - PROVA TIPO 2
      1 2 3 4 5
      A B B C D
    `;
    const map = parseAnswerKeyText(fgvText, "MULTIPLE_CHOICE", "Tipo 1 - Branca");
    expect(map[1]?.answerValue).toBe("B");
    expect(map[4]?.answerValue).toBe("D");
    expect(map[5]?.answerValue).toBe("A");
  });

  it("interrompe a leitura na seção de Redação/Rascunho e limita texto de apoio ao intervalo declarado", () => {
    const pages = [
      `
      LÍNGUA PORTUGUESA
      Leia o texto para responder às questões de números 01 e 02.
      Texto base sobre interpretação administrativa.
      01. Primeira questão referente ao texto base de língua portuguesa.
      (A) Alternativa A1.
      (B) Alternativa B1.
      (C) Alternativa C1.
      (D) Alternativa D1.
      (E) Alternativa E1.
      02. Segunda questão referente ao texto base de língua portuguesa.
      (A) Alternativa A2.
      (B) Alternativa B2.
      (C) Alternativa C2.
      (D) Alternativa D2.
      (E) Alternativa E2.
      INFORMÁTICA
      03. Considere a planilha elaborada no Microsoft Excel 365 apresentada a seguir.
      (A) Alternativa A3.
      (B) Alternativa B3.
      (C) Alternativa C3.
      (D) Alternativa D3.
      (E) Alternativa E3.
      `,
      `
      REDAÇÃO EM LÍNGUA PORTUGUESA
      FOLHA DE RASCUNHO
      04
      05
      `,
    ];

    const items = parseExamBookletText({
      pages,
      answerMap: {
        1: { answerValue: "A", isAnnulled: false },
        2: { answerValue: "B", isAnnulled: false },
        3: { answerValue: "C", isAnnulled: false },
      },
      questionType: "MULTIPLE_CHOICE",
    });

    expect(items).toHaveLength(3);
    expect(items[0]?.supportText).toContain("Texto base sobre interpretação");
    expect(items[1]?.supportText).toContain("Texto base sobre interpretação");
    expect(items[2]?.supportText).toBeUndefined();
    expect(items[2]?.hasMissingVisualOrTable).toBe(true);
    expect(items[2]?.visualWarning).toContain("planilha");
  });

  it("extrai todas as 70/70 questões do caderno real TJSP 2025 (duas colunas) em ordem exata com alternativas A–E", async () => {
    const provaPath = path.resolve(
      process.cwd(),
      "acervo/tjsp_2025/tjsp2503_prova_uploaded.pdf"
    );
    const gabaritoPath = path.resolve(
      process.cwd(),
      "acervo/tjsp_2025/tjsp2503_gabarito_uploaded.pdf"
    );

    if (!fs.existsSync(provaPath) || !fs.existsSync(gabaritoPath)) {
      return;
    }

    const provaPages = await extractPdfPages(fs.readFileSync(provaPath));
    const gabaritoPages = await extractPdfPages(fs.readFileSync(gabaritoPath));
    const answerMap = parseAnswerKeyText(
      gabaritoPages.join("\n"),
      "MULTIPLE_CHOICE",
      "Versão 1"
    );

    expect(Object.keys(answerMap)).toHaveLength(70);

    const items = parseExamBookletText({
      pages: provaPages,
      answerMap,
      questionType: "MULTIPLE_CHOICE",
    });

    expect(items).toHaveLength(70);
    expect(items.map((item) => item.originalNumber)).toEqual(
      Array.from({ length: 70 }, (_, idx) => idx + 1)
    );
    for (const item of items) {
      expect(item.options).toHaveLength(5);
      expect(item.options.map((opt) => opt.label)).toEqual(["A", "B", "C", "D", "E"]);
      expect(item.officialAnswer).toMatch(/^[A-E]$/);
    }
  });
});
