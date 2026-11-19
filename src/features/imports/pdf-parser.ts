import { extractText } from "unpdf";

export const CLASSIFICATION_PENDING_SLUG = "CLASSIFICATION_PENDING";

export type ParsedPdfQuestionItem = {
  originalNumber: number;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  supportText?: string;
  options: Array<{ label: string; content: string }>;
  officialAnswer: string;
  isAnnulled: boolean;
  subjectSlug: string;
  classificationStatus: "CLASSIFIED" | "CLASSIFICATION_PENDING";
  hasMissingVisualOrTable: boolean;
  visualWarning?: string;
  pageNumber: number;
};

/**
 * Extrai texto página a página de um buffer PDF usando unpdf (compatível com Vercel Serverless).
 */
export async function extractPdfPages(buffer: ArrayBuffer | Uint8Array): Promise<string[]> {
  const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // Cria uma cópia isolada com ArrayBuffer próprio para evitar que o pdf.js (unpdf)
  // desanexe (detach) o ArrayBuffer compartilhado do pool do Node.js ou o Buffer original.
  const isolatedCopy = new Uint8Array(source.byteLength);
  isolatedCopy.set(source);
  const { text } = await extractText(isolatedCopy, { mergePages: false });
  return Array.isArray(text) ? text : [String(text ?? "")];
}

/**
 * Interpreta gabaritos oficiais em múltiplos formatos de banca:
 * - Vunesp (TJSP / PCSP): "1 - B", "01 B", "01. ANULADA", ou tabelas por blocos numéricos
 * - FGV (OAB): tabelas Tipo 1..4 (blocos de 1..20 seguidos de A/B/C/D/*)
 * - Cebraspe (PRF): blocos de itens seguidos de C/E/X
 */
export function parseAnswerKeyText(
  rawText: string,
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE",
  versionHint?: string
): Record<number, { answerValue: string; isAnnulled: boolean }> {
  let section = rawText;

  if (versionHint) {
    const tipoMatch = versionHint.match(/tipo\s*(\d+)/i);
    const versaoMatch = versionHint.match(/vers[aã]o\s*(\d+)/i);
    const numStr = tipoMatch?.[1] ?? versaoMatch?.[1];
    if (numStr) {
      const nextNum = Number(numStr) + 1;
      const re = new RegExp(
        `(?:tipo|vers[aã]o)\\s*${numStr}\\b([\\s\\S]*?)(?:(?:tipo|vers[aã]o)\\s*${nextNum}\\b|$)`,
        "i"
      );
      const secMatch = rawText.match(re);
      if (secMatch?.[1] && secMatch[1].trim().length > 40) {
        section = secMatch[1];
      }
    }
  }

  const result: Record<number, { answerValue: string; isAnnulled: boolean }> = {};
  const validAnswers =
    questionType === "TRUE_FALSE"
      ? new Set(["C", "E", "X", "*", "ANULADA", "ANULADO"])
      : new Set(["A", "B", "C", "D", "E", "*", "X", "ANULADA", "ANULADO", "-"]);

  const normalizeAnswer = (raw: string): { answerValue: string; isAnnulled: boolean } => {
    const up = raw.trim().toUpperCase();
    if (up === "ANULADA" || up === "ANULADO" || up === "*" || up === "X" || up === "-") {
      return { answerValue: "ANULADA", isAnnulled: true };
    }
    return { answerValue: up, isAnnulled: false };
  };

  const pairRegex =
    /(?:^|[\s,;])0?(\d{1,3})\s*[-.:–—]\s*(ANULAD[AO]|[*X]|[A-E])\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(section)) !== null) {
    const num = Number(match[1]);
    const ans = match[2]!.toUpperCase();
    if (num >= 1 && num <= 200 && validAnswers.has(ans)) {
      result[num] = normalizeAnswer(ans);
    }
  }

  if (Object.keys(result).length < 5) {
    const tokens = section
      .split(/[\s\r\n\t]+/)
      .map((t) => t.trim().replace(/[.)]/g, ""))
      .filter(Boolean);

    let i = 0;
    while (i < tokens.length) {
      if (/^\d{1,3}$/.test(tokens[i]!)) {
        const firstVal = Number(tokens[i]);
        if (firstVal >= 1 && firstVal <= 200) {
          const nums: number[] = [];
          while (i < tokens.length && /^\d{1,3}$/.test(tokens[i]!)) {
            const v = Number(tokens[i]);
            if (v >= 1 && v <= 200) nums.push(v);
            i += 1;
          }
          const ansList: string[] = [];
          while (i < tokens.length && validAnswers.has(tokens[i]!.toUpperCase())) {
            ansList.push(tokens[i]!.toUpperCase());
            i += 1;
          }
          if (nums.length > 0 && ansList.length > 0) {
            const limit = Math.min(nums.length, ansList.length);
            for (let k = 0; k < limit; k++) {
              result[nums[k]!] = normalizeAnswer(ansList[k]!);
            }
            continue;
          }
        }
      }
      i += 1;
    }
  }

  return result;
}

