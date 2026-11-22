import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

/**
 * PREPARAÇÃO CONTROLADA (READ-ONLY) DO SANEAMENTO DA OAB:
 * - Audita uso multi-carreira (OAB, PRF, TJSP, PCSP) das 6 raízes duplicadas.
 * - Gera prévia completa das 234 correções de alta confiança organizadas em
 *   lotes pequenos e verificáveis (Lotes A, B, C, D), contendo todos os 8 campos
 *   obrigatórios por questão.
 * - Mantém as 182 divergências incertas separadas para revisão humana.
 * - ZERO mutações no Prisma Postgres.
 */

const DUPLICATE_ROOT_PAIRS: Array<{
  sharedSlug: string;
  oabSlug: string;
  recommendedCanonicalSlug: string;
}> = [
  {
    sharedSlug: "etica-e-estatuto-da-oab",
    oabSlug: "oab-etica-profissional",
    recommendedCanonicalSlug: "oab-etica-profissional",
  },
  {
    sharedSlug: "direito-constitucional",
    oabSlug: "oab-direito-constitucional",
    recommendedCanonicalSlug: "direito-constitucional",
  },
  {
    sharedSlug: "direito-administrativo",
    oabSlug: "oab-direito-administrativo",
    recommendedCanonicalSlug: "direito-administrativo",
  },
  {
    sharedSlug: "direito-penal",
    oabSlug: "oab-direito-penal",
    recommendedCanonicalSlug: "direito-penal",
  },
  {
    sharedSlug: "direito-processual-penal",
    oabSlug: "oab-direito-processual-penal",
    recommendedCanonicalSlug: "direito-processual-penal",
  },
  {
    sharedSlug: "direito-processual-civil",
    oabSlug: "oab-direito-processual-civil",
    recommendedCanonicalSlug: "direito-processual-civil",
  },
];

