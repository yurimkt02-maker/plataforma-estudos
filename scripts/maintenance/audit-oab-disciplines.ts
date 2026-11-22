import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

/**
 * AUDITORIA URGENTE E SOMENTE LEITURA (READ-ONLY) DAS 880 QUESTÕES DA OAB.
 * Não realiza nenhuma mutação no banco de dados.
 *
 * Objetivos:
 * 1. Auditar as 880 questões publicadas da OAB por edição (37º ao 47º Exame).
 * 2. Comparar a disciplina atual no banco com o conteúdo textual real (regras com
 *    fronteiras de palavra \b, sem o bug de substring "tre"/"iss"/"eca") e com a
 *    composição verificável por bloco de cada edição (37º vs 38º-47º).
 * 3. Identificar raízes duplicadas (41º Exame vs 37º-40º/42º-47º) e assuntos filhos.
 * 4. Gerar prévia detalhada e plano reversível de correção taxonômica.
 */

// Mapeamento canônico proposto entre raízes duplicadas existentes no banco
const DUPLICATE_ROOT_CANONICAL_MAP: Array<{
  legacyRootSlug: string;
  legacyRootName: string;
  oabRootSlug: string;
  oabRootName: string;
  recommendedCanonicalSlug: string;
  rationale: string;
}> = [
  {
    legacyRootSlug: "etica-e-estatuto-da-oab",
    legacyRootName: "Ética Profissional e Estatuto da Advocacia (Lei nº 8.906/1994)",
    oabRootSlug: "oab-etica-profissional",
    oabRootName: "Ética Profissional e Estatuto da OAB",
    recommendedCanonicalSlug: "oab-etica-profissional",
    rationale: "Unificar as 8 questões do 41º Exame sob a raiz OAB padrão, movendo os 2 filhos já existentes para oab-etica-profissional.",
  },
  {
    legacyRootSlug: "direito-constitucional",
    legacyRootName: "Direito Constitucional",
    oabRootSlug: "oab-direito-constitucional",
    oabRootName: "Direito Constitucional (OAB)",
    recommendedCanonicalSlug: "direito-constitucional",
    rationale: "Manter disciplina-mãe única compartilhada entre OAB/PRF/TJSP/PCSP ou padronizar raízes OAB — decisão reversível via remapeamento de QuestionSubject.",
  },
  {
    legacyRootSlug: "direito-administrativo",
    legacyRootName: "Direito Administrativo",
    oabRootSlug: "oab-direito-administrativo",
    oabRootName: "Direito Administrativo (OAB)",
    recommendedCanonicalSlug: "direito-administrativo",
    rationale: "Evita que o filtro de Disciplina exiba 'Direito Administrativo' e 'Direito Administrativo (OAB)' como duas disciplinas distintas.",
  },
  {
    legacyRootSlug: "direito-penal",
    legacyRootName: "Direito Penal",
    oabRootSlug: "oab-direito-penal",
    oabRootName: "Direito Penal (OAB)",
    recommendedCanonicalSlug: "direito-penal",
    rationale: "Unifica a disciplina entre 41º Exame e demais edições OAB/PRF/TJSP/PCSP sem duplicar o filtro.",
  },
  {
    legacyRootSlug: "direito-processual-penal",
    legacyRootName: "Direito Processual Penal",
    oabRootSlug: "oab-direito-processual-penal",
    oabRootName: "Direito Processual Penal (OAB)",
    recommendedCanonicalSlug: "direito-processual-penal",
    rationale: "Unifica a disciplina entre 41º Exame e demais edições.",
  },
  {
    legacyRootSlug: "direito-processual-civil",
    legacyRootName: "Direito Processual Civil",
    oabRootSlug: "oab-direito-processual-civil",
    oabRootName: "Direito Processual Civil (OAB)",
    recommendedCanonicalSlug: "direito-processual-civil",
    rationale: "Unifica a disciplina entre 41º Exame e demais edições.",
  },
];

