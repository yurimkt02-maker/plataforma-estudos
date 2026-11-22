import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

/**
 * SANEAMENTO CONTROLADO — OAB LOTE A (FALSOS POSITIVOS EM DIREITO ELEITORAL).
 *
 * Regras de segurança obrigatórias:
 * 1. Separa estritamente `cleanCandidates` (53 sem ambiguidade) de `ambiguousItems` (12 bloqueadas).
 * 2. Nunca considera ausência de empate de escore como aprovação humana.
 * 3. `--apply` exige explicitamente `--approved-ids-file=<caminho.json>` com IDs aprovados e checksum.
 * 4. Recusa a execução se qualquer ID for ambíguo, se a contagem/lista divergir da prévia aprovada
 *    ou se a disciplina atual no banco tiver mudado desde a auditoria.
 * 5. Remove exclusivamente o vínculo incorreto `oab-direito-eleitoral`, preservando outros vínculos válidos.
 * 6. Modo padrão (`--dry-run`): simula transação real e executa ROLLBACK forçado (0 alterações persistidas).
 */

export interface LoteACandidate {
  questionId: string;
  editionCode: string;
  qNum: number;
  currentSlug: string;
  proposedSlug: string;
  targetSubjectId: string;
  evidence: string;
  confidence: string;
  isAmbiguous: boolean;
  ambiguityNote: string | null;
  excerpt: string;
}

export interface ApprovedLoteAManifest {
  batch: "OAB_LOTE_A";
  approvedByHuman: boolean;
  expectedCount: number;
  approvedQuestionIds: string[];
  checksumSha256: string;
}

export function computeApprovedIdsChecksum(ids: string[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([...ids].sort()), "utf-8")
    .digest("hex");
}

export function partitionLoteACandidates(candidates: LoteACandidate[]): {
  cleanCandidates: LoteACandidate[];
  ambiguousItems: LoteACandidate[];
} {
  const cleanCandidates: LoteACandidate[] = [];
  const ambiguousItems: LoteACandidate[] = [];
  for (const c of candidates) {
    if (c.isAmbiguous) ambiguousItems.push(c);
    else cleanCandidates.push(c);
  }
  return { cleanCandidates, ambiguousItems };
}

export function validateApprovedLoteASelection(params: {
  cleanCandidates: LoteACandidate[];
  ambiguousItems: LoteACandidate[];
  manifest: ApprovedLoteAManifest;
  liveEleitoralQuestionIds: Set<string>;
}): { valid: boolean; errors: string[]; approvedItems: LoteACandidate[] } {
  const { cleanCandidates, ambiguousItems, manifest, liveEleitoralQuestionIds } = params;
  const errors: string[] = [];

  if (!manifest.approvedByHuman) {
    errors.push("Manifesto de aprovação não possui `approvedByHuman: true`.");
  }

  const expectedChecksum = computeApprovedIdsChecksum(manifest.approvedQuestionIds);
  if (expectedChecksum !== manifest.checksumSha256) {
    errors.push("Checksum SHA-256 do manifesto de IDs aprovados é inválido.");
  }

  if (manifest.approvedQuestionIds.length === 0) {
    errors.push("Manifesto de aprovação não pode estar vazio (nenhum ID selecionado).");
  }

  if (manifest.approvedQuestionIds.length !== manifest.expectedCount) {
    errors.push(
      `Contagem divergente no manifesto: expectedCount=${manifest.expectedCount}, ids=${manifest.approvedQuestionIds.length}.`
    );
  }

  const ambiguousIdSet = new Set(ambiguousItems.map((i) => i.questionId));
  const cleanById = new Map(cleanCandidates.map((i) => [i.questionId, i]));
  const seen = new Set<string>();
  const approvedItems: LoteACandidate[] = [];

  for (const id of manifest.approvedQuestionIds) {
    if (seen.has(id)) {
      errors.push(`ID duplicado no manifesto: ${id}`);
      continue;
    }
    seen.add(id);

    if (ambiguousIdSet.has(id)) {
      errors.push(
        `ID ${id} pertence ao conjunto de 12 questões ambíguas bloqueadas e não pode ser aplicado em lote.`
      );
      continue;
    }

    const candidate = cleanById.get(id);
    if (!candidate) {
      errors.push(`ID ${id} não corresponde a nenhum item da prévia elegível (53 limpos) do Lote A.`);
      continue;
    }

    if (!liveEleitoralQuestionIds.has(id)) {
      errors.push(
        `Revalidação falhou: questão ${id} (${candidate.editionCode} #${candidate.qNum}) não está mais vinculada a oab-direito-eleitoral no banco.`
      );
      continue;
    }

    approvedItems.push(candidate);
  }

  return {
    valid: errors.length === 0,
    errors,
    approvedItems,
  };
}

