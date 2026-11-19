export const INITIAL_STUDY_TRACKS = [
  {
    code: "TJSP",
    name: "Tribunal de Justiça de São Paulo",
    targetRole: "Escrevente Técnico Judiciário",
    description:
      "Preparação direcionada às provas da Fundação Vunesp para o cargo de Escrevente Técnico Judiciário do TJSP.",
    displayOrder: 1,
  },
  {
    code: "PCSP",
    name: "Polícia Civil de São Paulo",
    targetRole: "Investigador de Polícia e Escrivão de Polícia",
    description:
      "Foco nos certames PCSP2304 (Investigador) e PCSP2305 (Escrivão) organizados pela Fundação Vunesp.",
    displayOrder: 2,
  },
  {
    code: "PRF",
    name: "Polícia Rodoviária Federal",
    targetRole: "Policial Rodoviário Federal",
    description:
      "Preparação para o modelo Certo/Errado do Cebraspe, incluindo Legislação de Trânsito (CTB e Resoluções CONTRAN) e Direito Penal/Processual.",
    displayOrder: 3,
  },
  {
    code: "OAB",
    name: "Exame de Ordem Unificado — OAB",
    targetRole: "Primeira Fase (Prova Objetiva - 80 Questões)",
    description:
      "Estudo estruturado das 20 disciplinas cobradas pela FGV Conhecimento na 1ª Fase do Exame de Ordem.",
    displayOrder: 4,
  },
] as const;

export const INITIAL_INSTITUTIONS = [
  {
    acronym: "TJSP",
    name: "Tribunal de Justiça do Estado de São Paulo",
    state: "SP",
    websiteUrl: "https://www.tjsp.jus.br",
  },
  {
    acronym: "PCSP",
    name: "Polícia Civil do Estado de São Paulo",
    state: "SP",
    websiteUrl: "https://www.policiacivil.sp.gov.br",
  },
  {
    acronym: "PRF",
    name: "Polícia Rodoviária Federal",
    state: "BR",
    websiteUrl: "https://www.gov.br/prf",
  },
  {
    acronym: "CFOAB",
    name: "Conselho Federal da Ordem dos Advogados do Brasil",
    state: "BR",
    websiteUrl: "https://www.oab.org.br",
  },
] as const;

export const INITIAL_EXAM_BOARDS = [
  {
    acronym: "VUNESP",
    name: "Fundação para o Vestibular da Universidade Estadual Paulista",
    websiteUrl: "https://www.vunesp.com.br",
  },
  {
    acronym: "CEBRASPE",
    name: "Centro Brasileiro de Pesquisa em Avaliação e Seleção e de Promoção de Eventos",
    websiteUrl: "https://www.cebraspe.org.br",
  },
  {
    acronym: "FGV",
    name: "Fundação Getulio Vargas — FGV Conhecimento",
    websiteUrl: "https://conhecimento.fgv.br/exames",
  },
] as const;

export const INITIAL_POSITIONS = [
  {
    code: "TJSP-ESCREVENTE",
    name: "Escrevente Técnico Judiciário",
    trackCode: "TJSP",
    institutionAcronym: "TJSP",
    state: "SP",
  },
  {
    code: "PCSP-INVESTIGADOR",
    name: "Investigador de Polícia",
    trackCode: "PCSP",
    institutionAcronym: "PCSP",
    state: "SP",
  },
  {
    code: "PCSP-ESCRIVAO",
    name: "Escrivão de Polícia",
    trackCode: "PCSP",
    institutionAcronym: "PCSP",
    state: "SP",
  },
  {
    code: "PRF-POLICIAL",
    name: "Policial Rodoviário Federal",
    trackCode: "PRF",
    institutionAcronym: "PRF",
    state: "BR",
  },
  {
    code: "OAB-1FASE",
    name: "Exame de Ordem Unificado — 1ª Fase",
    trackCode: "OAB",
    institutionAcronym: "CFOAB",
    state: "BR",
  },
] as const;

