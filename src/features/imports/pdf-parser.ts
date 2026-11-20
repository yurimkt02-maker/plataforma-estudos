import { extractText, getDocumentProxy } from "unpdf";

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

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
};

function groupItemsIntoLines(items: Array<{ str: string; x: number; y: number }>): string[] {
  if (items.length === 0) return [];
  // Ordenar de cima para baixo (y decrescente no PDF) e esquerda para direita (x crescente)
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 3.5) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: Array<{ y: number; parts: Array<{ x: number; str: string }> }> = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= 3.5) {
      last.parts.push({ x: it.x, str: it.str });
    } else {
      lines.push({ y: it.y, parts: [{ x: it.x, str: it.str }] });
    }
  }

  return lines
    .map((line) => {
      line.parts.sort((a, b) => a.x - b.x);
      return line.parts
        .map((p) => p.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/\bR\s*A\s*S\s*C\s*U\s*N\s*H\s*O\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(Boolean);
}

/**
 * Extrai texto página a página de um buffer PDF usando coordenadas reais (x, y) via unpdf/pdf.js,
 * reconstruindo corretamente PDFs de 2 colunas (como Vunesp, FGV e Cebraspe) na ordem real de
 * leitura (coluna esquerda de cima para baixo, seguida da coluna direita de cima para baixo),
 * independentemente da ordem interna do stream PDF.
 */
export async function extractPdfPages(buffer: ArrayBuffer | Uint8Array): Promise<string[]> {
  const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const isolatedCopy = new Uint8Array(source.byteLength);
  isolatedCopy.set(source);

  try {
    const pdf = await getDocumentProxy(isolatedCopy);
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width || 595;
      const pageHeight = viewport.height || 842;
      const midX = pageWidth / 2;

      const content = await page.getTextContent();
      const rawItems = (content.items as PdfTextItem[])
        .map((it) => ({
          str: (it.str ?? "").replace(/\u00ad/g, ""), // remover soft hyphen
          x: it.transform?.[4] ?? 0,
          y: it.transform?.[5] ?? 0,
          w: it.width ?? 0,
        }))
        .filter((it) => it.str.trim().length > 0)
        // Ignorar cabeçalho/rodapé de página Vunesp (y muito próximo ao topo/rodapé)
        .filter((it) => it.y < pageHeight - 30 && it.y > 22);

      // Detectar se a página usa layout de 2 colunas:
      // itens significativos com início à esquerda (x < midX - 25) e à direita (x >= midX - 5)
      // e poucos itens atravessando o meio da página (x < midX - 20 && x + w > midX + 20)
      const leftOnly = rawItems.filter((it) => it.x < midX - 8 && it.x + it.w <= midX + 18);
      const rightOnly = rawItems.filter((it) => it.x >= midX - 8);
      const spanning = rawItems.filter((it) => it.x < midX - 25 && it.x + it.w > midX + 25);

      const isTwoColumn =
        leftOnly.length >= 12 &&
        rightOnly.length >= 12 &&
        spanning.length < Math.min(leftOnly.length, rightOnly.length) * 0.25;

      let pageLines: string[];
      if (isTwoColumn) {
        const leftItems = rawItems.filter((it) => it.x < midX - 5);
        const rightItems = rawItems.filter((it) => it.x >= midX - 5);
        pageLines = [
          ...groupItemsIntoLines(leftItems),
          ...groupItemsIntoLines(rightItems),
        ];
      } else {
        pageLines = groupItemsIntoLines(rawItems);
      }

      pages.push(pageLines.join("\n"));
    }

    return pages;
  } catch {
    // Fallback seguro para extractText caso algum PDF exótico falhe em getDocumentProxy
    const fallbackCopy = new Uint8Array(source.byteLength);
    fallbackCopy.set(source);
    const { text } = await extractText(fallbackCopy, { mergePages: false });
    return Array.isArray(text) ? text : [String(text ?? "")];
  }
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
    /\b(figura\s*(?:a seguir|abaixo|seguinte|precedente|acima|\d+)?|imagem\s*(?:abaixo|a seguir|seguinte)?|gr[aá]fico|tabela\s*(?:a seguir|abaixo|seguinte|\d+)?|quadro\s*(?:a seguir|abaixo|seguinte)|planilha\s*(?:a seguir|abaixo|seguinte|do excel|eletr[ôo]nica)?|charge|tirinha|tira\s+de|mapa\s*(?:a seguir|abaixo)?|esquema\s*(?:a seguir|abaixo)|diagrama|ilustra[çc][ãa]o|observe\s+a\s+figura)\b/i
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
  let reachedEssaySection = false;
  for (let p = 0; p < pages.length; p++) {
    if (reachedEssaySection) break;
    const rawLines = (pages[p] ?? "").split(/\r?\n/);
    for (const raw of rawLines) {
      const clean = raw
        .replace(/\s+/g, " ")
        .replace(/^R\s*A\s*S\s*C\s*U\s*N\s*H\s*O\s*/i, "")
        .trim();
      if (!clean) continue;
      if (
        /^(REDA[ÇC][ÃA]O\s+EM\s+L[ÍI]NGUA\s+PORTUGUESA|N[ÃA]O\s+ASSINE\s+ESTA\s+FOLHA|FOLHA\s+DE\s+RASCUNHO|PROVA\s+DISCURSIVA)/i.test(
          clean
        )
      ) {
        reachedEssaySection = true;
        break;
      }
      if (
        /^(FUNDAÇÃO VUNESP|VUNESP|\d*\s*TJSP\d+|PCSP\d+|Página \d+|Caderno de Prova|\d*\s*CONFIDENCIAL AT[ÉE] O MOMENTO|R\s*A\s*S\s*C\s*U\s*N\s*H\s*O$)/i.test(
          clean
        )
      ) {
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
  const sectionResetRe =
    /^(?:L\s*[ÍI]\s*N\s*G\s*U\s*A\s+P\s*O\s*R\s*T\s*U\s*G\s*U\s*E\s*S\s*A|C\s*O\s*N\s*H\s*E\s*C\s*I\s*M\s*E\s*N\s*T\s*O\s*S\s+(?:E\s*M\s+D\s*I\s*R\s*E\s*I\s*T\s*O|G\s*E\s*R\s*A\s*I\s*S)|D\s*I\s*R\s*E\s*I\s*T\s*O\s+(?:P\s*E\s*N\s*A\s*L|P\s*R\s*O\s*C\s*E\s*S\s*S\s*U\s*A\s*L\s+(?:P\s*E\s*N\s*A\s*L|C\s*I\s*V\s*I\s*L)|C\s*O\s*N\s*S\s*T\s*I\s*T\s*U\s*C\s*I\s*O\s*N\s*A\s*L|A\s*D\s*M\s*I\s*N\s*I\s*S\s*T\s*R\s*A\s*T\s*I\s*V\s*O|C\s*I\s*V\s*I\s*L)|N\s*O\s*R\s*M\s*A\s*S\s+D\s*A\s+C\s*O\s*R\s*R\s*E\s*G\s*E\s*D\s*O\s*R\s*I\s*A(?:\s+G\s*E\s*R\s*A\s*L\s+D\s*A\s+J\s*U\s*S\s*T\s*I\s*[ÇC]\s*A)?|A\s*T\s*U\s*A\s*L\s*I\s*D\s*A\s*D\s*E\s*S|M\s*A\s*T\s*E\s*M\s*[ÁA]\s*T\s*I\s*C\s*A|I\s*N\s*F\s*O\s*R\s*M\s*[ÁA]\s*T\s*I\s*C\s*A|R\s*A\s*C\s*I\s*O\s*C\s*[ÍI]\s*N\s*I\s*O\s+L\s*[ÓO]\s*G\s*I\s*C\s*O)$/i;

  const extractSupportRangeEnd = (text: string): number | null => {
    const m = text.match(/quest[õo]es\s+(?:de\s+n[úu]meros?\s+)?0?(\d{1,3})\s*(?:a|at[ée]|e)\s*0?(\d{1,3})/i);
    if (m) return Number(m[2]);
    const single = text.match(/quest[ãa]o\s+(?:de\s+n[úu]mero\s+)?0?(\d{1,3})/i);
    if (single) return Number(single[1]);
    return null;
  };

  const cleanJoinedText = (parts: string[]): string =>
    parts
      .join(" ")
      .replace(/([A-Za-zÀ-ÿ])-\s+([a-zà-ÿ])/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();

  const items: ParsedPdfQuestionItem[] = [];
  let activeSupportText: string | undefined;
  let activeSupportEndNum: number | null = null;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    if (activeSupportEndNum !== null && start.num > activeSupportEndNum) {
      activeSupportText = undefined;
      activeSupportEndNum = null;
    }

    const prevEnd = i > 0 ? starts[i - 1]!.lineIdx + 1 : 0;
    if (start.lineIdx > prevEnd) {
      const between = orderedLines
        .slice(prevEnd, start.lineIdx)
        .map((l) => l.text);
      if (between.some((t) => sectionResetRe.test(t))) {
        activeSupportText = undefined;
        activeSupportEndNum = null;
      }
      const supIdx = between.findIndex((t) => supportHeaderRe.test(t));
      if (supIdx >= 0) {
        const supText = cleanJoinedText(between.slice(supIdx)).slice(0, 2500);
        activeSupportText = supText;
        activeSupportEndNum = extractSupportRangeEnd(supText);
      }
    }

    const endLineIdx = i + 1 < starts.length ? starts[i + 1]!.lineIdx : orderedLines.length;
    const rawBlockLines = [
      ...(start.firstLineBody ? [start.firstLineBody] : []),
      ...orderedLines.slice(start.lineIdx + 1, endLineIdx).map((l) => l.text),
    ];

    const nextSupportIdx = rawBlockLines.findIndex(
      (line, idx) => idx > 0 && supportHeaderRe.test(line)
    );
    const nextSectionIdx = rawBlockLines.findIndex(
      (line, idx) => idx > 0 && sectionResetRe.test(line)
    );
    const cutCandidates = [nextSupportIdx, nextSectionIdx].filter((x) => x > 0);
    const cutAt = cutCandidates.length > 0 ? Math.min(...cutCandidates) : -1;
    const blockLines = cutAt > 0 ? rawBlockLines.slice(0, cutAt) : rawBlockLines;

    const currentItemSupport = activeSupportText;

    if (nextSupportIdx > 0) {
      const supText = cleanJoinedText(rawBlockLines.slice(nextSupportIdx)).slice(0, 2500);
      activeSupportText = supText;
      activeSupportEndNum = extractSupportRangeEnd(supText);
    } else if (nextSectionIdx > 0) {
      activeSupportText = undefined;
      activeSupportEndNum = null;
    }

    const keyInfo = answerMap[start.num];
    const officialAnswer = keyInfo?.answerValue ?? "";
    const isAnnulled = keyInfo?.isAnnulled ?? false;

    if (questionType === "TRUE_FALSE") {
      const statement = cleanJoinedText(blockLines);
      const subj = inferSubjectSlugFromText(statement);
      const vis = detectMissingVisualOrTable(statement);
      items.push({
        originalNumber: start.num,
        questionType: "TRUE_FALSE",
        statement,
        supportText: currentItemSupport,
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

    const statement = cleanJoinedText(stmtParts);
    const options = (["A", "B", "C", "D", "E"] as const)
      .filter((lbl) => optionsMap[lbl] !== undefined)
      .map((lbl) => ({
        label: lbl,
        content: cleanJoinedText(optionsMap[lbl]!),
      }));

    const subj = inferSubjectSlugFromText(statement);
    const vis = detectMissingVisualOrTable(
      `${statement} ${options.map((o) => o.content).join(" ")}`
    );

    items.push({
      originalNumber: start.num,
      questionType: "MULTIPLE_CHOICE",
      statement,
      supportText: currentItemSupport,
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
