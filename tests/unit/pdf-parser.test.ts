import { describe, expect, it } from "vitest";
import {
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

  it("extrai questões de múltipla escolha Vunesp (A-E) e associa ao gabarito definitivo", () => {
    const pages = [
      `
      FUNDAÇÃO VUNESP
      QUESTÃO 01 - Considerando o disposto na Lei nº 10.261/68, assinale a alternativa correta a respeito da revisão da punição disciplinar.
      (A) A instauração depende de advogado constituído.
      (B) A sanção disciplinar pode ser agravada em revisão.
      (C) O Procurador que atuou no PAD conduzirá a revisão.
      (D) Caberá revisão quando surgirem fatos ou circunstâncias ainda não apreciados ou vícios insanáveis.
      (E) A alegação de injustiça da decisão é fundamento suficiente.
      QUESTÃO 02 - A Lei nº 8.429/92 estabelece que, da decisão do juiz que determinar a indisponibilidade de bens do réu,
      (A) caberá apelação.
      (B) caberá recurso inominado.
      (C) caberá agravo de instrumento.
      (D) não caberá recurso.
      (E) caberá embargos de divergência.
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
      trackCode: "TJSP",
    });

    expect(items).toHaveLength(2);
    expect(items[0]?.originalNumber).toBe(1);
    expect(items[0]?.options).toHaveLength(5);
    expect(items[0]?.officialAnswer).toBe("D");
    expect(items[0]?.subjectSlug).toBe("estatuto-funcionarios-publicos-sp-lei-10261");

    expect(items[1]?.originalNumber).toBe(2);
    expect(items[1]?.options).toHaveLength(5);
    expect(items[1]?.officialAnswer).toBe("C");
    expect(items[1]?.subjectSlug).toBe("improbidade-administrativa-lei-8429");
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

  it("classifica disciplina padrão para textos jurídicos de PCSP/OAB/PRF", () => {
    expect(
      inferSubjectSlugFromText(
        "No inquérito policial, a autoridade policial deverá proceder conforme o CPP.",
        "PCSP"
      )
    ).toBe("inquerito-policial");
  });
});