export const INITIAL_SUBJECTS = [
  {
    slug: "direito-constitucional",
    code: "DIR-CONST",
    name: "Direito Constitucional",
    isLegalSubject: true,
    displayOrder: 1,
    children: [
      {
        slug: "direitos-e-garantias-fundamentais",
        code: "DIR-CONST-01",
        name: "Direitos e Garantias Fundamentais (Art. 5º ao 17 da CF/88)",
        isLegalSubject: true,
      },
      {
        slug: "administracao-publica-cf88",
        code: "DIR-CONST-02",
        name: "Da Administração Pública (Art. 37 ao 41 da CF/88)",
        isLegalSubject: true,
      },
      {
        slug: "poder-judiciario-e-funcoes-essenciais",
        code: "DIR-CONST-03",
        name: "Poder Judiciário e Funções Essenciais à Justiça",
        isLegalSubject: true,
      },
    ],
  },
  {
    slug: "direito-administrativo",
    code: "DIR-ADM",
    name: "Direito Administrativo",
    isLegalSubject: true,
    displayOrder: 2,
    children: [
      {
        slug: "improbidade-administrativa-lei-8429",
        code: "DIR-ADM-01",
        name: "Improbidade Administrativa (Lei nº 8.429/1992 e alterações da Lei nº 14.230/2021)",
        isLegalSubject: true,
      },
      {
        slug: "estatuto-funcionarios-publicos-sp-lei-10261",
        code: "DIR-ADM-02",
        name: "Estatuto dos Funcionários Públicos Civis do Estado de SP (Lei Estadual nº 10.261/1968)",
        isLegalSubject: true,
      },
      {
        slug: "atos-e-poderes-administrativos",
        code: "DIR-ADM-03",
        name: "Atos e Poderes Administrativos",
        isLegalSubject: true,
      },
    ],
  },
  {
    slug: "direito-penal",
    code: "DIR-PEN",
    name: "Direito Penal",
    isLegalSubject: true,
    displayOrder: 3,
    children: [
      {
        slug: "crimes-contra-a-administracao-publica",
        code: "DIR-PEN-01",
        name: "Crimes contra a Administração Pública (Arts. 312 a 359-H do CP)",
        isLegalSubject: true,
      },
      {
        slug: "teoria-do-crime-e-imputabilidade",
        code: "DIR-PEN-02",
        name: "Teoria Geral do Crime, Tipicidade, Ilicitude e Culpabilidade",
        isLegalSubject: true,
      },
      {
        slug: "crimes-contra-a-fe-publica",
        code: "DIR-PEN-03",
        name: "Crimes contra a Fé Pública (Arts. 289 a 311-A do CP)",
        isLegalSubject: true,
      },
    ],
  },
  {
    slug: "direito-processual-penal",
    code: "DIR-PROC-PEN",
    name: "Direito Processual Penal",
    isLegalSubject: true,
    displayOrder: 4,
    children: [
      {
        slug: "inquerito-policial",
        code: "DIR-PROC-PEN-01",
        name: "Inquérito Policial (Arts. 4º a 23 do CPP)",
        isLegalSubject: true,
      },
      {
        slug: "prisao-e-medidas-cautelares",
        code: "DIR-PROC-PEN-02",
        name: "Prisão em Flagrante, Preventiva e Medidas Cautelares",
        isLegalSubject: true,
      },
    ],
  },
  {
    slug: "direito-processual-civil",
    code: "DIR-PROC-CIV",
    name: "Direito Processual Civil",
    isLegalSubject: true,
    displayOrder: 5,
    children: [
      {
        slug: "atos-processuais-e-prazos",
        code: "DIR-PROC-CIV-01",
        name: "Atos Processuais, Prazos e Comunicações (CPC/2015)",
        isLegalSubject: true,
      },
      {
        slug: "recursos-no-processo-civil",
        code: "DIR-PROC-CIV-02",
        name: "Teoria Geral dos Recursos e Recursos em Espécie",
        isLegalSubject: true,
      },
    ],
  },
  {
    slug: "etica-e-estatuto-da-oab",
    code: "OAB-ETICA",
    name: "Ética Profissional e Estatuto da Advocacia (Lei nº 8.906/1994)",
    isLegalSubject: true,
    displayOrder: 6,
    children: [
      {
        slug: "direitos-e-prerrogativas-do-advogado",
        code: "OAB-ETICA-01",
        name: "Direitos e Prerrogativas do Advogado (Arts. 6º e 7º da Lei nº 8.906/1994)",
        isLegalSubject: true,
      },
      {
        slug: "infracoes-e-sancoes-disciplinares-oab",
        code: "OAB-ETICA-02",
        name: "Infrações e Sanções Disciplinares na OAB",
        isLegalSubject: true,
      },
    ],
  },
  {
    slug: "legislacao-de-transito-ctb",
    code: "PRF-CTB",
    name: "Legislação de Trânsito (CTB — Lei nº 9.503/1997 e Resoluções CONTRAN)",
    isLegalSubject: true,
    displayOrder: 7,
    children: [
      {
        slug: "normas-gerais-de-circulacao-e-conduta",
        code: "PRF-CTB-01",
        name: "Normas Gerais de Circulação e Conduta (Arts. 26 a 67 do CTB)",
        isLegalSubject: true,
      },
      {
        slug: "crimes-de-transito",
        code: "PRF-CTB-02",
        name: "Crimes de Trânsito (Arts. 291 a 312-B do CTB)",
        isLegalSubject: true,
      },
    ],
  },
  {
    slug: "lingua-portuguesa",
    code: "PORT",
    name: "Língua Portuguesa",
    isLegalSubject: false,
    displayOrder: 8,
    children: [
      {
        slug: "concordancia-e-regencia",
        code: "PORT-01",
        name: "Concordância Verbal, Nominal e Regência",
        isLegalSubject: false,
      },
      {
        slug: "interpretacao-e-compreensao-de-textos",
        code: "PORT-02",
        name: "Interpretação Textual, Coesão e Coerência",
        isLegalSubject: false,
      },
    ],
  },
  {
    slug: "normas-da-corregedoria-tjsp",
    code: "TJSP-NSCGJ",
    name: "Normas da Corregedoria Geral da Justiça do TJSP",
    isLegalSubject: true,
    displayOrder: 9,
    children: [
      {
        slug: "sistema-informatizado-oficial-nscgj",
        code: "TJSP-NSCGJ-01",
        name: "Dos Livros, Classificadores e Sistema Informatizado Oficial (Tomo I - NSCGJ)",
        isLegalSubject: true,
      },
    ],
  },
] as const;

