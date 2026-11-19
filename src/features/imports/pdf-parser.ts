import { extractText } from "unpdf";

export type ParsedPdfQuestionItem = {
  originalNumber: number;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  supportText?: string;
  options: Array<{ label: string; content: string }>;
  officialAnswer: string;
  isAnnulled: boolean;
  subjectSlug: string;
  pageNumber: number;
};

/**
 * Extrai texto página a página de um buffer PDF usando unpdf (compatível com Vercel Serverless).
 */
export async function extractPdfPages(buffer: ArrayBuffer | Uint8Array): Promise<string[]> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const { text } = await extractText(bytes, { mergePages: false });
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

  // Se houver indicação de versão/tipo (ex.: "Tipo 1" ou "Versão 1"), isolar a seção correspondente
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

  // Estratégia 1: pares explícitos "01 - A", "12. B", "30 - ANULADA", "01: D"
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

  // Estratégia 2: grade tabular (Vunesp / FGV / Cebraspe: sequência de números seguida de sequência de letras)
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
 * Classifica uma disciplina inicial confiável a partir de palavras-chave jurídicas/gramaticais,
 * garantindo que nenhuma questão fique sem disciplina na prévia.
 */
export function inferSubjectSlugFromText(statement: string, trackCode?: string): string {
  const lower = statement.toLowerCase();

  if (
    lower.includes("normas da corregedoria") ||
    lower.includes("nscgj") ||
    lower.includes("saj/pg") ||
    lower.includes("ofício de justiça")
  ) {
    return "sistema-informatizado-oficial-nscgj";
  }
  if (lower.includes("10.261") || lower.includes("estatuto dos funcionários públicos")) {
    return "estatuto-funcionarios-publicos-sp-lei-10261";
  }
  if (lower.includes("8.429") || lower.includes("improbidade administrativa")) {
    return "improbidade-administrativa-lei-8429";
  }
  if (
    lower.includes("9.099") ||
    lower.includes("12.153") ||
    lower.includes("juizado especial")
  ) {
    return "juizados-especiais-civeis-e-fazenda-publica";
  }
  if (
    lower.includes("citação") ||
    lower.includes("intimação") ||
    lower.includes("processo penal") ||
    lower.includes("inquérito policial")
  ) {
    return lower.includes("inquérito") ? "inquerito-policial" : "citacoes-e-intimacoes-cpp";
  }
  if (
    lower.includes("peculato") ||
    lower.includes("concussão") ||
    lower.includes("corrupção") ||
    lower.includes("prevaricação") ||
    lower.includes("art. 312") ||
    lower.includes("artigo 316")
  ) {
    return "crimes-contra-a-administracao-publica";
  }
  if (
    lower.includes("falsificação") ||
    lower.includes("falsidade") ||
    lower.includes("fé pública") ||
    lower.includes("artigo 294")
  ) {
    return "crimes-contra-a-fe-publica";
  }
  if (
    lower.includes("código penal") ||
    lower.includes("crime") ||
    lower.includes("dolo") ||
    lower.includes("culpa")
  ) {
    return "teoria-do-crime-e-imputabilidade";
  }
  if (
    lower.includes("constituição federal") ||
    lower.includes("direito fundamental") ||
    lower.includes("habeas") ||
    lower.includes("art. 5º") ||
    lower.includes("nacionalidade")
  ) {
    return "direitos-e-garantias-fundamentais";
  }
  if (
    lower.includes("administração pública") ||
    lower.includes("servidor público") ||
    lower.includes("ato administrativo") ||
    lower.includes("licitação")
  ) {
    return "atos-e-poderes-administrativos";
  }
  if (
    lower.includes("estatuto da advocacia") ||
    lower.includes("8.906") ||
    lower.includes("conselho seccional")
  ) {
    return "direitos-e-prerrogativas-do-advogado";
  }
  if (
    lower.includes("ctb") ||
    lower.includes("trânsito") ||
    lower.includes("rodovia") ||
    lower.includes("condutor")
  ) {
    return "normas-gerais-de-circulacao-e-conduta";
  }
  if (
    lower.includes("regência") ||
    lower.includes("concordância") ||
    lower.includes("crase") ||
    lower.includes("norma-padrão")
  ) {
    return "concordancia-e-regencia";
  }

  if (trackCode === "PRF") return "normas-gerais-de-circulacao-e-conduta";
  if (trackCode === "OAB") return "direitos-e-garantias-fundamentais";
  return "interpretacao-e-compreensao-de-textos";
}

/**
 * Extrai questões estruturadas (múltipla escolha Vunesp/FGV ou Certo/Errado Cebraspe)
 * a partir do texto das páginas do PDF da prova + mapa de gabarito oficial.
 */
export function parseExamBookletText(params: {
  pages: string[];
  answerMap: Record<number, { answerValue: string; isAnnulled: boolean }>;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  trackCode?: string;
}): ParsedPdfQuestionItem[] {
  const { pages, answerMap, questionType, trackCode } = params;

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

  // Detectar início de cada questão
  const starts: Array<{
    num: number;
    lineIdx: number;
    pageNumber: number;
    firstLineBody: string;
  }> = [];

  if (answerNums.length > 0) {
    // Busca sequencial guiada pelo gabarito oficial (evita falsos positivos com números no meio do texto)
    let searchFrom = 0;
    for (const num of answerNums) {
      const numPadded = num < 10 ? `0?${num}` : `${num}`;
      const explicitRe = new RegExp(
        `^(?:QUEST[ÃA]O\\s+)?${numPadded}\\s*(?:[-.):–—]|\\s+)\\s*(.*)$`,
        "i"
      );
      const standaloneRe = new RegExp(`^(?:QUEST[ÃA]O\\s+)?${numPadded}$`, "i");

      let found = false;
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
          found = true;
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
            found = true;
            break;
          }
        }
      }
      if (!found) {
        // fallback: não avançar searchFrom se o item não foi encontrado
      }
    }
  } else {
    // Fallback sem gabarito: detectar cabeçalhos "QUESTÃO N"
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
  const items: ParsedPdfQuestionItem[] = [];

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const endLineIdx = i + 1 < starts.length ? starts[i + 1]!.lineIdx : orderedLines.length;

    const blockLines = [
      ...(start.firstLineBody ? [start.firstLineBody] : []),
      ...orderedLines.slice(start.lineIdx + 1, endLineIdx).map((l) => l.text),
    ];

    const keyInfo = answerMap[start.num];
    const officialAnswer = keyInfo?.answerValue ?? "";
    const isAnnulled = keyInfo?.isAnnulled ?? false;

    if (questionType === "TRUE_FALSE") {
      const statement = blockLines.join(" ").replace(/\s+/g, " ").trim();
      items.push({
        originalNumber: start.num,
        questionType: "TRUE_FALSE",
        statement,
        options: [
          { label: "C", content: "Certo" },
          { label: "E", content: "Errado" },
        ],
        officialAnswer,
        isAnnulled,
        subjectSlug: inferSubjectSlugFromText(statement, trackCode),
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

    items.push({
      originalNumber: start.num,
      questionType: "MULTIPLE_CHOICE",
      statement,
      options,
      officialAnswer,
      isAnnulled,
      subjectSlug: inferSubjectSlugFromText(statement, trackCode),
      pageNumber: start.pageNumber,
    });
  }

  return items;
}