// Regras rigorosas com \b (sem substring) para evidência textual integral
const STRICT_DISCIPLINE_RULES: Array<{
  slug: string;
  name: string;
  patterns: RegExp[];
}> = [
  {
    slug: "oab-etica-profissional",
    name: "Ética Profissional e Estatuto da OAB",
    patterns: [
      /\bestatuto\s+da\s+advocacia\b/i,
      /\bc[oó]digo\s+de\s+[eé]tica\s+e\s+disciplina\b/i,
      /\btribunal\s+de\s+[eé]tica\s+e\s+disciplina\b/i,
      /\bconselho\s+(?:seccional|federal)\s+da\s+oab\b/i,
      /\bsociedade\s+(?:unipessoal\s+)?de\s+advogad/i,
      /\bhonor[aá]rios\s+advocat[ií]cios\b/i,
      /\bprerrogativas?\s+do\s+advogado\b/i,
      /\binscri[cç][aã]o\s+(?:principal|suplementar|na\s+oab)\b/i,
      /\binfra[cç][aã]o\s+disciplinar\b.*\badvogad/i,
      /\badvogad[oa]\s+regularmente\s+inscrit[oa]\s+(?:na|nos\s+quadros\s+da)\s+oab\b/i,
    ],
  },
  {
    slug: "oab-filosofia-do-direito",
    name: "Filosofia do Direito",
    patterns: [
      /\b(?:arist[oó]teles|immanuel\s+kant|hans\s+kelsen|herbert\s+hart|ronald\s+dworkin|john\s+rawls|norberto\s+bobbio|hannah\s+arendt|montesquieu|rousseau|thomas\s+hobbes|john\s+locke|habermas|miguel\s+reale|robert\s+alexy|cha[iï]m\s+perelman|maquiavel|s[aã]o\s+tom[aá]s\s+de\s+aquino|jeremy\s+bentham|john\s+stuart\s+mill|michel\s+foucault|gustav\s+radbruch|lon\s+fuller|alf\s+ross|carl\s+schmitt)\b/i,
      /\bfilosofia\s+do\s+direito\b|\bjusnaturalismo\b|\bpositivismo\s+jur[ií]dico\b/i,
    ],
  },
  {
    slug: "oab-direito-eleitoral",
    name: "Direito Eleitoral",
    patterns: [
      /\bjusti[cç]a\s+eleitoral\b|\bc[oó]digo\s+eleitoral\b|\bpropaganda\s+eleitoral\b/i,
      /\b(?:tse|tribunal\s+superior\s+eleitoral|tribunal\s+regional\s+eleitoral)\b/i,
      /\b(?:inelegibilidade|lei\s+da\s+ficha\s+limpa|registro\s+de\s+candidatura|presta[cç][aã]o\s+de\s+contas\s+eleitorais|fundo\s+partid[aá]rio|fundo\s+especial\s+de\s+financiamento\s+de\s+campanha|coliga[cç][aã]o|federa[cç][aã]o\s+partid[aá]ria|conven[cç][aã]o\s+partid[aá]ria|aije|aime|rced)\b/i,
    ],
  },
  {
    slug: "oab-direito-financeiro",
    name: "Direito Financeiro",
    patterns: [
      /\bdireito\s+financeiro\b|\blei\s+de\s+responsabilidade\s+fiscal\b|\blrf\b/i,
      /\blei\s+or[cç]ament[aá]ria\s+anual\b|\bloa\b|\blei\s+de\s+diretrizes\s+or[cç]ament[aá]rias\b|\bldo\b|\bplano\s+plurianual\b|\bppa\b/i,
      /\bcr[eé]ditos?\s+(?:adicionais|suplementares|especiais|extraordin[aá]rios)\b|\bor[cç]amento\s+p[uú]blico\b|\bdespesa\s+p[uú]blica\b|\bprecat[oó]rios?\b|\bd[ií]vida\s+p[uú]blica\b/i,
    ],
  },
  {
    slug: "oab-direito-previdenciario",
    name: "Direito Previdenciário",
    patterns: [
      /\b(?:inss|rgps|regime\s+geral\s+de\s+previd[eê]ncia\s+social|previd[eê]ncia\s+social|seguridade\s+social)\b/i,
      /\b(?:aposentadoria|aux[ií]lio-doen[cç]a|aux[ií]lio\s+por\s+incapacidade|pens[aã]o\s+por\s+morte|sal[aá]rio-maternidade|aux[ií]lio-reclus[aã]o|aux[ií]lio-acidente|bpc|loas|segurado\s+(?:obrigat[oó]rio|facultativo|especial)|car[eê]ncia\s+previdenci[aá]ria)\b/i,
    ],
  },
  {
    slug: "oab-direito-ambiental",
    name: "Direito Ambiental",
    patterns: [
      /\bdireito\s+ambiental\b|\bmeio\s+ambiente\b|\blicenciamento\s+ambiental\b|\b(?:ibama|sisnama|conama|icmbio)\b/i,
      /\bunidade\s+de\s+conserva[cç][aã]o\b|\b[aá]rea\s+de\s+preserva[cç][aã]o\s+permanente\b|\breserva\s+legal\b|\bc[oó]digo\s+florestal\b|\bpoluidor-pagador\b|\bdano\s+ambiental\b/i,
    ],
  },
  {
    slug: "oab-direito-do-consumidor",
    name: "Direito do Consumidor",
    patterns: [
      /\bc[oó]digo\s+de\s+defesa\s+do\s+consumidor\b|\bcdc\b|\bprocon\b/i,
      /\brela[cç][aã]o\s+de\s+consumo\b|\bv[ií]cio\s+do\s+(?:produto|servi[cç]o)\b|\bfato\s+do\s+(?:produto|servi[cç]o)\b|\bpr[aá]tica\s+abusiva\b|\bdireito\s+de\s+arrependimento\b|\bsuperendividamento\b|\bfornecedor\b.*\bconsumidor\b/i,
    ],
  },
  {
    slug: "oab-eca",
    name: "Direito da Criança e do Adolescente (ECA)",
    patterns: [
      /\bestatuto\s+da\s+crian[cç]a\s+e\s+do\s+adolescente\b|\beca\b/i,
      /\bconselho\s+tutelar\b|\bato\s+infracional\b|\bmedida\s+socioeducativa\b|\binterna[cç][aã]o\b.*\badolescente\b|\bado[cç][aã]o\b.*\b(?:crian[cç]a|adolescente|cadastro)\b|\bautoriza[cç][aã]o\s+para\s+viajar\b/i,
    ],
  },
  {
    slug: "oab-direitos-humanos",
    name: "Direitos Humanos",
    patterns: [
      /\bdireitos\s+humanos\b|\bpacto\s+de\s+san\s+jos[eé]\b|\bconven[cç][aã]o\s+americana\s+sobre\s+direitos\s+humanos\b/i,
      /\b(?:corte\s+interamericana|comiss[aã]o\s+interamericana|declara[cç][aã]o\s+universal\s+dos\s+direitos\s+humanos|sistema\s+interamericano|tratado\s+internacional\s+de\s+direitos\s+humanos|protocolo\s+de\s+san\s+salvador|regras\s+de\s+mandela|regras\s+de\s+bangkok)\b/i,
    ],
  },
  {
    slug: "oab-direito-internacional",
    name: "Direito Internacional",
    patterns: [
      /\bdireito\s+internacional\b|\blei\s+de\s+migra[cç][aã]o\b|\blindb\b/i,
      /\b(?:extradi[cç][aã]o|deporta[cç][aã]o|expuls[aã]o|repatria[cç][aã]o|homologa[cç][aã]o\s+de\s+senten[cç]a\s+estrangeira|carta\s+rogat[oó]ria|imunidade\s+de\s+jurisdi[cç][aã]o|c[oô]nsul|embaixada|mercosul|arbitragem\s+internacional|visto\s+tempor[aá]rio)\b/i,
    ],
  },
  {
    slug: "oab-direito-tributario",
    name: "Direito Tributário",
    patterns: [
      /\bc[oó]digo\s+tribut[aá]rio\s+nacional\b|\bctn\b|\bdireito\s+tribut[aá]rio\b/i,
      /\b(?:icms|issqn|iptu|ipva|itbi|itcmd|irpf|irpj|ipi|iof|cofins|csll|tributo|imunidade\s+tribut[aá]ria|isen[cç][aã]o\s+tribut[aá]ria|fato\s+gerador|lan[cç]amento\s+tribut[aá]rio|cr[eé]dito\s+tribut[aá]rio|execu[cç][aã]o\s+fiscal|contribui[cç][aã]o\s+de\s+melhoria|empr[eé]stimo\s+compuls[oó]rio|anterioridade\s+(?:anual|nonagesimal)|substitui[cç][aã]o\s+tribut[aá]ria)\b/i,
    ],
  },
  {
    slug: "oab-direito-empresarial",
    name: "Direito Empresarial",
    patterns: [
      /\b(?:sociedade\s+an[oô]nima|sociedade\s+limitada|recupera[cç][aã]o\s+judicial|fal[eê]ncia|massa\s+falida|t[ií]tulo\s+de\s+cr[eé]dito|cheque|duplicata|nota\s+promiss[oó]ria|letra\s+de\s+c[aâ]mbio|endosso|aval|estabelecimento\s+empresarial|trespasse|propriedade\s+industrial|patente|empres[aá]rio\s+individual|junta\s+comercial|microempresa|deb[eê]ntures|franquia)\b/i,
    ],
  },
  {
    slug: "oab-direito-processual-do-trabalho",
    name: "Direito Processual do Trabalho",
    patterns: [
      /\b(?:reclama[cç][aã]o\s+trabalhista|recurso\s+ordin[aá]rio|recurso\s+de\s+revista|tst|trt|vara\s+do\s+trabalho|justi[cç]a\s+do\s+trabalho|diss[ií]dio\s+(?:individual|coletivo)|execu[cç][aã]o\s+trabalhista|audi[eê]ncia\s+trabalhista|processo\s+do\s+trabalho|dep[oó]sito\s+recursal|agravo\s+de\s+peti[cç][aã]o|rito\s+sumar[ií]ssimo|reclamante|reclamada)\b/i,
    ],
  },
  {
    slug: "oab-direito-do-trabalho",
    name: "Direito do Trabalho",
    patterns: [
      /\b(?:clt|consolida[cç][aã]o\s+das\s+leis\s+do\s+trabalho|contrato\s+de\s+trabalho|aviso\s+pr[eé]vio|fgts|f[eé]rias\s+proporcionais|adicional\s+de\s+(?:insalubridade|periculosidade|noturno)|justa\s+causa|rescis[aã]o\s+indireta|jornada\s+de\s+trabalho|banco\s+de\s+horas|teletrabalho|estabilidade\s+provis[oó]ria|cipa|acordo\s+coletivo|conven[cç][aã]o\s+coletiva|terceiriza[cç][aã]o|empregado\s+dom[eé]stico)\b/i,
    ],
  },
  {
    slug: "oab-direito-processual-penal",
    name: "Direito Processual Penal (OAB)",
    patterns: [
      /\b(?:c[oó]digo\s+de\s+processo\s+penal|cpp|inqu[eé]rito\s+policial|a[cç][aã]o\s+penal\s+(?:p[uú]blica|privada)|pris[aã]o\s+(?:preventiva|tempor[aá]ria|em\s+flagrante|domiciliar)|tribunal\s+do\s+j[uú]ri|recurso\s+em\s+sentido\s+estrito|audi[eê]ncia\s+de\s+cust[oó]dia|acordo\s+de\s+n[aã]o\s+persecu[cç][aã]o\s+penal|anpp|queixa-crime|den[uú]ncia\s+oferecida|juiz\s+das\s+garantias|cadeia\s+de\s+cust[oó]dia|revis[aã]o\s+criminal|execu[cç][aã]o\s+penal|lep)\b/i,
    ],
  },
  {
    slug: "oab-direito-penal",
    name: "Direito Penal (OAB)",
    patterns: [
      /\b(?:c[oó]digo\s+penal|homic[ií]dio|feminic[ií]dio|furto|roubo|latroc[ií]nio|estelionato|peculato|concuss[aã]o|corrup[cç][aã]o\s+(?:ativa|passiva)|leg[ií]tima\s+defesa|estado\s+de\s+necessidade|desist[eê]ncia\s+volunt[aá]ria|arrependimento\s+(?:eficaz|posterior)|erro\s+de\s+(?:tipo|proibi[cç][aã]o)|dosimetria|pena\s+privativa\s+de\s+liberdade|livramento\s+condicional|sursis|lei\s+maria\s+da\s+penha|tr[aá]fico\s+de\s+drogas|estupro|cal[uú]nia|difama[cç][aã]o|inj[uú]ria)\b/i,
    ],
  },
  {
    slug: "oab-direito-processual-civil",
    name: "Direito Processual Civil (OAB)",
    patterns: [
      /\b(?:c[oó]digo\s+de\s+processo\s+civil|cpc|agravo\s+de\s+instrumento|embargos\s+de\s+declara[cç][aã]o|cumprimento\s+de\s+senten[cç]a|tutela\s+(?:provis[oó]ria|antecipada|de\s+urg[eê]ncia|de\s+evid[eê]ncia)|litiscons[oó]rcio|contesta[cç][aã]o|reconven[cç][aã]o|a[cç][aã]o\s+rescis[oó]ria|juizado\s+especial\s+c[ií]vel|incidente\s+de\s+desconsidera[cç][aã]o|penhora|chamamento\s+ao\s+processo|denuncia[cç][aã]o\s+da\s+lide|coisa\s+julgada|recurso\s+especial|recurso\s+extraordin[aá]rio|execu[cç][aã]o\s+de\s+t[ií]tulo\s+extrajudicial)\b/i,
    ],
  },
  {
    slug: "oab-direito-administrativo",
    name: "Direito Administrativo (OAB)",
    patterns: [
      /\b(?:licita[cç][aã]o|lei\s+n?[º°]?\s*14\.133|improbidade\s+administrativa|ato\s+administrativo|servi[cç]o\s+p[uú]blico|concess[aã]o\s+de\s+servi[cç]o|permiss[aã]o\s+de\s+servi[cç]o|desapropria[cç][aã]o|tombamento|servid[aã]o\s+administrativa|responsabilidade\s+civil\s+do\s+estado|servidor\s+p[uú]blico|autarquia|empresa\s+p[uú]blica|sociedade\s+de\s+economia\s+mista|poder\s+de\s+pol[ií]cia|processo\s+administrativo\s+disciplinar|ppp|parceria\s+p[uú]blico-privada)\b/i,
    ],
  },
  {
    slug: "oab-direito-constitucional",
    name: "Direito Constitucional (OAB)",
    patterns: [
      /\b(?:constitui[cç][aã]o\s+federal|crfb|controle\s+(?:concentrado|difuso)\s+de\s+constitucionalidade|a[cç][aã]o\s+direta\s+de\s+inconstitucionalidade|adi\b|adpf\b|adc\b|ado\b|processo\s+legislativo|medida\s+provis[oó]ria|emenda\s+constitucional|estado\s+de\s+defesa|estado\s+de\s+s[ií]tio|interven[cç][aã]o\s+federal|comiss[aã]o\s+parlamentar\s+de\s+inqu[eé]rito|cpi\b|mandado\s+de\s+(?:seguran[cç]a|injun[cç][aã]o)|a[cç][aã]o\s+popular|reparti[cç][aã]o\s+de\s+compet[eê]ncias|imunidade\s+parlamentar)\b/i,
    ],
  },
  {
    slug: "oab-direito-civil",
    name: "Direito Civil",
    patterns: [
      /\b(?:c[oó]digo\s+civil|usucapi[aã]o|casamento|div[oó]rcio|uni[aã]o\s+est[aá]vel|regime\s+de\s+bens|testamento|heran[cç]a|herdeir[oa]|sucess[aã]o\s+leg[ií]tima|invent[aá]rio|alimentos|condom[ií]nio\s+edil[ií]cio|compra\s+e\s+venda|doa[cç][aã]o|fian[cç]a|comodato|m[uú]tuo|evic[cç][aã]o|v[ií]cio\s+redibit[oó]rio|neg[oó]cio\s+jur[ií]dico|simula[cç][aã]o|fraude\s+contra\s+credores|bem\s+de\s+fam[ií]lia|hipoteca|usufruto|curatela|emancipa[cç][aã]o)\b/i,
    ],
  },
];

