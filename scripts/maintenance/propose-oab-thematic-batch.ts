import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

interface TopicRule {
  slug: string;
  name: string;
  patterns: RegExp[];
}

interface DisciplineConfig {
  rootSlug: string;
  rootName: string;
  rules: TopicRule[];
}

const BATCH_1_DISCIPLINES: DisciplineConfig[] = [
  {
    rootSlug: "oab-etica-profissional",
    rootName: "Ética Profissional e Estatuto da OAB",
    rules: [
      {
        slug: "oab-etica-honorarios-advocaticios",
        name: "Honorários Advocatícios (Convencionais, Sucumbenciais e Arbitramento)",
        patterns: [
          /\bhonor[aá]rios?\b/i,
          /\bquota\s+litis\b/i,
          /\bsucumb[eê]ncia\b/i,
          /\barbitramento\b/i,
          /\bprescri[cç][aã]o\s+da\s+pretens[aã]o\s+de\s+cobran[cç]a\b/i,
        ],
      },
      {
        slug: "oab-etica-prerrogativas-direitos-advogado",
        name: "Direitos e Prerrogativas do Advogado (Arts. 6º e 7º do EAOAB)",
        patterns: [
          /\bprerrogativas?\b/i,
          /\binviolabilidade\s+do\s+escrit[oó]rio\b/i,
          /\bpris[aã]o\s+em\s+flagrante.*advogad/i,
          /\bsala\s+de\s+estado[- ]maior\b/i,
          /\bsustenta[cç][aã]o\s+oral\b/i,
          /\bdesagravo\s+p[uú]blico\b/i,
          /\bvista\s+dos\s+autos\b/i,
          /\bacesso\s+aos\s+autos\b/i,
          /\binqu[eé]rito\s+policial.*autos\b/i,
          /\bart\.?\s*7[º°]?\b.*\bestatuto\b/i,
          /\bgestante\b.*\badvogad/i,
          /\blactante\b.*\badvogad/i,
          /\bcomunica[cç][aã]o\s+pessoal\s+e\s+reservada\b/i,
        ],
      },
      {
        slug: "oab-etica-infracoes-sancoes-processo-disciplinar",
        name: "Infrações, Sanções e Processo Disciplinar (TED e Conselho Federal)",
        patterns: [
          /\binfra[cç][aã]o\s+disciplinar\b/i,
          /\bsan[cç][aã]o\s+disciplinar\b/i,
          /\bprocesso\s+disciplinar\b/i,
          /\btribunal\s+de\s+[eé]tica\s+e\s+disciplina\b|\bted\b/i,
          /\bsuspens[aã]o\s+preventiva\b/i,
          /\bcensura\b/i,
          /\bexclus[aã]o\b.*\bquadros?\s+da\s+oab\b/i,
          /\breabilita[cç][aã]o\b.*\bsan[cç][aã]o\b/i,
          /\bprescri[cç][aã]o\s+da\s+pretens[aã]o\s+punitiva\b/i,
          /\blocupletamento\b|\bpresta[cç][aã]o\s+de\s+contas\b/i,
        ],
      },
      {
        slug: "oab-etica-incompatibilidades-impedimentos",
        name: "Incompatibilidades e Impedimentos para o Exercício da Advocacia",
        patterns: [
          /\bincompatibilidade\b|\bincompat[ií]vel\b/i,
          /\bimpedimento\b|\bimpedid[oa]\b.*\badvogar\b/i,
          /\bfazenda\s+p[uú]blica\s+que\s+(?:o|a)\s+remunere\b/i,
          /\bchefia\s+do\s+poder\s+executivo\b|\bmesa\s+do\s+poder\s+legislativo\b/i,
          /\batividade\s+policial\b|\bgerente\s+de\s+institui[cç][aã]o\s+financeira\b/i,
          /\bvereador\b.*\badvog/i,
          /\bsecret[aá]rio\s+(?:municipal|estadual)\b.*\badvog/i,
        ],
      },
      {
        slug: "oab-etica-sociedade-de-advogados",
        name: "Sociedade de Advogados e Sociedade Unipessoal de Advocacia",
        patterns: [
          /\bsociedade\s+de\s+advogados?\b/i,
          /\bsociedade\s+unipessoal\s+de\s+advocacia\b/i,
          /\bs[oó]cio\s+patrimonial\b|\bs[oó]cio\s+de\s+servi[cç]o\b/i,
          /\badvogad[oa]\s+associad[oa]\b/i,
          /\braz[aã]o\s+social\b.*\bsociedade\b/i,
        ],
      },
      {
        slug: "oab-etica-publicidade-profissional",
        name: "Publicidade, Marketing Jurídico e Captação de Clientela",
        patterns: [
          /\bpublicidade\b/i,
          /\bmarketing\s+jur[ií]dico\b/i,
          /\bcapta[cç][aã]o\s+de\s+clientela\b/i,
          /\bredes?\s+sociais?\b.*\badvog/i,
          /\bcart[aã]o\s+de\s+visitas?\b|\bplaca\b.*\bescrit[oó]rio\b|\ban[uú]ncio\b/i,
        ],
      },
      {
        slug: "oab-etica-inscricao-estagio-mandato",
        name: "Inscrição na OAB, Estágio Profissional e Mandato (Procuração)",
        patterns: [
          /\binscri[cç][aã]o\s+(?:principal|suplementar|na\s+oab)\b/i,
          /\bcancelamento\s+da\s+inscri[cç][aã]o\b|\blicenciamento\b/i,
          /\bestagi[aá]ri[oa]\b/i,
          /\bsubstabelecimento\b/i,
          /\bren[uú]ncia\s+(?:ao|do)\s+mandato\b|\brevoga[cç][aã]o\s+do\s+mandato\b/i,
          /\bprocura[cç][aã]o\b.*\b15\s+dias\b|\bato\s+urgente\b.*\bprocura[cç][aã]o\b/i,
        ],
      },
      {
        slug: "oab-etica-advogado-empregado",
        name: "Advogado Empregado e Jornada de Trabalho",
        patterns: [
          /\badvogad[oa]\s+empregad[oa]\b/i,
          /\bdedica[cç][aã]o\s+exclusiva\b.*\bjornada\b/i,
          /\bhoras?\s+extras?\b.*\badvogad/i,
          /\badicional\s+noturno\b.*\badvogad/i,
        ],
      },
      {
        slug: "oab-etica-orgaos-oab-eleicoes",
        name: "Órgãos da OAB, Subseções, Caixas de Assistência e Eleições",
        patterns: [
          /\bconselho\s+(?:federal|seccional)\b/i,
          /\bsubse[cç][aã]o\b/i,
          /\bcaixa\s+de\s+assist[eê]ncia\s+dos\s+advogados\b/i,
          /\belei[cç][oõ]es?\s+(?:na|da)\s+oab\b|\bchapa\b.*\boab\b/i,
          /\bconfer[eê]ncia\s+nacional\b|\bquinto\s+constitucional\b.*\boab\b/i,
        ],
      },
      {
        slug: "oab-etica-sigilo-relacao-cliente",
        name: "Sigilo Profissional e Relação com o Cliente",
        patterns: [
          /\bsigilo\s+profissional\b/i,
          /\bdever\s+de\s+sigilo\b/i,
          /\bconflito\s+de\s+interesses\b.*\bclientes?\b/i,
          /\bconfid[eê]ncia\b.*\bcliente\b/i,
        ],
      },
    ],
  },
  {
    rootSlug: "oab-direito-constitucional",
    rootName: "Direito Constitucional (OAB)",
    rules: [
      {
        slug: "oab-const-controle-constitucionalidade",
        name: "Controle de Constitucionalidade (ADI, ADC, ADPF e Controle Difuso)",
        patterns: [
          /\bcontrole\s+(?:concentrado|difuso|preventivo|repressivo)?\s*de\s+constitucionalidade\b/i,
          /\ba[cç][aã]o\s+direta\s+de\s+inconstitucionalidade\b|\badi\b|\badin\b/i,
          /\ba[cç][aã]o\s+declarat[oó]ria\s+de\s+constitucionalidade\b|\badc\b/i,
          /\badpf\b|\bargui[cç][aã]o\s+de\s+descumprimento\s+de\s+preceito\s+fundamental\b/i,
          /\bado\b|\binconstitucionalidade\s+por\s+omiss[aã]o\b/i,
          /\bmodula[cç][aã]o\s+(?:temporal|dos\s+efeitos)\b|\bcl[aá]usula\s+de\s+reserva\s+de\s+plen[aá]rio\b|\bs[uú]mula\s+vinculante\b/i,
        ],
      },
      {
        slug: "oab-const-direitos-garantias-remedios",
        name: "Direitos e Garantias Fundamentais e Remédios Constitucionais",
        patterns: [
          /\bmandado\s+de\s+seguran[cç]a\b|\bmandado\s+de\s+injun[cç][aã]o\b/i,
          /\bhabeas\s+corpus\b|\bhabeas\s+data\b|\ba[cç][aã]o\s+popular\b/i,
          /\bdireitos?\s+(?:e\s+garantias?\s+)?fundamentais?\b/i,
          /\bliberdade\s+de\s+(?:express[aã]o|reuni[aã]o|associa[cç][aã]o|locomo[cç][aã]o|consci[eê]ncia|cren[cç]a)\b/i,
          /\binviolabilidade\s+(?:domiciliar|do\s+domic[ií]lio|das\s+comunica[cç][oõ]es)\b/i,
          /\brem[eé]dio\s+constitucional\b/i,
        ],
      },
      {
        slug: "oab-const-nacionalidade-direitos-politicos",
        name: "Nacionalidade, Direitos Políticos e Partidos Políticos",
        patterns: [
          /\bbrasileir[oa]\s+(?:nato|naturalizado)\b|\bnacionalidade\b/i,
          /\bextradi[cç][aã]o\b/i,
          /\bdireitos?\s+pol[ií]ticos?\b|\binelegibilidade\b|\bplebiscito\b|\breferendo\b/i,
          /\bpartidos?\s+pol[ií]ticos?\b|\bfidelidade\s+partid[aá]ria\b/i,
        ],
      },
      {
        slug: "oab-const-organizacao-estado-competencias",
        name: "Organização do Estado, Federalismo e Repartição de Competências",
        patterns: [
          /\bcompet[eê]ncia\s+(?:privativa|concorrente|comum|legislativa|exclusiva)\b/i,
          /\binterven[cç][aã]o\s+(?:federal|estadual)\b/i,
          /\breparti[cç][aã]o\s+de\s+compet[eê]ncias\b/i,
          /\bente\s+federativ[oa]\b|\bautonomia\s+(?:municipal|estadual|federativa)\b/i,
          /\bestado\s+de\s+(?:defesa|s[ií]tio)\b/i,
        ],
      },
      {
        slug: "oab-const-poder-legislativo-processo-legislativo",
        name: "Poder Legislativo, Imunidades Parlamentares, CPI e Processo Legislativo",
        patterns: [
          /\bmedida\s+provis[oó]ria\b|\bemenda\s+constitucional\b|\blei\s+complementar\b/i,
          /\bprocesso\s+legislativo\b|\bveto\s+(?:presidencial|total|parcial)\b/i,
          /\bcomiss[aã]o\s+parlamentar\s+de\s+inqu[eé]rito\b|\bcpi\b/i,
          /\bimunidade\s+(?:parlamentar|material|formal)\b|\bdeputad[oa]\s+federal\b|\bsenador\b/i,
          /\btribunal\s+de\s+contas\b|\bcongresso\s+nacional\b/i,
        ],
      },
      {
        slug: "oab-const-poder-executivo",
        name: "Poder Executivo e Crimes de Responsabilidade",
        patterns: [
          /\bpresidente\s+da\s+rep[uú]blica\b|\bvice-presidente\b/i,
          /\bcrime\s+de\s+responsabilidade\b|\bimpeachment\b/i,
          /\bdecreto\s+aut[oô]nomo\b|\bministros?\s+de\s+estado\b/i,
        ],
      },
      {
        slug: "oab-const-poder-judiciario-funcoes-essenciais",
        name: "Poder Judiciário, CNJ e Funções Essenciais à Justiça",
        patterns: [
          /\bsupremo\s+tribunal\s+federal\b|\bstf\b.*\bcompet[eê]ncia\b/i,
          /\bconselho\s+nacional\s+de\s+justi[cç]a\b|\bcnj\b/i,
          /\bminist[eé]rio\s+p[uú]blico\b.*\bautonomia\b|\bdefensoria\s+p[uú]blica\b|\badvocacia\s+p[uú]blica\b/i,
          /\bvitaliciedade\b|\binamovibilidade\b|\bquinto\s+constitucional\b/i,
        ],
      },
      {
        slug: "oab-const-ordem-social-economica",
        name: "Ordem Social (Saúde, Educação, Índios, Cultura) e Ordem Econômica",
        patterns: [
          /\bordem\s+(?:social|econ[oô]mica)\b/i,
          /\bterras?\s+(?:tradicionalmente\s+ocupadas\s+pelos\s+)?ind[ií]genas?\b|\bquilombolas?\b/i,
          /\bpol[ií]tica\s+urbana\b|\busucapi[aã]o\s+especial\s+(?:urbana|rural)\b|\bfun[cç][aã]o\s+social\s+da\s+propriedade\b/i,
          /\bsistema\s+[uú]nico\s+de\s+sa[uú]de\b|\beduca[cç][aã]o\b.*\bconstitui[cç][aã]o\b/i,
        ],
      },
    ],
  },
  {
    rootSlug: "oab-direito-penal",
    rootName: "Direito Penal (OAB)",
    rules: [
      {
        slug: "oab-penal-teoria-crime-aplicacao-lei",
        name: "Aplicação da Lei Penal e Teoria Geral do Crime (Tipicidade, Ilicitude, Culpabilidade)",
        patterns: [
          /\bleg[ií]tima\s+defesa\b|\bestado\s+de\s+necessidade\b|\bestrito\s+cumprimento\b/i,
          /\berro\s+de\s+(?:tipo|proibi[cç][aã]o|execu[cç][aã]o)\b|\baberratio\s+ictus\b/i,
          /\bdesist[eê]ncia\s+volunt[aá]ria\b|\barrependimento\s+(?:eficaz|posterior)\b|\bcrime\s+imposs[ií]vel\b/i,
          /\binimput[aá]vel\b|\bimputabilidade\b|\bembriaguez\b.*\bpenal\b/i,
          /\bextraterritorialidade\b|\bterritorialidade\b|\blei\s+penal\s+no\s+tempo\b|\babolitio\s+criminis\b|\bnovatio\s+legis\b/i,
          /\bprinc[ií]pio\s+da\s+insignific[aâ]ncia\b|\bdolo\s+eventual\b|\bculpa\s+consciente\b/i,
        ],
      },
      {
        slug: "oab-penal-concurso-pessoas-crimes",
        name: "Concurso de Pessoas e Concurso de Crimes (Material, Formal e Crime Continuado)",
        patterns: [
          /\bconcurso\s+de\s+(?:pessoas|agentes|crimes)\b/i,
          /\bconcurso\s+(?:material|formal)\b|\bcrime\s+continuado\b/i,
          /\bcoautoria\b|\bparticipa[cç][aã]o\s+de\s+menor\s+import[aâ]ncia\b|\bcoopera[cç][aã]o\s+dolosamente\s+distinta\b/i,
        ],
      },
      {
        slug: "oab-penal-penas-extincao-punibilidade",
        name: "Penas, Dosimetria, Regimes, Livramento Condicional e Extinção da Punibilidade",
        patterns: [
          /\bdosimetria\b|\bpena[- ]base\b|\batenuante\b|\bagravante\b|\breincid[eê]ncia\b/i,
          /\bprescri[cç][aã]o\s+(?:da\s+pretens[aã]o|punitiva|execut[oó]ria|penal|retroativa)\b/i,
          /\bextin[cç][aã]o\s+da\s+punibilidade\b|\bdecad[eê]ncia\b|\bperemp[cç][aã]o\b|\bperd[aã]o\s+judicial\b/i,
          /\bpena\s+restritiva\s+de\s+direitos\b|\bregime\s+(?:fechado|semiaberto|aberto)\b|\bsursis\b|\blivramento\s+condicional\b/i,
          /\bmedida\s+de\s+seguran[cç]a\b/i,
        ],
      },
      {
        slug: "oab-penal-crimes-contra-pessoa",
        name: "Crimes contra a Pessoa (Vida, Lesão Corporal, Honra e Liberdade)",
        patterns: [
          /\bhomic[ií]dio\b|\bfeminic[ií]dio\b|\binfantic[ií]dio\b|\baborto\b|\bsuic[ií]dio\b/i,
          /\bles[aã]o\s+corporal\b/i,
          /\bcal[uú]nia\b|\bdifama[cç][aã]o\b|\binj[uú]ria\b|\bcrimes?\s+contra\s+a\s+honra\b/i,
          /\bamea[cç]a\b|\bsequestro\b|\bc[aá]rcere\s+privado\b|\bpersegui[cç][aã]o\b|\bstalking\b/i,
        ],
      },
      {
        slug: "oab-penal-crimes-contra-patrimonio",
        name: "Crimes contra o Patrimônio (Furto, Roubo, Estelionato, Apropriação e Receptação)",
        patterns: [
          /\bfurto\b|\broubo\b|\blatroc[ií]nio\b|\bextors[aã]o\b/i,
          /\bestelionato\b|\bapropria[cç][aã]o\s+ind[eé]bita\b|\brecepta[cç][aã]o\b/i,
          /\bescusa\s+absolut[oó]ria\b|\bimunidade\s+patrimonial\b/i,
        ],
      },
      {
        slug: "oab-penal-crimes-administracao-fe-publica",
        name: "Crimes contra a Administração Pública e contra a Fé Pública",
        patterns: [
          /\bpeculato\b|\bconcuss[aã]o\b|\bcorrup[cç][aã]o\s+(?:ativa|passiva)\b|\bprevarica[cç][aã]o\b/i,
          /\bdesacato\b|\bdesobedi[eê]ncia\b|\bresist[eê]ncia\b|\bdenuncia[cç][aã]o\s+caluniosa\b|\bfalso\s+testemunho\b/i,
          /\bfalsidade\s+(?:ideol[oó]gica|documental)\b|\bfalsifica[cç][aã]o\s+de\s+documento\b|\buso\s+de\s+documento\s+falso\b/i,
        ],
      },
      {
        slug: "oab-penal-crimes-dignidade-sexual",
        name: "Crimes contra a Dignidade Sexual",
        patterns: [
          /\bestupro\b|\bimportuna[cç][aã]o\s+sexual\b|\bass[eé]dio\s+sexual\b|\bviola[cç][aã]o\s+sexual\b/i,
          /\bdignidade\s+sexual\b/i,
        ],
      },
      {
        slug: "oab-penal-legislacao-penal-especial",
        name: "Legislação Penal Especial (Drogas, Maria da Penha, Armas, Hediondos, Abuso)",
        patterns: [
          /\blei\s+maria\s+da\s+penha\b|\bviol[eê]ncia\s+dom[eé]stica\b|\blei\s+n?[º°]?\s*11\.340\b/i,
          /\btr[aá]fico\s+de\s+drogas\b|\blei\s+de\s+drogas\b|\blei\s+n?[º°]?\s*11\.343\b/i,
          /\bestatuto\s+do\s+desarmamento\b|\bporte\s+(?:ilegal\s+)?de\s+arma\b|\blei\s+n?[º°]?\s*10\.826\b/i,
          /\bcrimes?\s+hediondos?\b|\babuso\s+de\s+autoridade\b|\borganiza[cç][aã]o\s+criminosa\b|\blavagem\s+de\s+dinheiro\b/i,
          /\bcrimes?\s+de\s+tr[aâ]nsito\b|\bembriaguez\s+ao\s+volante\b/i,
        ],
      },
    ],
  },
  {
    rootSlug: "oab-direito-civil",
    rootName: "Direito Civil",
    rules: [
      {
        slug: "oab-civil-parte-geral",
        name: "Parte Geral (Pessoas, Personalidade, Bens, Negócio Jurídico e Prescrição/Decadência)",
        patterns: [
          /\bneg[oó]cio\s+jur[ií]dico\b|\bsimula[cç][aã]o\b|\bfraude\s+contra\s+credores\b|\bles[aã]o\b.*\bneg[oó]cio\b|\bestado\s+de\s+perigo\b/i,
          /\bpersonalidade\b|\bpessoa\s+jur[ií]dica\b|\bdesconsidera[cç][aã]o\s+da\s+personalidade\b|\baus[eê]ncia\b|\bemancipa[cç][aã]o\b|\bcuratela\b/i,
          /\bbem\s+de\s+fam[ií]lia\b|\bbens?\s+(?:p[uú]blicos?|m[oó]veis?|im[oó]veis?|fung[ií]veis?)\b/i,
          /\bprescri[cç][aã]o\b.*\bc[oó]digo\s+civil\b|\bdecad[eê]ncia\b.*\bc[oó]digo\s+civil\b|\bcondi[cç][aã]o\s+suspensiva\b/i,
        ],
      },
      {
        slug: "oab-civil-obrigacoes-responsabilidade",
        name: "Direito das Obrigações e Responsabilidade Civil",
        patterns: [
          /\bobriga[cç][aã]o\s+(?:solid[aá]ria|indivis[ií]vel|alternativa|de\s+dar|de\s+fazer)\b|\bsolidariedade\s+(?:ativa|passiva)\b/i,
          /\bnova[cç][aã]o\b|\bcompensa[cç][aã]o\b|\bsub-roga[cç][aã]o\b|\bcess[aã]o\s+de\s+cr[eé]dito\b|\bassun[cç][aã]o\s+de\s+d[ií]vida\b/i,
          /\bmora\b|\bcl[aá]usula\s+penal\b|\barras\b|\badimplemento\s+substancial\b/i,
          /\bresponsabilidade\s+civil\b|\bdano\s+(?:moral|material|est[eé]tico)\b|\bindeniza[cç][aã]o\b|\bato\s+il[ií]cito\b/i,
        ],
      },
      {
        slug: "oab-civil-contratos",
        name: "Teoria Geral dos Contratos e Contratos em Espécie",
        patterns: [
          /\bcompra\s+e\s+venda\b|\bdoa[cç][aã]o\b|\bloca[cç][aã]o\b|\bfian[cç]a\b|\bcomodato\b|\bm[uú]tuo\b|\bempreitada\b|\bmandato\b|\bseguro\b/i,
          /\bv[ií]cio\s+redibit[oó]rio\b|\bevic[cç][aã]o\b|\bonerosidade\s+excessiva\b|\bcontrato\s+de\s+ades[aã]o\b|\bretroven[dd]a\b/i,
        ],
      },
      {
        slug: "oab-civil-direito-das-coisas",
        name: "Direito das Coisas (Posse, Propriedade, Usucapião, Condomínio e Direitos Reais)",
        patterns: [
          /\busucapi[aã]o\b|\bposse\b.*\b(?:justa|injusta|prec[aá]ria|esbulho|turba[cç][aã]o|benfeitorias?)\b/i,
          /\bcondom[ií]nio\s+(?:edil[ií]cio|volunt[aá]rio)\b|\bdireito\s+de\s+vizinhan[cç]a\b/i,
          /\bhipoteca\b|\bpenhor\b|\busufruto\b|\bservid[aã]o\b|\bsuperf[ií]cie\b|\bmultipropriedade\b|\bdireito\s+de\s+laje\b|\baliena[cç][aã]o\s+fiduci[aá]ria\b/i,
        ],
      },
      {
        slug: "oab-civil-direito-de-familia",
        name: "Direito de Família (Casamento, União Estável, Regimes de Bens, Alimentos e Filiação)",
        patterns: [
          /\bcasamento\b|\buni[aã]o\s+est[aá]vel\b|\bdiv[oó]rcio\b|\bregime\s+de\s+(?:bens|comunh[aã]o|separa[cç][aã]o)\b|\bpacto\s+antenupcial\b/i,
          /\balimentos\b|\bguarda\s+(?:compartilhada|unilateral)\b|\bpoder\s+familiar\b|\bfilia[cç][aã]o\b|\breconhecimento\s+de\s+paternidade\b/i,
          /\boutorga\s+(?:ux[oó]ria|conjugal)\b/i,
        ],
      },
      {
        slug: "oab-civil-direito-das-sucessoes",
        name: "Direito das Sucessões (Herança, Vocação Hereditária, Testamento e Inventário)",
        patterns: [
          /\bsucess[aã]o\b|\bheran[cç]a\b|\bherdeir[oa]s?\b|\btestamento\b|\blegado\b|\bdeserda[cç][aã]o\b|\bindignidade\b/i,
          /\bmeação\b|\bmea[cç][aã]o\b|\bcolação\b|\bcola[cç][aã]o\b|\bleg[ií]tima\b|\bpeti[cç][aã]o\s+de\s+heran[cç]a\b|\binvent[aá]rio\b/i,
        ],
      },
    ],
  },
];

