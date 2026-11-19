import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_PENDING_SLUG,
  detectMissingVisualOrTable,
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
});