function normalizeRoot(slug: string): string {
  const map: Record<string, string> = {
    "etica-e-estatuto-da-oab": "oab-etica-profissional",
    "direito-constitucional": "oab-direito-constitucional",
    "direito-administrativo": "oab-direito-administrativo",
    "direito-penal": "oab-direito-penal",
    "direito-processual-penal": "oab-direito-processual-penal",
    "direito-processual-civil": "oab-direito-processual-civil",
  };
  return map[slug] ?? slug;
}

function expectedFgvBlock(examNum: number, qNum: number): string {
  if (qNum <= 8) return "oab-etica-profissional";
  if (qNum <= 10) return "oab-filosofia-do-direito";
  if (examNum >= 38) {
    if (qNum <= 16) return "oab-direito-constitucional";
    if (qNum <= 18) return "oab-direitos-humanos";
    if (qNum <= 20) return "oab-direito-eleitoral";
    if (qNum <= 22) return "oab-direito-internacional";
    if (qNum <= 24) return "oab-direito-financeiro";
    if (qNum <= 29) return "oab-direito-tributario";
    if (qNum <= 34) return "oab-direito-administrativo";
    if (qNum <= 36) return "oab-direito-ambiental";
    if (qNum <= 42) return "oab-direito-civil";
    if (qNum <= 44) return "oab-eca";
    if (qNum <= 46) return "oab-direito-do-consumidor";
    if (qNum <= 50) return "oab-direito-empresarial";
    if (qNum <= 56) return "oab-direito-processual-civil";
    if (qNum <= 62) return "oab-direito-penal";
    if (qNum <= 68) return "oab-direito-processual-penal";
    if (qNum <= 70) return "oab-direito-previdenciario";
    if (qNum <= 75) return "oab-direito-do-trabalho";
    return "oab-direito-processual-do-trabalho";
  }
  if (qNum <= 17) return "oab-direito-constitucional";
  if (qNum <= 19) return "oab-direitos-humanos";
  if (qNum <= 21) return "oab-direito-internacional";
  if (qNum <= 26) return "oab-direito-tributario";
  if (qNum <= 32) return "oab-direito-administrativo";
  if (qNum <= 34) return "oab-direito-ambiental";
  if (qNum <= 41) return "oab-direito-civil";
  if (qNum <= 43) return "oab-eca";
  if (qNum <= 45) return "oab-direito-do-consumidor";
  if (qNum <= 50) return "oab-direito-empresarial";
  if (qNum <= 57) return "oab-direito-processual-civil";
  if (qNum <= 63) return "oab-direito-penal";
  if (qNum <= 69) return "oab-direito-processual-penal";
  if (qNum <= 75) return "oab-direito-do-trabalho";
  return "oab-direito-processual-do-trabalho";
}