// Regras rigorosas com \b (word boundaries) para inferir disciplina real pelo conteúdo
const CONTENT_DISCIPLINE_RULES: Array<{
  slug: string;
  label: string;
  patterns: RegExp[];
}> = [
  {
    slug: "oab-etica-profissional",
    label: "Ética Profissional e Estatuto da OAB",
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
    label: "Filosofia do Direito",
    patterns: [
      /\b(?:arist[oó]teles|immanuel\s+kant|hans\s+kelsen|herbert\s+hart|ronald\s+dworkin|john\s+rawls|norberto\s+bobbio|hannah\s+arendt|montesquieu|rousseau|thomas\s+hobbes|john\s+locke|habermas|miguel\s+reale|robert\s+alexy|cha[iï]m\s+perelman|maquiavel|s[aã]o\s+tom[aá]s\s+de\s+aquino|jeremy\s+bentham|john\s+stuart\s+mill|michel\s+foucault|gustav\s+radbruch|lon\s+fuller|alf\s+ross|carl\s+schmitt)\b/i,
      /\bfilosofia\s+do\s+direito\b|\bjusnaturalismo\b|\bpositivismo\s+jur[ií]dico\b/i,
    ],
  },
  {
    slug: "oab-direito-eleitoral",
    label: "Direito Eleitoral",
    patterns: [
      /\bjusti[cç]a\s+eleitoral\b|\bc[oó]digo\s+eleitoral\b|\bpropaganda\s+eleitoral\b/i,
      /\b(?:tse|tribunal\s+superior\s+eleitoral|tribunal\s+regional\s+eleitoral)\b/i,
      /\b(?:inelegibilidade|lei\s+da\s+ficha\s+limpa|registro\s+de\s+candidatura|presta[cç][aã]o\s+de\s+contas\s+eleitorais|fundo\s+partid[aá]rio|fundo\s+especial\s+de\s+financiamento\s+de\s+campanha|coliga[cç][aã]o|federa[cç][aã]o\s+partid[aá]ria|conven[cç][aã]o\s+partid[aá]ria|aije|aime|rced)\b/i,
    ],
  },
  {
    slug: "oab-direito-financeiro",
    label: "Direito Financeiro",
    patterns: [
      /\bdireito\s+financeiro\b|\blei\s+de\s+responsabilidade\s+fiscal\b|\blrf\b/i,
      /\blei\s+or[cç]ament[aá]ria\s+anual\b|\bloa\b|\blei\s+de\s+diretrizes\s+or[cç]ament[aá]rias\b|\bldo\b|\bplano\s+plurianual\b|\bppa\b/i,
      /\bcr[eé]ditos?\s+(?:adicionais|suplementares|especiais|extraordin[aá]rios)\b|\bor[cç]amento\s+p[uú]blico\b|\bdespesa\s+p[uú]blica\b|\bprecat[oó]rios?\b|\bd[ií]vida\s+p[uú]blica\b/i,
    ],
  },
  {
    slug: "oab-direito-previdenciario",
    label: "Direito Previdenciário",
    patterns: [
      /\b(?:inss|rgps|regime\s+geral\s+de\s+previd[eê]ncia\s+social|previd[eê]ncia\s+social|seguridade\s+social)\b/i,
      /\b(?:aposentadoria|aux[ií]lio-doen[cç]a|aux[ií]lio\s+por\s+incapacidade|pens[aã]o\s+por\s+morte|sal[aá]rio-maternidade|aux[ií]lio-reclus[aã]o|aux[ií]lio-acidente|bpc|loas|segurado\s+(?:obrigat[oó]rio|facultativo|especial)|car[eê]ncia\s+previdenci[aá]ria)\b/i,
    ],
  },
  {
    slug: "oab-direito-ambiental",
    label: "Direito Ambiental",
    patterns: [
      /\bdireito\s+ambiental\b|\bmeio\s+ambiente\b|\blicenciamento\s+ambiental\b|\b(?:ibama|sisnama|conama|icmbio)\b/i,
      /\bunidade\s+de\s+conserva[cç][aã]o\b|\b[aá]rea\s+de\s+preserva[cç][aã]o\s+permanente\b|\breserva\s+legal\b|\bc[oó]digo\s+florestal\b|\bpoluidor-pagador\b|\bdano\s+ambiental\b|\bflora\b|\bfauna\b/i,
    ],
  },
  {
    slug: "oab-direito-do-consumidor",
    label: "Direito do Consumidor",
    patterns: [
      /\bc[oó]digo\s+de\s+defesa\s+do\s+consumidor\b|\bcdc\b|\bprocon\b/i,
      /\brela[cç][aã]o\s+de\s+consumo\b|\bv[ií]cio\s+do\s+(?:produto|servi[cç]o)\b|\bfato\s+do\s+(?:produto|servi[cç]o)\b|\bpr[aá]tica\s+abusiva\b|\bdireito\s+de\s+arrependimento\b|\bsuperendividamento\b|\bfornecedor\b.*\bconsumidor\b/i,
    ],
  },
  {
    slug: "oab-eca",
    label: "Direito da Criança e do Adolescente (ECA)",
    patterns: [
      /\bestatuto\s+da\s+crian[cç]a\s+e\s+do\s+adolescente\b|\beca\b/i,
      /\bconselho\s+tutelar\b|\bato\s+infracional\b|\bmedida\s+socioeducativa\b|\binterna[cç][aã]o\b.*\badolescente\b|\bado[cç][aã]o\b.*\b(?:crian[cç]a|adolescente|cadastro)\b|\bautoriza[cç][aã]o\s+para\s+viajar\b/i,
    ],
  },
  {
    slug: "oab-direitos-humanos",
    label: "Direitos Humanos",
    patterns: [
      /\bdireitos\s+humanos\b|\bpacto\s+de\s+san\s+jos[eé]\b|\bconven[cç][aã]o\s+americana\s+sobre\s+direitos\s+humanos\b/i,
      /\b(?:corte\s+interamericana|comiss[aã]o\s+interamericana|declara[cç][aã]o\s+universal\s+dos\s+direitos\s+humanos|sistema\s+interamericano|tratado\s+internacional\s+de\s+direitos\s+humanos|protocolo\s+de\s+san\s+salvador|regras\s+de\s+mandela|regras\s+de\s+bangkok)\b/i,
    ],
  },
  {
    slug: "oab-direito-internacional",
    label: "Direito Internacional",
    patterns: [
      /\bdireito\s+internacional\b|\blei\s+de\s+migra[cç][aã]o\b|\blaw\b|\blindb\b/i,
      /\b(?:extradi[cç][aã]o|deporta[cç][aã]o|expuls[aã]o|repatria[cç][aã]o|homologa[cç][aã]o\s+de\s+senten[cç]a\s+estrangeira|carta\s+rogat[oó]ria|imunidade\s+de\s+jurisdi[cç][aã]o|c[oô]nsul|embaixada|mercosul|arbitragem\s+internacional|estatuto\s+do\s+estrangeiro|visto\s+tempor[aá]rio)\b/i,
    ],
  },
  {
    slug: "oab-direito-tributario",
    label: "Direito Tributário",
    patterns: [
      /\bc[oó]digo\s+tribut[aá]rio\s+nacional\b|\bctn\b|\bdireito\s+tribut[aá]rio\b/i,
      /\b(?:icms|issqn|iptu|ipva|itbi|itcmd|irpf|irpj|ipi|iof|cofins|csll|tributo|imunidade\s+tribut[aá]ria|isen[cç][aã]o\s+tribut[aá]ria|fato\s+gerador|lan[cç]amento\s+tribut[aá]rio|cr[eé]dito\s+tribut[aá]rio|execu[cç][aã]o\s+fiscal|contribui[cç][aã]o\s+de\s+melhoria|empr[eé]stimo\s+compuls[oó]rio|anterioridade\s+(?:anual|nonagesimal)|substitui[cç][aã]o\s+tribut[aá]ria)\b/i,
    ],
  },
  {
    slug: "oab-direito-empresarial",
    label: "Direito Empresarial",
    patterns: [
      /\b(?:sociedade\s+an[oô]nima|sociedade\s+limitada|recupera[cç][aã]o\s+judicial|fal[eê]ncia|massa\s+falida|t[ií]tulo\s+de\s+cr[eé]dito|cheque|duplicata|nota\s+promiss[oó]ria|letra\s+de\s+c[aâ]mbio|endosso|aval|estabelecimento\s+empresarial|trespasse|propriedade\s+industrial|patente|empres[aá]rio\s+individual|junta\s+comercial|microempresa|saf|deb[eê]ntures|franquia|aliena[cç][aã]o\s+fiduci[aá]ria\s+em\s+garantia)\b/i,
    ],
  },
  {
    slug: "oab-direito-processual-do-trabalho",
    label: "Direito Processual do Trabalho",
    patterns: [
      /\b(?:reclama[cç][aã]o\s+trabalhista|recurso\s+ordin[aá]rio|recurso\s+de\s+revista|tst|trt|vara\s+do\s+trabalho|justi[cç]a\s+do\s+trabalho|diss[ií]dio\s+(?:individual|coletivo)|execu[cç][aã]o\s+trabalhista|audi[eê]ncia\s+trabalhista|processo\s+do\s+trabalho|dep[oó]sito\s+recursal|agravo\s+de\s+peti[cç][aã]o|rito\s+sumar[ií]ssimo|reclamante|reclamada)\b/i,
    ],
  },
  {
    slug: "oab-direito-do-trabalho",
    label: "Direito do Trabalho",
    patterns: [
      /\b(?:clt|consolida[cç][aã]o\s+das\s+leis\s+do\s+trabalho|contrato\s+de\s+trabalho|aviso\s+pr[eé]vio|fgts|f[eé]rias\s+proporcionais|adicional\s+de\s+(?:insalubridade|periculosidade|noturno)|justa\s+causa|rescis[aã]o\s+indireta|jornada\s+de\s+trabalho|banco\s+de\s+horas|teletrabalho|estabilidade\s+provis[oó]ria|cipa|sindicato|acordo\s+coletivo|conven[cç][aã]o\s+coletiva|terceiriza[cç][aã]o|empregado\s+dom[eé]stico)\b/i,
    ],
  },
  {
    slug: "oab-direito-processual-penal",
    label: "Direito Processual Penal (OAB)",
    patterns: [
      /\b(?:c[oó]digo\s+de\s+processo\s+penal|cpp|inqu[eé]rito\s+policial|a[cç][aã]o\s+penal\s+(?:p[uú]blica|privada)|pris[aã]o\s+(?:preventiva|tempor[aá]ria|em\s+flagrante|domiciliar)|tribunal\s+do\s+j[uú]ri|recurso\s+em\s+sentido\s+estrito|audi[eê]ncia\s+de\s+cust[oó]dia|acordo\s+de\s+n[aã]o\s+persecu[cç][aã]o\s+penal|anpp|queixa-crime|den[uú]ncia\s+oferecida|juiz\s+das\s+garantias|cadeia\s+de\s+cust[oó]dia|revis[aã]o\s+criminal|execu[cç][aã]o\s+penal|lep)\b/i,
    ],
  },
  {
    slug: "oab-direito-penal",
    label: "Direito Penal (OAB)",
    patterns: [
      /\b(?:c[oó]digo\s+penal|homic[ií]dio|feminic[ií]dio|furto|roubo|latroc[ií]nio|estelionato|peculato|concuss[aã]o|corrup[cç][aã]o\s+(?:ativa|passiva)|leg[ií]tima\s+defesa|estado\s+de\s+necessidade|desist[eê]ncia\s+volunt[aá]ria|arrependimento\s+(?:eficaz|posterior)|erro\s+de\s+(?:tipo|proibi[cç][aã]o)|dosimetria|pena\s+privativa\s+de\s+liberdade|livramento\s+condicional|sursis|lei\s+maria\s+da\s+penha|tr[aá]fico\s+de\s+drogas|estupro|cal[uú]nia|difama[cç][aã]o|inj[uú]ria)\b/i,
    ],
  },
  {
    slug: "oab-direito-processual-civil",
    label: "Direito Processual Civil (OAB)",
    patterns: [
      /\b(?:c[oó]digo\s+de\s+processo\s+civil|cpc|agravo\s+de\s+instrumento|embargos\s+de\s+declara[cç][aã]o|cumprimento\s+de\s+senten[cç]a|tutela\s+(?:provis[oó]ria|antecipada|de\s+urg[eê]ncia|de\s+evid[eê]ncia)|litiscons[oó]rcio|contesta[cç][aã]o|reconven[cç][aã]o|a[cç][aã]o\s+rescis[oó]ria|juizado\s+especial\s+c[ií]vel|incidente\s+de\s+desconsidera[cç][aã]o|penhora|chamamento\s+ao\s+processo|denuncia[cç][aã]o\s+da\s+lide|coisa\s+julgada|recurso\s+especial|recurso\s+extraordin[aá]rio|execu[cç][aã]o\s+de\s+t[ií]tulo\s+extrajudicial)\b/i,
    ],
  },
  {
    slug: "oab-direito-administrativo",
    label: "Direito Administrativo (OAB)",
    patterns: [
      /\b(?:licita[cç][aã]o|lei\s+n?[º°]?\s*14\.133|improbidade\s+administrativa|ato\s+administrativo|servi[cç]o\s+p[uú]blico|concess[aã]o\s+de\s+servi[cç]o|permiss[aã]o\s+de\s+servi[cç]o|desapropria[cç][aã]o|tombamento|servid[aã]o\s+administrativa|responsabilidade\s+civil\s+do\s+estado|servidor\s+p[uú]blico|autarquia|empresa\s+p[uú]blica|sociedade\s+de\s+economia\s+mista|poder\s+de\s+pol[ií]cia|processo\s+administrativo\s+disciplinar|ppp|parceria\s+p[uú]blico-privada)\b/i,
    ],
  },
  {
    slug: "oab-direito-constitucional",
    label: "Direito Constitucional (OAB)",
    patterns: [
      /\b(?:constitui[cç][aã]o\s+federal|crfb|controle\s+(?:concentrado|difuso)\s+de\s+constitucionalidade|a[cç][aã]o\s+direta\s+de\s+inconstitucionalidade|adi\b|adpf\b|adc\b|ado\b|processo\s+legislativo|medida\s+provis[oó]ria|emenda\s+constitucional|estado\s+de\s+defesa|estado\s+de\s+s[ií]tio|interven[cç][aã]o\s+federal|comiss[aã]o\s+parlamentar\s+de\s+inqu[eé]rito|cpi\b|mandado\s+de\s+(?:seguran[cç]a|injun[cç][aã]o)|a[cç][aã]o\s+popular|reparti[cç][aã]o\s+de\s+compet[eê]ncias|imunidade\s+parlamentar)\b/i,
    ],
  },
  {
    slug: "oab-direito-civil",
    label: "Direito Civil",
    patterns: [
      /\b(?:c[oó]digo\s+civil|usucapi[aã]o|casamento|div[oó]rcio|uni[aã]o\s+est[aá]vel|regime\s+de\s+bens|testamento|heran[cç]a|herdeir[oa]|sucess[aã]o\s+leg[ií]tima|invent[aá]rio|alimentos|condom[ií]nio\s+edil[ií]cio|compra\s+e\s+venda|doa[cç][aã]o|fian[cç]a|comodato|m[uú]tuo|evic[cç][aã]o|v[ií]cio\s+redibit[oó]rio|neg[oó]cio\s+jur[ií]dico|simula[cç][aã]o|fraude\s+contra\s+credores|bem\s+de\s+fam[ií]lia|hipoteca|usufruto|curatela|emancipa[cç][aã]o)\b/i,
    ],
  },
];