const STRICT_RULES: Array<{ slug: string; name: string; patterns: RegExp[] }> = [
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

function inferAll(statement: string, optionsText: string) {
  const scored: Array<{ slug: string; score: number; matches: string[] }> = [];
  for (const rule of STRICT_RULES) {
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
    if (score > 0) scored.push({ slug: rule.slug, score, matches });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

class DryRunRollbackSentinel extends Error {
  constructor(public readonly summary: Record<string, unknown>) {
    super("DRY_RUN_ROLLBACK_OK");
  }
}

async function runCli(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const approvedFileArg = process.argv.find((a) => a.startsWith("--approved-ids-file="));
  const approvedFilePath = approvedFileArg?.split("=").slice(1).join("=");

  const [eleitoralSubj, allSubjects] = await Promise.all([
    prisma.subject.findUnique({ where: { slug: "oab-direito-eleitoral" } }),
    prisma.subject.findMany(),
  ]);
  if (!eleitoralSubj) throw new Error("Subject oab-direito-eleitoral não encontrado.");
  const subjBySlug = new Map(allSubjects.map((s) => [s.slug, s]));

  const instances = await prisma.examQuestionInstance.findMany({
    where: {
      question: {
        status: "PUBLISHED",
        subjects: { some: { subjectId: eleitoralSubj.id } },
      },
      examForm: { examEdition: { position: { studyTrack: { is: { code: "OAB" } } } } },
    },
    include: {
      examForm: { include: { examEdition: { select: { editionCode: true } } } },
      question: {
        include: {
          options: { orderBy: { displayOrder: "asc" } },
          subjects: { include: { subject: true } },
        },
      },
    },
    orderBy: [
      { examForm: { examEdition: { editionCode: "asc" } } },
      { originalNumber: "asc" },
    ],
  });

  const allCandidates: LoteACandidate[] = [];
  for (const inst of instances) {
    const edCode = inst.examForm.examEdition.editionCode;
    const examNum = Number(edCode.match(/OAB-(\d+)/)?.[1] ?? 41);
    const optionsText = inst.question.options.map((o) => `${o.label}) ${o.content}`).join("\n");
    const scored = inferAll(inst.question.statement, optionsText);
    const best = scored[0];
    const second = scored[1];
    const fgvBlock = expectedFgvBlock(examNum, inst.originalNumber);

    const qualifies =
      best &&
      best.slug !== "oab-direito-eleitoral" &&
      (best.slug === fgvBlock || best.score >= 3);

    if (!qualifies) continue;
    const targetSubj = subjBySlug.get(best.slug);
    if (!targetSubj) continue;

    const isTieOrDivergentBlock =
      Boolean(second && second.score === best.score) ||
      (best.slug !== fgvBlock && best.score < 4);

    allCandidates.push({
      questionId: inst.question.id,
      editionCode: edCode,
      qNum: inst.originalNumber,
      currentSlug: "oab-direito-eleitoral",
      proposedSlug: best.slug,
      targetSubjectId: targetSubj.id,
      evidence: best.matches.slice(0, 3).join("; "),
      confidence:
        best.slug === fgvBlock
          ? "ALTA_CONCORDANCIA_TEXTO_E_BLOCO"
          : "ALTA_EVIDENCIA_TEXTUAL",
      isAmbiguous: isTieOrDivergentBlock,
      ambiguityNote:
        second && second.score === best.score
          ? `Empate de escore com ${second.slug} (${second.matches[0]}) — bloqueada para revisão humana`
          : best.slug !== fgvBlock
            ? `Texto aponta ${best.slug}, mas posição #${inst.originalNumber} está no bloco típico de ${fgvBlock} — bloqueada para revisão humana`
            : null,
      excerpt: inst.question.statement.replace(/\s+/g, " ").trim().slice(0, 140),
    });
  }

  const { cleanCandidates, ambiguousItems } = partitionLoteACandidates(allCandidates);

  // Gerar artefato definitivo das 53 questões limpas + 12 bloqueadas separadas
  const lines: string[] = [];
  lines.push("# Prévia Definitiva — OAB Lote A (53 Itens Limpos + 12 Ambíguos Bloqueados)");
  lines.push("");
  lines.push("> [!IMPORTANT]");
  lines.push(`> **Separação estrita aplicada:** apenas os **${cleanCandidates.length}** itens abaixo compõem a prévia elegível para aprovação explícita. Os **${ambiguousItems.length}** itens ambíguos estão tecnicamente bloqueados no código e **nunca** entram no conjunto aplicado em lote.`);
  lines.push("");
  lines.push(`## 1. Conjunto Elegível para Aprovação Final (${cleanCandidates.length} questões)`);
  lines.push("");
  lines.push("| # | Edição | Q# | Question ID | Atual | Proposta | Evidência Textual | Trecho Real |");
  lines.push("|---:|---|---:|---|---|---|---|---|");
  cleanCandidates.forEach((it, idx) => {
    lines.push(
      `| ${idx + 1} | \`${it.editionCode}\` | #${it.qNum} | \`${it.questionId}\` | \`${it.currentSlug}\` | \`${it.proposedSlug}\` | ${it.evidence.replace(/\|/g, "\\|")} | ${it.excerpt.replace(/\|/g, "\\|")}... |`
    );
  });
  lines.push("");
  lines.push(`## 2. Itens Ambíguos Explicitamente Bloqueados (${ambiguousItems.length} questões — NÃO entram no --apply)`);
  lines.push("");
  lines.push("| # | Edição | Q# | Question ID | Proposta Sugerida | Motivo do Bloqueio |");
  lines.push("|---:|---|---:|---|---|---|");
  ambiguousItems.forEach((it, idx) => {
    lines.push(
      `| ${idx + 1} | \`${it.editionCode}\` | #${it.qNum} | \`${it.questionId}\` | \`${it.proposedSlug}\` | ${(it.ambiguityNote ?? "Ambíguo").replace(/\|/g, "\\|")} |`
    );
  });

  const previewPath = path.resolve(
    "C:/Users/yurib/.gemini/antigravity/brain/60106d52-50c2-4fb5-8897-6647544e2a45/previa-definitiva-lote-a-53-oab.md"
  );
  fs.writeFileSync(previewPath, lines.join("\n"), "utf-8");

  // Salvar template de manifesto pendente (approvedByHuman: false!) no diretório privado de backups
  const pendingManifestPath =
    "C:\\Users\\yurib\\OneDrive\\Desktop\\plataforma-estudos-backups-privados\\lote-a-53-manifesto-pendente.json";
  const pendingIds = cleanCandidates.map((c) => c.questionId);
  const pendingManifest: ApprovedLoteAManifest = {
    batch: "OAB_LOTE_A",
    approvedByHuman: false,
    expectedCount: pendingIds.length,
    approvedQuestionIds: pendingIds,
    checksumSha256: computeApprovedIdsChecksum(pendingIds),
  };
  fs.mkdirSync(path.dirname(pendingManifestPath), { recursive: true });
  fs.writeFileSync(pendingManifestPath, JSON.stringify(pendingManifest, null, 2), "utf-8");

  const liveEleitoralIds = new Set(instances.map((i) => i.question.id));

  // Se --apply foi solicitado, exigir manifesto aprovado e validar estritamente antes da transação
  let itemsToProcess: LoteACandidate[] = cleanCandidates;
  if (apply) {
    if (!approvedFilePath || !fs.existsSync(approvedFilePath)) {
      throw new Error(
        "RECUSADO: --apply exige `--approved-ids-file=<manifesto.json>` explicitamente aprovado por humano."
      );
    }
    const manifest = JSON.parse(
      fs.readFileSync(approvedFilePath, "utf-8")
    ) as ApprovedLoteAManifest;
    const validation = validateApprovedLoteASelection({
      cleanCandidates,
      ambiguousItems,
      manifest,
      liveEleitoralQuestionIds: liveEleitoralIds,
    });
    if (!validation.valid) {
      throw new Error(`RECUSADO NA REVALIDAÇÃO:\n- ${validation.errors.join("\n- ")}`);
    }
    itemsToProcess = validation.approvedItems;
  }

  const eleitoralBefore = await prisma.questionSubject.count({
    where: { subjectId: eleitoralSubj.id },
  });

  try {
    await prisma.$transaction(
      async (tx) => {
        const targetIds = itemsToProcess.map((i) => i.questionId);

        // Revalidar dentro da transação que todos os IDs continuam vinculados a oab-direito-eleitoral
        const liveLinksInTx = await tx.questionSubject.findMany({
          where: {
            questionId: { in: targetIds },
            subjectId: eleitoralSubj.id,
          },
          select: { questionId: true },
        });
        if (liveLinksInTx.length !== targetIds.length) {
          throw new Error(
            `Abortado na transação: esperado ${targetIds.length} vínculos ativos em oab-direito-eleitoral, encontrado ${liveLinksInTx.length}.`
          );
        }

        // Remove EXCLUSIVAMENTE o vínculo incorreto oab-direito-eleitoral (preserva quaisquer outros vínculos válidos)
        await tx.questionSubject.deleteMany({
          where: {
            questionId: { in: targetIds },
            subjectId: eleitoralSubj.id,
          },
        });
        await tx.questionSubject.createMany({
          data: itemsToProcess.map((item) => ({
            questionId: item.questionId,
            subjectId: item.targetSubjectId,
            isPrimary: true,
          })),
          skipDuplicates: true,
        });

        const eleitoralAfter = await tx.questionSubject.count({
          where: { subjectId: eleitoralSubj.id },
        });
        const oabPublishedAfter = await tx.question.count({
          where: {
            status: "PUBLISHED",
            examInstances: {
              some: {
                examForm: {
                  examEdition: {
                    position: { studyTrack: { is: { code: "OAB" } } },
                  },
                },
              },
            },
          },
        });

        const summary = {
          mode: apply ? "APPLIED" : "DRY_RUN_ROLLED_BACK",
          cleanEligibleCount: cleanCandidates.length,
          ambiguousBlockedCount: ambiguousItems.length,
          processedInTxCount: itemsToProcess.length,
          eleitoralBefore,
          eleitoralAfterInTx: eleitoralAfter,
          oabPublishedPreserved: oabPublishedAfter,
          previewPath,
          pendingManifestPath,
        };

        if (!apply) throw new DryRunRollbackSentinel(summary);
        console.info("=== LOTE A APLICADO COM APROVAÇÃO EXPLICITA ===", summary);
      },
      { timeout: 30000 }
    );
  } catch (err) {
    if (err instanceof DryRunRollbackSentinel) {
      const eleitoralPostRollback = await prisma.questionSubject.count({
        where: { subjectId: eleitoralSubj.id },
      });
      console.info("=== SIMULAÇÃO TRANSACIONAL LOTE A (53 LIMPOS / 12 BLOQUEADOS — ROLLBACK OK) ===");
      console.info({
        ...err.summary,
        eleitoralPostRollback,
        zeroChangesPersisted: eleitoralPostRollback === eleitoralBefore,
      });
      return;
    }
    throw err;
  }
}

if (require.main === module) {
  runCli()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