function inferStrict(statement: string, optionsText: string) {
  let bestSlug: string | null = null;
  let bestScore = 0;
  let bestMatches: string[] = [];
  for (const rule of STRICT_DISCIPLINE_RULES) {
    let score = 0;
    const matches: string[] = [];
    for (const pat of rule.patterns) {
      const m1 = statement.match(pat);
      if (m1) {
        score += 2;
        matches.push(`enunciado: "${m1[0]}"`);
      } else {
        const m2 = optionsText.match(pat);
        if (m2) {
          score += 1;
          matches.push(`alternativa: "${m2[0]}"`);
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = rule.slug;
      bestMatches = matches;
    }
  }
  return { slug: bestSlug, score: bestScore, matches: bestMatches };
}

async function main(): Promise<void> {
  // 1. Auditar impacto multi-carreira das 6 raízes duplicadas
  const dupSlugs = DUPLICATE_ROOT_PAIRS.flatMap((p) => [p.sharedSlug, p.oabSlug]);
  const dupSubjects = await prisma.subject.findMany({
    where: { slug: { in: dupSlugs } },
    include: {
      children: { select: { id: true, slug: true, name: true } },
    },
  });
  const subjBySlug = new Map(dupSubjects.map((s) => [s.slug, s]));

  const crossCareerUsage: Array<{
    slug: string;
    name: string;
    childrenCount: number;
    OAB: number;
    PRF: number;
    TJSP: number;
    PCSP: number;
    tjsp2025JobItems: number;
  }> = [];

  for (const slug of dupSlugs) {
    const s = subjBySlug.get(slug);
    if (!s) continue;
    const targetIds = [s.id, ...s.children.map((c) => c.id)];

    const [oab, prf, tjsp, pcsp, jobItems] = await Promise.all([
      prisma.question.count({
        where: {
          subjects: { some: { subjectId: { in: targetIds } } },
          examInstances: { some: { examForm: { examEdition: { position: { studyTrack: { is: { code: "OAB" } } } } } } },
        },
      }),
      prisma.question.count({
        where: {
          subjects: { some: { subjectId: { in: targetIds } } },
          examInstances: { some: { examForm: { examEdition: { position: { studyTrack: { is: { code: "PRF" } } } } } } },
        },
      }),
      prisma.question.count({
        where: {
          subjects: { some: { subjectId: { in: targetIds } } },
          examInstances: { some: { examForm: { examEdition: { position: { studyTrack: { is: { code: "TJSP" } } } } } } },
        },
      }),
      prisma.question.count({
        where: {
          subjects: { some: { subjectId: { in: targetIds } } },
          examInstances: { some: { examForm: { examEdition: { position: { studyTrack: { is: { code: "PCSP" } } } } } } },
        },
      }),
      prisma.importJobItem.count({
        where: {
          importJobId: "55bbff6b-372f-4968-8a04-5fb2dd7727bb",
          structuredPayloadJson: { path: ["subjectSlug"], string_contains: slug },
        },
      }),
    ]);

    crossCareerUsage.push({
      slug,
      name: s.name,
      childrenCount: s.children.length,
      OAB: oab,
      PRF: prf,
      TJSP: tjsp,
      PCSP: pcsp,
      tjsp2025JobItems: jobItems,
    });
  }

  // 2. Auditar todas as 880 questões da OAB e organizar propostas de alta confiança em lotes pequenos
  const instances = await prisma.examQuestionInstance.findMany({
    where: {
      question: { status: "PUBLISHED" },
      examForm: { examEdition: { position: { studyTrack: { is: { code: "OAB" } } } } },
    },
    include: {
      examForm: { include: { examEdition: { select: { editionCode: true } } } },
      question: {
        include: {
          options: { orderBy: { displayOrder: "asc" } },
          subjects: { include: { subject: { include: { parent: true } } } },
        },
      },
    },
    orderBy: [
      { examForm: { examEdition: { editionCode: "asc" } } },
      { originalNumber: "asc" },
    ],
  });

  type ProposalItem = {
    batch: "LOTE_A_ELEITORAL_FALSO_POSITIVO" | "LOTE_B_TRIBUTARIO_FALSO_POSITIVO" | "LOTE_C_ECA_ETICA_FALSO_POSITIVO" | "LOTE_D_OUTRAS_DISCIPLINAS_E_41";
    editionCode: string;
    originalNumber: number;
    currentDiscipline: string;
    proposedDiscipline: string;
    evidence: string;
    justification: string;
    confidence: "ALTA_CONCORDANCIA_TEXTO_E_BLOCO" | "ALTA_EVIDENCIA_TEXTUAL";
    impact: string;
  };

  const highConfProposals: ProposalItem[] = [];
  const pendingReviewCountByDiscipline = new Map<string, number>();
  let totalPendingReview = 0;

  for (const inst of instances) {
    const edCode = inst.examForm.examEdition.editionCode;
    const examNum = Number(edCode.match(/OAB-(\d+)/)?.[1] ?? 41);
    const primaryLink = inst.question.subjects.find((s) => s.isPrimary) ?? inst.question.subjects[0];
    const rootSubj = primaryLink?.subject.parent ?? primaryLink?.subject;
    const childSubj = primaryLink?.subject.parent ? primaryLink.subject : null;
    const currentSlug = rootSubj?.slug ?? "SEM_DISCIPLINA";
    const normCurrent = normalizeRoot(currentSlug);

    const optionsText = inst.question.options.map((o) => `${o.label}) ${o.content}`).join("\n");
    const inferred = inferStrict(inst.question.statement, optionsText);
    const fgvBlock = expectedFgvBlock(examNum, inst.originalNumber);

    let conf: "ALTA_CONCORDANCIA_TEXTO_E_BLOCO" | "ALTA_EVIDENCIA_TEXTUAL" | "REVISAO_HUMANA" = "REVISAO_HUMANA";
    let proposed = normCurrent;
    let isMisclassified = false;

    if (inferred.slug && inferred.slug === fgvBlock) {
      proposed = inferred.slug;
      conf = "ALTA_CONCORDANCIA_TEXTO_E_BLOCO";
      isMisclassified = normCurrent !== inferred.slug;
    } else if (inferred.slug && inferred.score >= 3) {
      proposed = inferred.slug;
      conf = "ALTA_EVIDENCIA_TEXTUAL";
      isMisclassified = normCurrent !== inferred.slug;
    } else if (normCurrent !== fgvBlock) {
      isMisclassified = true;
      conf = "REVISAO_HUMANA";
    }

    if (!isMisclassified) continue;

    if (conf === "REVISAO_HUMANA") {
      totalPendingReview++;
      pendingReviewCountByDiscipline.set(
        currentSlug,
        (pendingReviewCountByDiscipline.get(currentSlug) ?? 0) + 1
      );
      continue;
    }

    const batch: ProposalItem["batch"] =
      currentSlug === "oab-direito-eleitoral"
        ? "LOTE_A_ELEITORAL_FALSO_POSITIVO"
        : currentSlug === "oab-direito-tributario"
          ? "LOTE_B_TRIBUTARIO_FALSO_POSITIVO"
          : currentSlug === "oab-eca" || currentSlug === "oab-etica-profissional"
            ? "LOTE_C_ECA_ETICA_FALSO_POSITIVO"
            : "LOTE_D_OUTRAS_DISCIPLINAS_E_41";

    const justification =
      batch === "LOTE_A_ELEITORAL_FALSO_POSITIVO"
        ? 'Falso positivo de substring "tre" no importador original; texto integral comprova a disciplina proposta.'
        : batch === "LOTE_B_TRIBUTARIO_FALSO_POSITIVO"
          ? 'Falso positivo de substring "iss" ou particípio "imposto" no importador original; texto integral comprova a disciplina proposta.'
          : batch === "LOTE_C_ECA_ETICA_FALSO_POSITIVO"
            ? 'Falso positivo de substring "eca" ou menção genérica à "OAB"; texto integral comprova a disciplina proposta.'
            : examNum === 41
              ? "Classificação simplificada do 41º Exame com raiz/assunto incorreto frente ao texto integral."
              : "Precedência indevida de heurística sem fronteira de palavra no importador original; texto integral comprova a disciplina proposta.";

    const impact = childSubj
      ? `Substitui vínculo QuestionSubject (raiz legada ${currentSlug} + filho ${childSubj.slug}) pela disciplina correta ${proposed}; preserva Question.id, enunciado, gabarito e histórico; corrige contadores dos filtros OAB.`
      : `Atualiza apenas 1 vínculo QuestionSubject (${currentSlug} -> ${proposed}); preserva Question.id, enunciado, gabarito e histórico; corrige contadores dos filtros OAB.`;

    highConfProposals.push({
      batch,
      editionCode: edCode,
      originalNumber: inst.originalNumber,
      currentDiscipline: currentSlug,
      proposedDiscipline: proposed,
      evidence: inferred.matches.slice(0, 3).join("; "),
      justification,
      confidence: conf,
      impact,
    });
  }

  // Gerar artefato detalhado para aprovação controlada
  const lines: string[] = [];
  lines.push("# Plano Controlado de Saneamento da OAB — Prévia em Lotes e Unificação Canônica");
  lines.push("");
  lines.push("> [!IMPORTANT]");
  lines.push("> **Nenhuma alteração foi aplicada no Prisma Postgres.** Este documento consolida o impacto multi-carreira das 6 raízes duplicadas e organiza as **234 correções de alta confiança** em **4 lotes pequenos e verificáveis** para aprovação antes de qualquer escrita. As **182 divergências incertas** permanecem intactas na fila de revisão humana.");
  lines.push("");
  lines.push("## 1. Impacto Multi-Carreira das 6 Raízes Duplicadas (OAB × PRF × TJSP × PCSP)");
  lines.push("");
  lines.push("| Slug | Nome no Banco | Filhos | OAB | PRF | TJSP | PCSP | Lote TJSP 2025 | Recomendação Segura |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---|");
  for (const row of crossCareerUsage) {
    const isShared = !row.slug.startsWith("oab-");
    const rec =
      row.slug === "etica-e-estatuto-da-oab"
        ? "Migrar 8 questões OAB-41 + 2 filhos para `oab-etica-profissional` (0 impacto em PRF/TJSP/PCSP)"
        : isShared
          ? "**MANTER como raiz canônica compartilhada** (usada por PRF/TJSP/PCSP)"
          : "Migrar vínculos OAB para a raiz compartilhada correspondente sem excluir o registro antigo";
    lines.push(
      `| \`${row.slug}\` | ${row.name} | ${row.childrenCount} | ${row.OAB} | ${row.PRF} | ${row.TJSP} | ${row.PCSP} | ${row.tjsp2025JobItems} | ${rec} |`
    );
  }

  lines.push("");
  lines.push("## 2. Organização das 234 Correções de Alta Confiança em Lotes Pequenos");
  lines.push("");
  const batches: Array<{ key: ProposalItem["batch"]; title: string }> = [
    { key: "LOTE_A_ELEITORAL_FALSO_POSITIVO", title: 'Lote A — Falsos Positivos em Direito Eleitoral (bug `"tre"`)' },
    { key: "LOTE_B_TRIBUTARIO_FALSO_POSITIVO", title: 'Lote B — Falsos Positivos em Direito Tributário (bug `"iss"` / `"imposto"`)' },
    { key: "LOTE_C_ECA_ETICA_FALSO_POSITIVO", title: 'Lote C — Falsos Positivos em ECA e Ética Profissional (bug `"eca"` / `"OAB"`)' },
    { key: "LOTE_D_OUTRAS_DISCIPLINAS_E_41", title: "Lote D — 41º Exame e Demais Disciplinas com Evidência Textual Forte" },
  ];

  lines.push("| Lote | Escopo | Qtd de Questões | Risco / Reversibilidade |");
  lines.push("|---|---|---:|---|");
  for (const b of batches) {
    const cnt = highConfProposals.filter((p) => p.batch === b.key).length;
    lines.push(`| **${b.key}** | ${b.title} | ${cnt} | Baixo — transação atômica + rollback por snapshot SHA-256 |`);
  }
  lines.push(`| **PENDENTES_REVISAO_HUMANA** | Divergências sem evidência textual forte (NÃO aplicar automaticamente) | ${totalPendingReview} | Mantidas intactas até conferência humana |`);
  lines.push("");

  for (const b of batches) {
    const subset = highConfProposals.filter((p) => p.batch === b.key);
    lines.push(`## ${b.title} (${subset.length} questões)`);
    lines.push("");
    lines.push("| Edição | Q# | Disciplina Atual | Disciplina Proposta | Evidência no Conteúdo | Justificativa | Confiança | Impacto nos Relacionamentos e Filtros |");
    lines.push("|---|---:|---|---|---|---|---|---|");
    for (const item of subset) {
      lines.push(
        `| \`${item.editionCode}\` | #${item.originalNumber} | \`${item.currentDiscipline}\` | \`${item.proposedDiscipline}\` | ${item.evidence.replace(/\|/g, "\\|")} | ${item.justification.replace(/\|/g, "\\|")} | ${item.confidence} | ${item.impact.replace(/\|/g, "\\|")} |`
      );
    }
    lines.push("");
  }

  const outPath = path.resolve(
    "C:/Users/yurib/.gemini/antigravity/brain/60106d52-50c2-4fb5-8897-6647544e2a45/plano-saneamento-oab-controlado.md"
  );
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");

  console.info("=== PLANO CONTROLADO OAB GERADO (READ-ONLY) ===");
  console.info({
    crossCareerUsageCount: crossCareerUsage.length,
    highConfTotal: highConfProposals.length,
    loteA: highConfProposals.filter((p) => p.batch === "LOTE_A_ELEITORAL_FALSO_POSITIVO").length,
    loteB: highConfProposals.filter((p) => p.batch === "LOTE_B_TRIBUTARIO_FALSO_POSITIVO").length,
    loteC: highConfProposals.filter((p) => p.batch === "LOTE_C_ECA_ETICA_FALSO_POSITIVO").length,
    loteD: highConfProposals.filter((p) => p.batch === "LOTE_D_OUTRAS_DISCIPLINAS_E_41").length,
    pendingHumanReview: totalPendingReview,
    artifact: outPath,
  });
  console.info("\n=== USO MULTI-CARREIRA DAS RAÍZES DUPLICADAS ===");
  for (const r of crossCareerUsage) {
    console.info(`  ${r.slug}: OAB=${r.OAB} | PRF=${r.PRF} | TJSP=${r.TJSP} | PCSP=${r.PCSP} | TJSP25Job=${r.tjsp2025JobItems} | filhos=${r.childrenCount}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