/**
 * Classifica disciplina SOMENTE quando há correspondência explícita e inequívoca no texto.
 * Jamais atribui disciplina genérica por carreira (PRF, OAB, TJSP ou PCSP).
 * Quando não há correspondência explícita, retorna CLASSIFICATION_PENDING para classificação humana.
 */
export function inferSubjectSlugFromText(statement: string): {
  subjectSlug: string;
  classificationStatus: "CLASSIFIED" | "CLASSIFICATION_PENDING";
} {
  const lower = statement.toLowerCase();

  if (
    lower.includes("normas da corregedoria") ||
    lower.includes("nscgj") ||
    lower.includes("saj/pg") ||
    lower.includes("ofício de justiça")
  ) {
    return {
      subjectSlug: "sistema-informatizado-oficial-nscgj",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (lower.includes("10.261") || lower.includes("estatuto dos funcionários públicos")) {
    return {
      subjectSlug: "estatuto-funcionarios-publicos-sp-lei-10261",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (lower.includes("8.429") || lower.includes("improbidade administrativa")) {
    return {
      subjectSlug: "improbidade-administrativa-lei-8429",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (
    lower.includes("9.099") ||
    lower.includes("12.153") ||
    lower.includes("juizado especial")
  ) {
    return {
      subjectSlug: "juizados-especiais-civeis-e-fazenda-publica",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (lower.includes("inquérito policial")) {
    return { subjectSlug: "inquerito-policial", classificationStatus: "CLASSIFIED" };
  }
  if (
    (lower.includes("citação") || lower.includes("intimação")) &&
    lower.includes("processo penal")
  ) {
    return {
      subjectSlug: "citacoes-e-intimacoes-cpp",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (
    lower.includes("peculato") ||
    lower.includes("concussão") ||
    lower.includes("corrupção passiva") ||
    lower.includes("prevaricação") ||
    lower.includes("art. 312") ||
    lower.includes("artigo 316")
  ) {
    return {
      subjectSlug: "crimes-contra-a-administracao-publica",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (
    lower.includes("petrechos de falsificação") ||
    lower.includes("falsidade documental") ||
    lower.includes("fé pública") ||
    lower.includes("artigo 294")
  ) {
    return {
      subjectSlug: "crimes-contra-a-fe-publica",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (
    lower.includes("estatuto da advocacia") ||
    lower.includes("lei nº 8.906") ||
    lower.includes("conselho seccional da oab")
  ) {
    return {
      subjectSlug: "direitos-e-prerrogativas-do-advogado",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (
    lower.includes("código de trânsito brasileiro") ||
    lower.includes("ctb") ||
    lower.includes("resolução contran")
  ) {
    return {
      subjectSlug: "normas-gerais-de-circulacao-e-conduta",
      classificationStatus: "CLASSIFIED",
    };
  }
  if (
    lower.includes("regência nominal") ||
    lower.includes("regência verbal") ||
    lower.includes("concordância verbal") ||
    lower.includes("concordância nominal")
  ) {
    return {
      subjectSlug: "concordancia-e-regencia",
      classificationStatus: "CLASSIFIED",
    };
  }

  return {
    subjectSlug: CLASSIFICATION_PENDING_SLUG,
    classificationStatus: "CLASSIFICATION_PENDING",
  };
}

/**
 * Detecta referências a figuras, tabelas, gráficos, charges ou tirinhas no enunciado/opções.
 * Como a extração textual pura não recorta imagens/tabelas automaticamente, itens com essas
 * referências são obrigatoriamente sinalizados para revisão humana comparativa com o PDF.
 */
export function detectMissingVisualOrTable(text: string): {
  hasMissingVisualOrTable: boolean;
  visualWarning?: string;
} {
  const match = text.match(
    /\b(figura\s*(?:a seguir|abaixo|seguinte|precedente|acima|\d+)?|imagem\s*(?:abaixo|a seguir|seguinte)?|gr[aá]fico|tabela\s*(?:a seguir|abaixo|seguinte|\d+)?|quadro\s*(?:a seguir|abaixo|seguinte)|charge|tirinha|tira\s+de|mapa\s*(?:a seguir|abaixo)?|esquema\s*(?:a seguir|abaixo)|diagrama|ilustra[çc][ãa]o|observe\s+a\s+figura)\b/i
  );

  if (match) {
    return {
      hasMissingVisualOrTable: true,
      visualWarning: `Referência visual/tabular detectada ("${match[0]}"). Confira o PDF original e anexe/verifique a imagem ou tabela antes de aprovar.`,
    };
  }

  return { hasMissingVisualOrTable: false };
}

/**
 * Extrai questões estruturadas (múltipla escolha Vunesp/FGV ou Certo/Errado Cebraspe)
 * preservando textos de apoio compartilhados e sinalizando itens visuais ou sem disciplina.
 */
export function parseExamBookletText(params: {
  pages: string[];
  answerMap: Record<number, { answerValue: string; isAnnulled: boolean }>;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
}): ParsedPdfQuestionItem[] {
  const { pages, answerMap, questionType } = params;

  const orderedLines: Array<{ pageNumber: number; text: string }> = [];
  for (let p = 0; p < pages.length; p++) {
    const rawLines = (pages[p] ?? "").split(/\r?\n/);
    for (const raw of rawLines) {
      const clean = raw.replace(/\s+/g, " ").trim();
      if (!clean) continue;
      if (/^(FUNDAÇÃO VUNESP|VUNESP|TJSP\d+|PCSP\d+|Página \d+|Caderno de Prova)/i.test(clean)) {
        continue;
      }
      orderedLines.push({ pageNumber: p + 1, text: clean });
    }
  }

  const answerNums = Object.keys(answerMap)
    .map(Number)
    .sort((a, b) => a - b);

  const starts: Array<{
    num: number;
    lineIdx: number;
    pageNumber: number;
    firstLineBody: string;
  }> = [];

  if (answerNums.length > 0) {
    let searchFrom = 0;
    for (const num of answerNums) {
      const numPadded = num < 10 ? `0?${num}` : `${num}`;
      const explicitRe = new RegExp(
        `^(?:QUEST[ÃA]O\\s+)?${numPadded}\\s*(?:[-.):–—]|\\s+)\\s*(.*)$`,
        "i"
      );
      const standaloneRe = new RegExp(`^(?:QUEST[ÃA]O\\s+)?${numPadded}$`, "i");

      for (let k = searchFrom; k < orderedLines.length; k++) {
        const line = orderedLines[k]!;
        if (standaloneRe.test(line.text)) {
          starts.push({
            num,
            lineIdx: k,
            pageNumber: line.pageNumber,
            firstLineBody: "",
          });
          searchFrom = k + 1;
          break;
        }
        const m = line.text.match(explicitRe);
        if (m) {
          const body = (m[1] ?? "").trim();
          if (body.length === 0 || /[A-Za-zÀ-ÿ]{2,}/.test(body)) {
            starts.push({
              num,
              lineIdx: k,
              pageNumber: line.pageNumber,
              firstLineBody: body,
            });
            searchFrom = k + 1;
            break;
          }
        }
      }
    }
  } else {
    const qHeaderRe = /^QUEST[ÃA]O\s+0?(\d{1,3})\s*[-.):–—]?\s*(.*)$/i;
    for (let k = 0; k < orderedLines.length; k++) {
      const line = orderedLines[k]!;
      const m = line.text.match(qHeaderRe);
      if (m) {
        starts.push({
          num: Number(m[1]),
          lineIdx: k,
          pageNumber: line.pageNumber,
          firstLineBody: (m[2] ?? "").trim(),
        });
      }
    }
  }

  const optRegex = /^\(?([A-E])\)[\s.):–—-]+(.*)$/;
  const optRegexAlt = /^([A-E])[.)]\s+(.*)$/;
  const supportHeaderRe =
    /^(Leia o texto|Texto\s+(?:de apoio|base|para as quest[õo]es|\d+|[IVX]+)|Com base no texto)/i;

  const items: ParsedPdfQuestionItem[] = [];
  let activeSupportText: string | undefined;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const prevEnd = i > 0 ? starts[i - 1]!.lineIdx + 1 : 0;
    if (start.lineIdx > prevEnd) {
      const between = orderedLines
        .slice(prevEnd, start.lineIdx)
        .map((l) => l.text);
      const supIdx = between.findIndex((t) => supportHeaderRe.test(t));
      if (supIdx >= 0) {
        activeSupportText = between.slice(supIdx).join(" ").trim().slice(0, 2000);
      }
    }

    const endLineIdx = i + 1 < starts.length ? starts[i + 1]!.lineIdx : orderedLines.length;
    const rawBlockLines = [
      ...(start.firstLineBody ? [start.firstLineBody] : []),
      ...orderedLines.slice(start.lineIdx + 1, endLineIdx).map((l) => l.text),
    ];

    // Separar texto de apoio que pertença às próximas questões
    const nextSupportIdx = rawBlockLines.findIndex(
      (line, idx) => idx > 0 && supportHeaderRe.test(line)
    );
    const blockLines =
      nextSupportIdx > 0 ? rawBlockLines.slice(0, nextSupportIdx) : rawBlockLines;
    if (nextSupportIdx > 0) {
      activeSupportText = rawBlockLines
        .slice(nextSupportIdx)
        .join(" ")
        .trim()
        .slice(0, 2000);
    }

    const keyInfo = answerMap[start.num];
    const officialAnswer = keyInfo?.answerValue ?? "";
    const isAnnulled = keyInfo?.isAnnulled ?? false;

    if (questionType === "TRUE_FALSE") {
      const statement = blockLines.join(" ").replace(/\s+/g, " ").trim();
      const subj = inferSubjectSlugFromText(statement);
      const vis = detectMissingVisualOrTable(statement);
      items.push({
        originalNumber: start.num,
        questionType: "TRUE_FALSE",
        statement,
        supportText: activeSupportText,
        options: [
          { label: "C", content: "Certo" },
          { label: "E", content: "Errado" },
        ],
        officialAnswer,
        isAnnulled,
        subjectSlug: subj.subjectSlug,
        classificationStatus: subj.classificationStatus,
        hasMissingVisualOrTable: vis.hasMissingVisualOrTable,
        visualWarning: vis.visualWarning,
        pageNumber: start.pageNumber,
      });
      continue;
    }

    const stmtParts: string[] = [];
    const optionsMap: Record<string, string[]> = {};
    let currentOpt: string | null = null;

    for (const line of blockLines) {
      const m = line.match(optRegex) ?? line.match(optRegexAlt);
      if (m) {
        const lbl = m[1]!.toUpperCase();
        const body = (m[2] ?? "").trim();
        currentOpt = lbl;
        optionsMap[lbl] = body ? [body] : [];
      } else if (currentOpt) {
        optionsMap[currentOpt]!.push(line);
      } else {
        stmtParts.push(line);
      }
    }

    const statement = stmtParts.join(" ").replace(/\s+/g, " ").trim();
    const options = (["A", "B", "C", "D", "E"] as const)
      .filter((lbl) => optionsMap[lbl] !== undefined)
      .map((lbl) => ({
        label: lbl,
        content: optionsMap[lbl]!.join(" ").replace(/\s+/g, " ").trim(),
      }));

    const subj = inferSubjectSlugFromText(statement);
    const vis = detectMissingVisualOrTable(
      `${statement} ${options.map((o) => o.content).join(" ")}`
    );

    items.push({
      originalNumber: start.num,
      questionType: "MULTIPLE_CHOICE",
      statement,
      supportText: activeSupportText,
      options,
      officialAnswer,
      isAnnulled,
      subjectSlug: subj.subjectSlug,
      classificationStatus: subj.classificationStatus,
      hasMissingVisualOrTable: vis.hasMissingVisualOrTable,
      visualWarning: vis.visualWarning,
      pageNumber: start.pageNumber,
    });
  }

  return items;
}