// Cross-discipline red flags (questions that may have been misclassified at root level during bulk import)
const CROSS_DISCIPLINE_FLAGS: Array<{ label: string; pattern: RegExp; ignoreWhenRoot: string }> = [
  {
    label: "Possível Processo Penal (CPP)",
    pattern: /\binqu[eé]rito\s+policial\b|\bpris[aã]o\s+(?:preventiva|tempor[aá]ria|em\s+flagrante)\b|\bacordo\s+de\s+n[aã]o\s+persecu[cç][aã]o\s+penal\b|\banpp\b|\btribunal\s+do\s+j[uú]ri\b|\brecurso\s+em\s+sentido\s+estrito\b/i,
    ignoreWhenRoot: "oab-direito-processual-penal",
  },
  {
    label: "Possível Processo Civil (CPC)",
    pattern: /\bagravo\s+de\s+instrumento\b|\bembargos\s+de\s+declara[cç][aã]o\b|\btutela\s+(?:provis[oó]ria|antecipada|de\s+urg[eê]ncia)\b|\blitig[aâ]ncia\s+de\s+m[aá][- ]f[eé]\b|\bcontest[aã]o\b.*\breconven[cç][aã]o\b|\bcumprimento\s+de\s+senten[cç]a\b/i,
    ignoreWhenRoot: "oab-direito-processual-civil",
  },
  {
    label: "Possível Tributário (CTN)",
    pattern: /\bimposto\s+sobre\b|\bicms\b|\bissqn\b|\biptu\b|\bitbi\b|\bitcmd\b|\bcr[eé]dito\s+tribut[aá]rio\b|\blan[cç]amento\s+tribut[aá]rio\b|\bexecu[cç][aã]o\s+fiscal\b/i,
    ignoreWhenRoot: "oab-direito-tributario",
  },
  {
    label: "Possível Trabalho / Processo do Trabalho (CLT)",
    pattern: /\breclama[cç][aã]o\s+trabalhista\b|\bcontrato\s+de\s+trabalho\b|\bclt\b|\bfgts\b|\baviso\s+pr[eé]vio\b|\bjusta\s+causa\b/i,
    ignoreWhenRoot: "oab-direito-do-trabalho",
  },
];

