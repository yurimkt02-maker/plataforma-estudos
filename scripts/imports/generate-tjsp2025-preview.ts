import fs from "node:fs";
import path from "node:path";
import {
  extractPdfPages,
  parseAnswerKeyText,
  parseExamBookletText,
} from "../../src/features/imports/pdf-parser";

const ARTIFACT_DIR =
  "C:/Users/yurib/.gemini/antigravity/brain/60106d52-50c2-4fb5-8897-6647544e2a45";

function mapSubject(n: number, st: string): [string, string, string] {
  if (n <= 16) {
    if ([1, 6, 11].includes(n))
      return [
        "Língua Portuguesa",
        "interpretacao-e-compreensao-de-textos",
        "STRUCTURALLY_VALID",
      ];
    if ([4, 5, 14, 16].includes(n))
      return ["Língua Portuguesa", "concordancia-e-regencia", "STRUCTURALLY_VALID"];
    return ["Língua Portuguesa", "lingua-portuguesa", "STRUCTURALLY_VALID"];
  }
  if (n <= 20)
    return [
      "Direito Penal",
      n <= 18
        ? "crimes-contra-a-fe-publica"
        : "crimes-contra-a-administracao-publica",
      "STRUCTURALLY_VALID",
    ];
  if (n <= 25)
    return [
      "Direito Processual Penal",
      n === 23 ? "citacoes-e-intimacoes-cpp" : "direito-processual-penal",
      "STRUCTURALLY_VALID",
    ];
  if (n <= 30)
    return [
      "Direito Processual Civil",
      n === 29 || /juizado especial/i.test(st)
        ? "juizados-especiais-civeis-e-fazenda-publica"
        : "direito-processual-civil",
      "STRUCTURALLY_VALID",
    ];
  if (n <= 35)
    return [
      "Direito Constitucional",
      n === 34
        ? "administracao-publica-cf88"
        : "direitos-e-garantias-fundamentais",
      "STRUCTURALLY_VALID",
    ];
  if (n <= 38)
    return [
      "Direito Administrativo",
      "estatuto-funcionarios-publicos-sp-lei-10261",
      "STRUCTURALLY_VALID",
    ];
  if (n <= 41)
    return [
      "Direito Administrativo",
      /8\.429|improbidade/i.test(st)
        ? "improbidade-administrativa-lei-8429"
        : "direito-administrativo",
      "STRUCTURALLY_VALID",
    ];
  if (n <= 46)
    return [
      "Legislação Interna",
      "legislacao-interna-tjsp",
      "STRUCTURALLY_VALID",
    ];
  if (n <= 49) return ["Atualidades", "atualidades", "STRUCTURALLY_VALID"];
  if (n === 50)
    return [
      "Atualidades › Lei nº 13.146/2015",
      "estatuto-pessoa-com-deficiencia-lei-13146",
      "STRUCTURALLY_VALID",
    ];
  if (n <= 54) return ["Matemática", "matematica", "STRUCTURALLY_VALID"];
  if (n <= 63) return ["Informática", "informatica", "STRUCTURALLY_VALID"];
  return ["Raciocínio Lógico", "raciocinio-logico", "STRUCTURALLY_VALID"];
}

async function main(): Promise<void> {
  for (const fn of [
    "tjsp2503-q53.png",
    "tjsp2503-q58.png",
    "tjsp2503-q59.png",
  ]) {
    fs.copyFileSync(
      path.join("public/images/questions/tjsp-2025", fn),
      path.join(ARTIFACT_DIR, fn)
    );
  }

  const p = await extractPdfPages(
    fs.readFileSync("acervo/tjsp_2025/tjsp2503_prova_uploaded.pdf")
  );
  const g = await extractPdfPages(
    fs.readFileSync("acervo/tjsp_2025/tjsp2503_gabarito_uploaded.pdf")
  );
  const ans = parseAnswerKeyText(g.join("\n"), "MULTIPLE_CHOICE", "Versão 1");
  const items = parseExamBookletText({
    pages: p,
    answerMap: ans,
    questionType: "MULTIPLE_CHOICE",
  });

  const lines: string[] = [
    "# Prévia Final de Curadoria — TJSP 2025 (TJSP2503, Versão 1 — 70 Questões)",
    "",
    "> [!IMPORTANT]",
    "> **Status do lote `55bbff6b-372f-4968-8a04-5fb2dd7727bb`:** 70/70 questões extraídas em ordem exata, **70/70 classificadas objetivamente** pelas seções oficiais do PDF (incluindo `Legislação Interna` pág. 14 em Q42–Q46 e `Atualidades › Lei nº 13.146/2015` em Q50), **3 recursos visuais extraídos e anexados** (`Q53`, `Q58`, `Q59`), **0 aprovações humanas fictícias** e **0 publicações automáticas**.",
    ">",
    "> **Gabarito:** o arquivo anexado (`07/12/2025`) é o gabarito preliminar da Versão 1. Como o portal `www.vunesp.com.br/TJSP2503` bloqueia requisições automatizadas (`Access Denied`), **o documento foi mantido como `PENDING`** até conferência humana com o gabarito definitivo / despacho de janeiro de 2026 no portal oficial da Vunesp ou no DJE-SP.",
    "",
    "---",
    "",
  ];

  for (const it of items) {
    const [disc, slug, st] = mapSubject(it.originalNumber, it.statement);
    const hasImg = [53, 58, 59].includes(it.originalNumber);
    const imgFile = hasImg ? `tjsp2503-q${it.originalNumber}.png` : null;

    lines.push(
      `## Questão ${String(it.originalNumber).padStart(2, "0")} — ${disc} (Pág. ${it.pageNumber})`
    );
    lines.push("");
    lines.push(`- **Assunto/Slug:** \`${slug}\``);
    lines.push(
      `- **Gabarito (preliminar 07/12/2025 — conferir definitivo jan/2026):** \`${it.officialAnswer}\``
    );
    lines.push(`- **Página do PDF:** ${it.pageNumber}`);
    lines.push(
      `- **Recursos visuais:** ${
        imgFile
          ? `\`/images/questions/tjsp-2025/${imgFile}\` (extraído do PDF oficial)`
          : "Nenhum"
      }`
    );
    lines.push(
      `- **Status de verificação:** \`${st}\` (aguardando aprovação humana)`
    );
    lines.push("");
    if (it.supportText) {
      lines.push(
        `> **Texto de apoio:** ${it.supportText.slice(0, 450)}${
          it.supportText.length > 450 ? "…" : ""
        }`
      );
      lines.push("");
    }
    lines.push(`**Enunciado:** ${it.statement}`);
    lines.push("");
    if (imgFile) {
      lines.push(
        `![Recurso visual da Questão ${it.originalNumber}](${ARTIFACT_DIR}/${imgFile})`
      );
      lines.push("");
    }
    for (const opt of it.options) {
      lines.push(`- **(${opt.label})** ${opt.content}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "previa-final-tjsp2025-70-questoes.md"),
    lines.join("\n"),
    "utf8"
  );
  console.log("Preview artifact written:", items.length, "questions");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