export const INITIAL_EXAM_EDITIONS = [
  {
    editionCode: "TJSP-2024-ESCREVENTE",
    title: "Concurso Público TJSP 2024 — Escrevente Técnico Judiciário (EditalTJSP2401)",
    year: 2024,
    examDate: "2024-09-08",
    phase: "1ª Fase - Prova Objetiva",
    positionCode: "TJSP-ESCREVENTE",
    boardAcronym: "VUNESP",
    rulesetCode: "VUNESP_STANDARD_5",
    officialNoticeUrl: "https://www.vunesp.com.br/TJSP2401",
    forms: [
      {
        versionLabel: "Versão 1",
        colorOrType: "Caderno Padrão V1",
        isDefault: true,
      },
      {
        versionLabel: "Versão 2",
        colorOrType: "Caderno V2",
        isDefault: false,
      },
    ],
  },
  {
    editionCode: "PCSP-2023-INVESTIGADOR",
    title: "Concurso Público PCSP 2023 — Investigador de Polícia (PCSP2304)",
    year: 2023,
    examDate: "2023-11-26",
    phase: "Prova Preambular Objetiva",
    positionCode: "PCSP-INVESTIGADOR",
    boardAcronym: "VUNESP",
    rulesetCode: "VUNESP_STANDARD_5",
    officialNoticeUrl: "https://www.vunesp.com.br/PCSP2304",
    forms: [
      {
        versionLabel: "Versão 1",
        colorOrType: "Caderno Preambular V1",
        isDefault: true,
      },
    ],
  },
  {
    editionCode: "PCSP-2023-ESCRIVAO",
    title: "Concurso Público PCSP 2023 — Escrivão de Polícia (PCSP2305)",
    year: 2023,
    examDate: "2023-11-26",
    phase: "Prova Preambular Objetiva",
    positionCode: "PCSP-ESCRIVAO",
    boardAcronym: "VUNESP",
    rulesetCode: "VUNESP_STANDARD_5",
    officialNoticeUrl: "https://www.vunesp.com.br/PCSP2305",
    forms: [
      {
        versionLabel: "Versão 1",
        colorOrType: "Caderno Preambular V1",
        isDefault: true,
      },
    ],
  },
  {
    editionCode: "PRF-2021-POLICIAL",
    title: "Concurso Público PRF 2021 — Policial Rodoviário Federal (Prova Objetiva)",
    year: 2021,
    examDate: "2021-05-09",
    phase: "1ª Etapa - Prova Objetiva (120 itens Certo/Errado)",
    positionCode: "PRF-POLICIAL",
    boardAcronym: "CEBRASPE",
    rulesetCode: "CEBRASPE_CERTO_ERRADO_PRF2021",
    officialNoticeUrl: "https://www.cebraspe.org.br/concursos/prf_21",
    forms: [
      {
        versionLabel: "Caderno Padrão",
        colorOrType: "Prova Objetiva Ingresso",
        isDefault: true,
      },
    ],
  },
  {
    editionCode: "OAB-41-1FASE",
    title: "41º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
    year: 2024,
    examDate: "2024-07-28",
    phase: "1ª Fase - Prova Objetiva (80 Questões)",
    positionCode: "OAB-1FASE",
    boardAcronym: "FGV",
    rulesetCode: "FGV_OAB_1FASE_80",
    officialNoticeUrl: "https://conhecimento.fgv.br/exames",
    forms: [
      {
        versionLabel: "Tipo 1 - Branca",
        colorOrType: "Caderno Tipo 1 (Branca)",
        isDefault: true,
      },
      {
        versionLabel: "Tipo 2 - Verde",
        colorOrType: "Caderno Tipo 2 (Verde)",
        isDefault: false,
      },
    ],
  },
] as const;