interface ProposalRow {
  questionId: string;
  editionCode: string;
  originalNumber: number;
  rootSlug: string;
  rootName: string;
  status: "PROPOSTA_COM_EVIDENCIA" | "REVISAO_HUMANA_NECESSARIA";
  proposedTopicSlug: string | null;
  proposedTopicName: string | null;
  evidenceMatches: string[];
  warningNote: string | null;
  statementExcerpt: string;
}

async function main(): Promise<void> {
  const rootSlugs = BATCH_1_DISCIPLINES.map((d) => d.rootSlug);

  const questions = await prisma.question.findMany({
    where: {
      status: "PUBLISHED",
      subjects: {
        some: {
          subject: { slug: { in: rootSlugs } },
        },
      },
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
    include: {
      subjects: { include: { subject: true } },
      options: { orderBy: { displayOrder: "asc" } },
      examInstances: {
        include: {
          examForm: {
            include: { examEdition: { select: { editionCode: true, year: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const configBySlug = new Map(BATCH_1_DISCIPLINES.map((d) => [d.rootSlug, d]));
  const proposals: ProposalRow[] = [];

  for (const q of questions) {
    const primaryLink =
      q.subjects.find((s) => s.isPrimary && configBySlug.has(s.subject.slug)) ??
      q.subjects.find((s) => configBySlug.has(s.subject.slug));
    if (!primaryLink) continue;

    const cfg = configBySlug.get(primaryLink.subject.slug)!;
    const inst = q.examInstances[0];
    const editionCode = inst?.examForm.examEdition.editionCode ?? "OAB-N/A";
    const originalNumber = inst?.originalNumber ?? 0;

    // Combine statement + options for legal institute evidence
    const fullText = [
      q.statement,
      ...q.options.map((o) => `${o.label}) ${o.content}`),
    ].join("\n");

    // Check cross-discipline red flag (only if not Ética, since Ética mentions processes/clients)
    let crossFlag: string | null = null;
    if (cfg.rootSlug !== "oab-etica-profissional") {
      for (const flag of CROSS_DISCIPLINE_FLAGS) {
        if (flag.ignoreWhenRoot === cfg.rootSlug) continue;
        if (flag.pattern.test(q.statement)) {
          crossFlag = flag.label;
          break;
        }
      }
    }

    // Score each child topic rule by distinct pattern hits (statement weighted 2x, options 1x)
    const scored: Array<{
      rule: TopicRule;
      score: number;
      hits: string[];
    }> = [];

    for (const rule of cfg.rules) {
      let score = 0;
      const hits: string[] = [];
      for (const pat of rule.patterns) {
        const stmtMatch = q.statement.match(pat);
        if (stmtMatch) {
          score += 2;
          hits.push(`enunciado: "${stmtMatch[0]}"`);
        } else {
          const fullMatch = fullText.match(pat);
          if (fullMatch) {
            score += 1;
            hits.push(`alternativa: "${fullMatch[0]}"`);
          }
        }
      }
      if (score > 0) {
        scored.push({ rule, score, hits });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const second = scored[1];
    const isTie = Boolean(best && second && best.score === second.score);
    const hasStrongEvidence = Boolean(best && best.score >= 2 && !isTie && !crossFlag);

    proposals.push({
      questionId: q.id,
      editionCode,
      originalNumber,
      rootSlug: cfg.rootSlug,
      rootName: cfg.rootName,
      status: hasStrongEvidence
        ? "PROPOSTA_COM_EVIDENCIA"
        : "REVISAO_HUMANA_NECESSARIA",
      proposedTopicSlug: hasStrongEvidence ? best!.rule.slug : null,
      proposedTopicName: hasStrongEvidence ? best!.rule.name : null,
      evidenceMatches: best ? best.hits.slice(0, 3) : [],
      warningNote: crossFlag
        ? `Alerta de disciplina raiz (${crossFlag}) — validar disciplina antes do assunto`
        : isTie
          ? `Empate entre "${best!.rule.name}" e "${second!.rule.name}" — requer decisão humana`
          : !best
            ? "Sem evidência textual inequívoca nas regras conservadoras"
            : best.score < 2
              ? `Evidência fraca (apenas em alternativa: ${best.hits[0]}) — requer revisão humana`
              : null,
      statementExcerpt: q.statement.replace(/\s+/g, " ").trim().slice(0, 145),
    });
  }

  proposals.sort((a, b) => {
    if (a.rootSlug !== b.rootSlug) return a.rootSlug.localeCompare(b.rootSlug);
    if (a.editionCode !== b.editionCode) return a.editionCode.localeCompare(b.editionCode);
    return a.originalNumber - b.originalNumber;
  });

  // Console summary
  const total = proposals.length;
  const proposedCount = proposals.filter((p) => p.status === "PROPOSTA_COM_EVIDENCIA").length;
  const reviewCount = proposals.filter((p) => p.status === "REVISAO_HUMANA_NECESSARIA").length;

  console.info(`=== LOTE 1 — PROPOSTA DE CLASSIFICAÇÃO TEMÁTICA OAB (READ-ONLY) ===`);
  console.info(`Total analisado: ${total} | Com evidência textual: ${proposedCount} | Revisão humana: ${reviewCount}`);

  for (const d of BATCH_1_DISCIPLINES) {
    const subset = proposals.filter((p) => p.rootSlug === d.rootSlug);
    const ok = subset.filter((p) => p.status === "PROPOSTA_COM_EVIDENCIA").length;
    const rev = subset.length - ok;
    console.info(`  - ${d.rootName}: total=${subset.length} | propostas=${ok} | revisao=${rev}`);
  }

  // Generate Markdown review artifact
  const lines: string[] = [];
  lines.push("# Lote 1 — Proposta de Classificação Temática OAB (Revisão Humana)");
  lines.push("");
  lines.push("> [!IMPORTANT]");
  lines.push("> **Modo somente leitura (Read-Only):** Nenhuma linha foi alterada no Prisma Postgres. Enunciados, alternativas, gabaritos e disciplina raiz foram integralmente preservados. Este documento apresenta a proposta do **Lote 1** para sua revisão e aprovação antes de qualquer aplicação no banco.");
  lines.push("");
  lines.push("## 1. Resumo Quantitativo do Lote 1");
  lines.push("");
  lines.push(`- **Total de questões analisadas no Lote 1:** **${total}** (das 800 questões da OAB atualmente apenas com disciplina raiz)`);
  lines.push(`- **Propostas com evidência textual direta:** **${proposedCount}** (${((proposedCount / Math.max(1, total)) * 100).toFixed(1)}%)`);
  lines.push(`- **Encaminhadas para revisão humana (\`REVISAO_HUMANA_NECESSARIA\`):** **${reviewCount}** (${((reviewCount / Math.max(1, total)) * 100).toFixed(1)}%)`);
  lines.push("");
  lines.push("| Disciplina Raiz | Total no Lote 1 | Com Evidência Textual | Revisão Humana | Assuntos Filhos Propostos |");
  lines.push("|---|---:|---:|---:|---:|");

  for (const d of BATCH_1_DISCIPLINES) {
    const subset = proposals.filter((p) => p.rootSlug === d.rootSlug);
    const ok = subset.filter((p) => p.status === "PROPOSTA_COM_EVIDENCIA");
    const rev = subset.length - ok.length;
    const usedTopics = new Set(ok.map((p) => p.proposedTopicSlug)).size;
    lines.push(`| ${d.rootName} | ${subset.length} | ${ok.length} | ${rev} | ${usedTopics} |`);
  }

  lines.push("");
  lines.push("## 2. Distribuição por Assunto Filho Proposto");
  lines.push("");

  for (const d of BATCH_1_DISCIPLINES) {
    const subset = proposals.filter((p) => p.rootSlug === d.rootSlug);
    const byTopic = new Map<string, { name: string; count: number }>();
    for (const p of subset) {
      if (p.proposedTopicSlug && p.proposedTopicName) {
        const cur = byTopic.get(p.proposedTopicSlug) ?? { name: p.proposedTopicName, count: 0 };
        cur.count++;
        byTopic.set(p.proposedTopicSlug, cur);
      }
    }
    const revCount = subset.filter((p) => p.status === "REVISAO_HUMANA_NECESSARIA").length;
    lines.push(`### ${d.rootName} (${subset.length} questões)`);
    lines.push("");
    lines.push("| Slug do Assunto Proposto | Assunto / Tema | Qtd |");
    lines.push("|---|---|---:|");
    for (const [slug, info] of [...byTopic.entries()].sort((a, b) => b[1].count - a[1].count)) {
      lines.push(`| \`${slug}\` | ${info.name} | ${info.count} |`);
    }
    lines.push(`| \`REVISAO_HUMANA_NECESSARIA\` | *Itens ambíguos, sem evidência inequívoca ou com alerta de disciplina raiz* | ${revCount} |`);
    lines.push("");
  }

  lines.push("## 3. Detalhamento Completo para Conferência (Todas as 202 Questões do Lote 1)");
  lines.push("");

  for (const d of BATCH_1_DISCIPLINES) {
    const subset = proposals.filter((p) => p.rootSlug === d.rootSlug);
    lines.push(`### ${d.rootName}`);
    lines.push("");
    lines.push("| Edição | Q# | Status | Assunto Proposto | Evidência / Observação | Trecho Real do Enunciado |");
    lines.push("|---|---:|---|---|---|---|");
    for (const p of subset) {
      const statusBadge =
        p.status === "PROPOSTA_COM_EVIDENCIA" ? "✅ Proposta" : "⚠️ Revisão humana";
      const topicLabel = p.proposedTopicName ?? "—";
      const ev = p.warningNote
        ? p.warningNote
        : p.evidenceMatches.join("; ");
      const safeExcerpt = p.statementExcerpt.replace(/\|/g, "\\|");
      const safeEv = ev.replace(/\|/g, "\\|");
      lines.push(
        `| \`${p.editionCode}\` | #${p.originalNumber} | ${statusBadge} | ${topicLabel} | ${safeEv} | ${safeExcerpt}... |`
      );
    }
    lines.push("");
  }

  const artifactPath = path.resolve(
    "C:/Users/yurib/.gemini/antigravity/brain/60106d52-50c2-4fb5-8897-6647544e2a45/lote1-classificacao-tematica-oab.md"
  );
  fs.writeFileSync(artifactPath, lines.join("\n"), "utf-8");
  console.info(`Artifact gerado em: ${artifactPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