// Normaliza slugs legados do 41º Exame para o equivalente OAB para comparação uniforme
function normalizeRootForComparison(slug: string): string {
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

// Faixa típica FGV (apenas como apoio analítico, nunca presunção absoluta)
function expectedFgBlock(examNum: number, qNum: number): string {
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
  // 37º Exame (17 disciplinas)
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

function inferDisciplineByText(statement: string, optionsText: string): {
  slug: string | null;
  score: number;
  matches: string[];
} {
  let bestSlug: string | null = null;
  let bestScore = 0;
  let bestMatches: string[] = [];

  for (const rule of CONTENT_DISCIPLINE_RULES) {
    let score = 0;
    const matches: string[] = [];
    for (const pat of rule.patterns) {
      const m1 = statement.match(pat);
      if (m1) {
        score += 2;
        matches.push(`enunciado:"${m1[0]}"`);
      } else {
        const m2 = optionsText.match(pat);
        if (m2) {
          score += 1;
          matches.push(`alt:"${m2[0]}"`);
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
  const instances = await prisma.examQuestionInstance.findMany({
    where: {
      question: { status: "PUBLISHED" },
      examForm: {
        examEdition: {
          position: { studyTrack: { is: { code: "OAB" } } },
        },
      },
    },
    include: {
      examForm: {
        include: {
          examEdition: { select: { editionCode: true, title: true, year: true } },
        },
      },
      question: {
        include: {
          options: { orderBy: { displayOrder: "asc" } },
          subjects: {
            include: {
              subject: {
                include: { parent: { select: { slug: true, name: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { examForm: { examEdition: { editionCode: "asc" } } },
      { originalNumber: "asc" },
    ],
  });

  type AuditRow = {
    questionId: string;
    editionCode: string;
    examNum: number;
    qNum: number;
    currentRootSlug: string;
    currentRootName: string;
    currentChildSlug: string | null;
    inferredByText: string | null;
    textEvidence: string[];
    fgvTypicalBlock: string;
    recommendedSlug: string;
    confidence: "ALTA_CONCORDANCIA_TEXTO_E_BLOCO" | "ALTA_EVIDENCIA_TEXTUAL" | "REVISAO_HUMANA";
    isMisclassified: boolean;
    hasLegacyRoot: boolean;
    suspectedBugCause: string | null;
    excerpt: string;
  };

  const rows: AuditRow[] = [];
  const perEditionCounts = new Map<string, Map<string, number>>();

  for (const inst of instances) {
    const edCode = inst.examForm.examEdition.editionCode;
    const examNumMatch = edCode.match(/OAB-(\d+)/);
    const examNum = examNumMatch ? Number(examNumMatch[1]) : 41;

    // Identifica disciplina raiz atual e eventual filho
    const primaryLink = inst.question.subjects.find((s) => s.isPrimary) ?? inst.question.subjects[0];
    const rootSubj = primaryLink?.subject.parent ?? primaryLink?.subject;
    const childSubj = primaryLink?.subject.parent ? primaryLink.subject : null;
    const currentRootSlug = rootSubj?.slug ?? "SEM_DISCIPLINA";
    const currentRootName = rootSubj?.name ?? "Sem disciplina";

    const edMap = perEditionCounts.get(edCode) ?? new Map<string, number>();
    edMap.set(currentRootSlug, (edMap.get(currentRootSlug) ?? 0) + 1);
    perEditionCounts.set(edCode, edMap);

    const optionsText = inst.question.options.map((o) => `${o.label}) ${o.content}`).join("\n");
    const inferred = inferDisciplineByText(inst.question.statement, optionsText);
    const fgvBlock = expectedFgBlock(examNum, inst.originalNumber);
    const normCurrent = normalizeRootForComparison(currentRootSlug);
    const hasLegacyRoot = currentRootSlug !== normCurrent;

    let recommendedSlug = normCurrent;
    let confidence: AuditRow["confidence"] = "REVISAO_HUMANA";
    let isMisclassified = false;

    if (inferred.slug && inferred.slug === fgvBlock) {
      recommendedSlug = inferred.slug;
      confidence = "ALTA_CONCORDANCIA_TEXTO_E_BLOCO";
      isMisclassified = normCurrent !== inferred.slug;
    } else if (inferred.slug && inferred.score >= 3) {
      recommendedSlug = inferred.slug;
      confidence = "ALTA_EVIDENCIA_TEXTUAL";
      isMisclassified = normCurrent !== inferred.slug;
    } else if (normCurrent !== fgvBlock) {
      // Texto não confirmou o bloco típico com >=3 pontos, mas diverge do bloco esperado
      recommendedSlug = inferred.slug ?? fgvBlock;
      confidence = "REVISAO_HUMANA";
      isMisclassified = true;
    }

    // Detectar causa provável do bug de substring original
    const lowerAll = `${inst.question.statement} ${optionsText}`.toLowerCase();
    let suspectedBugCause: string | null = null;
    if (isMisclassified) {
      if (currentRootSlug === "oab-direito-eleitoral" && lowerAll.includes("tre") && !/\btre\b/.test(lowerAll)) {
        suspectedBugCause = 'Bug de substring "tre" (ex.: entre/contra/registro) em download_and_extract_oab_all.py';
      } else if (currentRootSlug === "oab-direito-tributario" && lowerAll.includes("iss") && !/\biss\b/.test(lowerAll)) {
        suspectedBugCause = 'Bug de substring "iss" (ex.: comissão/omissão/demissão/permissão) em download_and_extract_oab_all.py';
      } else if (currentRootSlug === "oab-direito-tributario" && /\bimposto\b/.test(lowerAll)) {
        suspectedBugCause = 'Falso positivo de "imposto" (particípio do verbo impor)';
      } else if (currentRootSlug === "oab-eca" && lowerAll.includes("eca") && !/\beca\b/.test(lowerAll)) {
        suspectedBugCause = 'Bug de substring "eca" (ex.: decadência/mecanismo/recai)';
      } else if (currentRootSlug === "oab-etica-profissional" && /\boab\b/.test(lowerAll)) {
        suspectedBugCause = 'Falso positivo genérico por menção à sigla "OAB" no enunciado';
      } else if (hasLegacyRoot) {
        suspectedBugCause = "Raiz legada do 41º Exame (sem prefixo oab-*) + heurística simplificada";
      } else {
        suspectedBugCause = "Heurística de palavras-chave sem fronteira de palavra ou precedência de if";
      }
    }

    rows.push({
      questionId: inst.question.id,
      editionCode: edCode,
      examNum,
      qNum: inst.originalNumber,
      currentRootSlug,
      currentRootName,
      currentChildSlug: childSubj?.slug ?? null,
      inferredByText: inferred.slug,
      textEvidence: inferred.matches.slice(0, 3),
      fgvTypicalBlock: fgvBlock,
      recommendedSlug,
      confidence,
      isMisclassified,
      hasLegacyRoot,
      suspectedBugCause,
      excerpt: inst.question.statement.replace(/\s+/g, " ").trim().slice(0, 130),
    });
  }

  const total = rows.length;
  const misclassified = rows.filter((r) => r.isMisclassified);
  const highConfFixes = misclassified.filter((r) => r.confidence !== "REVISAO_HUMANA");
  const reviewNeededFixes = misclassified.filter((r) => r.confidence === "REVISAO_HUMANA");
  const legacyRootCount = rows.filter((r) => r.hasLegacyRoot).length;

  console.info("=== AUDITORIA URGENTE OAB (880 QUESTÕES — READ-ONLY) ===");
  console.info({
    totalOab: total,
    totalMisclassifiedDetected: misclassified.length,
    highConfidenceFixes: highConfFixes.length,
    humanReviewNeeded: reviewNeededFixes.length,
    legacyRoot41stItems: legacyRootCount,
  });

  // Breakdown por edição
  const editionOrder = [...perEditionCounts.keys()].sort();
  console.info("\n=== ERROS DETECTADOS POR EDIÇÃO ===");
  for (const ed of editionOrder) {
    const edRows = rows.filter((r) => r.editionCode === ed);
    const edMis = edRows.filter((r) => r.isMisclassified);
    const eleitoralCount = edRows.filter((r) => r.currentRootSlug === "oab-direito-eleitoral").length;
    const tribCount = edRows.filter((r) => r.currentRootSlug === "oab-direito-tributario").length;
    console.info(
      `  ${ed}: total=${edRows.length} | divergentes=${edMis.length} (altaConf=${edMis.filter((r) => r.confidence !== "REVISAO_HUMANA").length}) | EleitoralAtual=${eleitoralCount} | TributarioAtual=${tribCount}`
    );
  }

  // Gerar artefato detalhado de auditoria e plano reversível
  const lines: string[] = [];
  lines.push("# Auditoria Urgente — Disciplinas e Taxonomia da OAB (880 Questões)");
  lines.push("");
  lines.push("> [!CAUTION]");
  lines.push("> **Modo somente leitura (Read-Only):** Nenhuma questão, enunciado, alternativa, gabarito ou vínculo `QuestionSubject` foi alterado no Prisma Postgres. As 101 propostas do Lote 1 foram suspensas até a correção validada das disciplinas raiz.");
  lines.push("");
  lines.push("## 1. Diagnóstico Executivo e Causa Raiz Comprovada");
  lines.push("");
  lines.push(`- **Total auditado:** **${total}** questões publicadas da OAB (37º ao 47º Exame).`);
  lines.push(`- **Divergências de disciplina raiz detectadas:** **${misclassified.length}** questões (${((misclassified.length / total) * 100).toFixed(1)}% do acervo OAB):`);
  lines.push(`  - **${highConfFixes.length}** com alta confiança (concordância entre evidência textual rigorosa com \`\\b\` e estrutura real da prova FGV, ou evidência textual forte ≥ 3 pontos).`);
  lines.push(`  - **${reviewNeededFixes.length}** encaminhadas para revisão humana antes de qualquer alteração.`);
  lines.push(`- **Raízes duplicadas (41º Exame):** **${legacyRootCount}** questões do \`OAB-41-1FASE\` usam raízes sem prefixo \`oab-*\` (\`direito-constitucional\`, \`direito-penal\`, \`etica-e-estatuto-da-oab\`, etc.), gerando disciplinas duplicadas no filtro.`);
  lines.push("");
  lines.push("### Causa Raiz Técnica no Importador Original (`download_and_extract_oab_all.py`)");
  lines.push("");
  lines.push("A função `classify_oab_20_disciplines` utilizava busca por **substring simples (`k in lower`) sem fronteira de palavra (`\\b`)**, executada **antes** da faixa oficial da prova:");
  lines.push("- **`\"tre\" in lower`** (linha 188) capturou qualquer questão contendo palavras comuns como *en**tre***, *con**tre***, *en**tre**tanto*, *en**tre**ga*, *regis**tre*** → inflou **Direito Eleitoral para 119 questões** (quando o esperado nas 10 edições 38º–47º é ~20).");
  lines.push("- **`\"iss\" in lower`** (linha 204) capturou palavras como *com**iss**ão*, *om**iss**ão*, *dem**iss**ão*, *perm**iss**ão*, *d**iss**ídio*, *comprom**iss**o* + o particípio *imposto* → inflou **Direito Tributário para 151 questões** (esperado ~50–55).");
  lines.push("- **`\"eca\" in lower`** (linha 198) capturou *d**eca**dência*, *r**eca**i*, *m**eca**nismo* → inflou **ECA para 36 questões** (esperado ~20–22).");
  lines.push("- **`\"oab\" in lower`** (linha 184) capturou questões de outras disciplinas que citam \"debate na OAB\" ou \"advogado\" no enunciado.");
  lines.push("");
  lines.push("## 2. Auditoria por Edição (37º ao 47º Exame)");
  lines.push("");
  lines.push("| Edição | Total | Divergentes | Alta Confiança | Revisão Humana | Eleitoral Atual | Tributário Atual | ECA Atual | Raiz Legada (41º) |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");

  for (const ed of editionOrder) {
    const edRows = rows.filter((r) => r.editionCode === ed);
    const edMis = edRows.filter((r) => r.isMisclassified);
    const hi = edMis.filter((r) => r.confidence !== "REVISAO_HUMANA").length;
    const rev = edMis.length - hi;
    const ele = edRows.filter((r) => r.currentRootSlug === "oab-direito-eleitoral").length;
    const tri = edRows.filter((r) => r.currentRootSlug === "oab-direito-tributario").length;
    const eca = edRows.filter((r) => r.currentRootSlug === "oab-eca").length;
    const leg = edRows.filter((r) => r.hasLegacyRoot).length;
    lines.push(`| \`${ed}\` | ${edRows.length} | ${edMis.length} | ${hi} | ${rev} | ${ele} | ${tri} | ${eca} | ${leg} |`);
  }

  lines.push("");
  lines.push("## 3. Distribuição Atual vs. Distribuição Corrigida Proposta (Todas as 880 Questões)");
  lines.push("");
  const currentDist = new Map<string, number>();
  const proposedDist = new Map<string, number>();
  for (const r of rows) {
    const cur = normalizeRootForComparison(r.currentRootSlug);
    currentDist.set(cur, (currentDist.get(cur) ?? 0) + 1);
    proposedDist.set(r.recommendedSlug, (proposedDist.get(r.recommendedSlug) ?? 0) + 1);
  }
  const allDiscSlugs = [...new Set([...currentDist.keys(), ...proposedDist.keys()])].sort();
  lines.push("| Disciplina (Normalizada) | Qtd Atual no Banco | Qtd Após Correção Proposta | Delta |");
  lines.push("|---|---:|---:|---:|");
  for (const slug of allDiscSlugs) {
    const cur = currentDist.get(slug) ?? 0;
    const prop = proposedDist.get(slug) ?? 0;
    const delta = prop - cur;
    lines.push(`| \`${slug}\` | ${cur} | ${prop} | ${delta >= 0 ? `+${delta}` : delta} |`);
  }

  lines.push("");
  lines.push("## 4. Raízes Duplicadas e Mapeamento Canônico Proposto");
  lines.push("");
  lines.push("| Raiz Legada (41º Exame / Outras Carreiras) | Raiz OAB (`oab-*`) | Recomendação Canônica | Justificativa |");
  lines.push("|---|---|---|---|");
  for (const m of DUPLICATE_ROOT_CANONICAL_MAP) {
    lines.push(`| \`${m.legacyRootSlug}\` (${m.legacyRootName}) | \`${m.oabRootSlug}\` (${m.oabRootName}) | \`${m.recommendedCanonicalSlug}\` | ${m.rationale} |`);
  }

  lines.push("");
  lines.push("## 5. Exemplos Concretos de Classificações Incorretas (Amostra Verificada)");
  lines.push("");
  lines.push("| Edição | Q# | Atual no Banco | Proposta Correta | Causa Raiz | Trecho Real do Enunciado |");
  lines.push("|---|---:|---|---|---|---|");
  const sampleExamples = [
    ...misclassified.filter((r) => r.currentRootSlug === "oab-direito-eleitoral" && r.confidence === "ALTA_CONCORDANCIA_TEXTO_E_BLOCO").slice(0, 8),
    ...misclassified.filter((r) => r.currentRootSlug === "oab-direito-tributario" && r.confidence === "ALTA_CONCORDANCIA_TEXTO_E_BLOCO").slice(0, 8),
    ...misclassified.filter((r) => r.currentRootSlug === "oab-eca" && r.confidence === "ALTA_CONCORDANCIA_TEXTO_E_BLOCO").slice(0, 4),
    ...misclassified.filter((r) => r.currentRootSlug === "oab-etica-profissional" && r.confidence !== "REVISAO_HUMANA").slice(0, 4),
  ];
  for (const ex of sampleExamples) {
    lines.push(
      `| \`${ex.editionCode}\` | #${ex.qNum} | \`${ex.currentRootSlug}\` | \`${ex.recommendedSlug}\` | ${(ex.suspectedBugCause ?? "-").replace(/\|/g, "\\|")} | ${ex.excerpt.replace(/\|/g, "\\|")}... |`
    );
  }

  lines.push("");
  lines.push("## 6. Plano Reversível de Correção (Antes de Qualquer Mutação)");
  lines.push("");
  lines.push("1. **Snapshot pré-alteração (`backups/oab-subjects-snapshot-<timestamp>.json`):** exportar todos os vínculos `QuestionSubject` das 880 questões da OAB (com `questionId`, `subjectId`, `subjectSlug`, `isPrimary`) para permitir rollback integral em 1 comando.");
  lines.push("2. **Correção das disciplinas raiz com alta confiança (transação atômica):** atualizar apenas o vínculo `QuestionSubject` das questões validadas, preservando 100% dos `Question.id`, enunciados, alternativas, gabaritos, simulados e histórico de respostas do usuário.");
  lines.push("3. **Fila de revisão humana:** listar separadamente as questões com `confidence = REVISAO_HUMANA` para decisão caso a caso.");
  lines.push("4. **Unificação das raízes duplicadas:** após sua aprovação do mapeamento canônico (Seção 4), migrar os vínculos das 6 disciplinas duplicadas e manter os `Subject`s legados sem exclusão destrutiva (apenas sem questões duplicadas) ou redirecionados de forma reversível.");
  lines.push("5. **Retomada da classificação temática (assuntos filhos):** somente após as 880 disciplinas raiz estarem saneadas e validadas, re-executar o Lote 1 de assuntos filhos da OAB.");
  lines.push("");
  lines.push("## 7. Prévia Completa de Todas as Divergências Detectadas");
  lines.push("");
  lines.push("| Edição | Q# | Atual | Recomendada | Confiança | Evidência Textual |");
  lines.push("|---|---:|---|---|---|---|");
  for (const r of misclassified) {
    lines.push(
      `| \`${r.editionCode}\` | #${r.qNum} | \`${r.currentRootSlug}\` | \`${r.recommendedSlug}\` | ${r.confidence} | ${(r.textEvidence.join("; ") || r.suspectedBugCause || "-").replace(/\|/g, "\\|")} |`
    );
  }

  const outPath = path.resolve(
    "C:/Users/yurib/.gemini/antigravity/brain/60106d52-50c2-4fb5-8897-6647544e2a45/auditoria-disciplinas-oab-880.md"
  );
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.info(`Relatório de auditoria OAB gerado em: ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