export const INITIAL_VERIFIED_LEGAL_SOURCES = [
  {
    sourceType: "CONSTITUTION" as const,
    authority: "Presidência da República — Casa Civil (Planalto)",
    title: "Constituição da República Federativa do Brasil de 1988",
    documentNumber: "CF/1988",
    jurisdiction: "BR-FEDERAL",
    officialUrl:
      "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    publishedAt: "1988-10-05",
    effectiveFrom: "1988-10-05",
    passages: [
      {
        referenceLabel: "CF/1988, Art. 5º, XI",
        content:
          "A casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador, salvo em caso de flagrante delito ou desastre, ou para prestar socorro, ou, durante o dia, por determinação judicial.",
        isCurrentlyInForce: true,
      },
      {
        referenceLabel: "CF/1988, Art. 37, caput",
        content:
          "A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência.",
        isCurrentlyInForce: true,
      },
    ],
  },
  {
    sourceType: "FEDERAL_LAW" as const,
    authority: "Presidência da República — Casa Civil (Planalto)",
    title:
      "Lei de Improbidade Administrativa (com redação dada pela Lei nº 14.230/2021)",
    documentNumber: "Lei nº 8.429/1992",
    jurisdiction: "BR-FEDERAL",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8429.htm",
    publishedAt: "1992-06-02",
    effectiveFrom: "1992-06-03",
    passages: [
      {
        referenceLabel: "Lei nº 8.429/1992, Art. 1º, §§ 1º e 2º (Redação Lei 14.230/2021)",
        content:
          "Consideram-se atos de improbidade administrativa as condutas dolosas tipificadas nos arts. 9º, 10 e 11 desta Lei, ressalvados tipos previstos em leis especiais. Considera-se dolo a vontade livre e consciente de alcançar o resultado ilícito tipificado nos arts. 9º, 10 e 11 desta Lei, não bastando a voluntariedade do agente.",
        isCurrentlyInForce: true,
      },
    ],
  },
  {
    sourceType: "FEDERAL_LAW" as const,
    authority: "Presidência da República — Casa Civil (Planalto)",
    title: "Código Penal Brasileiro",
    documentNumber: "Decreto-Lei nº 2.848/1940",
    jurisdiction: "BR-FEDERAL",
    officialUrl:
      "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
    publishedAt: "1940-12-07",
    effectiveFrom: "1942-01-01",
    passages: [
      {
        referenceLabel: "Código Penal, Art. 312 (Peculato)",
        content:
          "Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio: Pena - reclusão, de dois a doze anos, e multa.",
        isCurrentlyInForce: true,
      },
      {
        referenceLabel: "Código Penal, Art. 316 (Concussão - Redação Lei 13.964/2019)",
        content:
          "Exigir, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida: Pena - reclusão, de 2 (dois) a 12 (doze) anos, e multa.",
        isCurrentlyInForce: true,
      },
    ],
  },
  {
    sourceType: "FEDERAL_LAW" as const,
    authority: "Presidência da República — Casa Civil (Planalto)",
    title: "Código de Trânsito Brasileiro (CTB)",
    documentNumber: "Lei nº 9.503/1997",
    jurisdiction: "BR-FEDERAL",
    officialUrl:
      "https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm",
    publishedAt: "1997-09-23",
    effectiveFrom: "1998-01-22",
    passages: [
      {
        referenceLabel: "CTB (Lei nº 9.503/1997), Art. 29, VII",
        content:
          "Os veículos destinados a socorro de incêndio e salvamento, os de polícia, os de fiscalização e operação de trânsito e as ambulâncias, além de prioridade no trânsito, gozam de livre circulação, estacionamento e parada, quando em serviço de urgência, de policiamento ostensivo ou de preservação da ordem pública.",
        isCurrentlyInForce: true,
      },
    ],
  },
  {
    sourceType: "FEDERAL_LAW" as const,
    authority: "Presidência da República — Casa Civil (Planalto)",
    title: "Estatuto da Advocacia e a Ordem dos Advogados do Brasil (EOAB)",
    documentNumber: "Lei nº 8.906/1994",
    jurisdiction: "BR-FEDERAL",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8906.htm",
    publishedAt: "1994-07-04",
    effectiveFrom: "1994-07-04",
    passages: [
      {
        referenceLabel: "Lei nº 8.906/1994 (EOAB), Art. 7º, XIV",
        content:
          "São direitos do advogado: examinar, em qualquer instituição responsável por conduzir investigação, mesmo sem procuração, autos de flagrante e de investigações de qualquer natureza, findos ou em andamento, ainda que conclusos à autoridade, podendo copiar peças e tomar apontamentos, em meio físico ou digital.",
        isCurrentlyInForce: true,
      },
    ],
  },
  {
    sourceType: "STATE_LAW" as const,
    authority: "Assembleia Legislativa do Estado de São Paulo (Alesp)",
    title: "Estatuto dos Funcionários Públicos Civis do Estado de São Paulo",
    documentNumber: "Lei Estadual SP nº 10.261/1968",
    jurisdiction: "BR-SP",
    officialUrl:
      "https://www.al.sp.gov.br/repositorio/legislacao/lei/1968/lei-10261-28.10.1968.html",
    publishedAt: "1968-10-28",
    effectiveFrom: "1968-10-28",
    passages: [
      {
        referenceLabel: "Lei Estadual SP nº 10.261/1968, Art. 251",
        content:
          "São penas disciplinares: I - repreensão; II - suspensão; III - multa; IV - demissão; V - demissão a bem do serviço público; VI - cassação de aposentadoria ou disponibilidade.",
        isCurrentlyInForce: true,
      },
    ],
  },
] as const;
