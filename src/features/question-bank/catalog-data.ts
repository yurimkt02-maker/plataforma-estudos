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
      {
        slug: "citacoes-e-intimacoes-cpp",
        code: "DIR-PROC-PEN-03",
        name: "Citações e Intimações no Processo Penal (Arts. 351 a 372 do CPP)",
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
      {
        slug: "juizados-especiais-civeis-e-fazenda-publica",
        code: "DIR-PROC-CIV-03",
        name: "Juizados Especiais Cíveis e da Fazenda Pública (Leis nº 9.099/1995 e nº 12.153/2009)",
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
    title: "Concurso Público TJSP 2024 — Escrevente Técnico Judiciário (Edital TJSP2401)",
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
        referenceLabel: "CF/1988, Art. 8º, VII e VIII",
        content:
          "VII - o aposentado filiado tem direito a votar e ser votado nas organizações sindicais; VIII - é vedada a dispensa do empregado sindicalizado a partir do registro da candidatura a cargo de direção ou representação sindical e, se eleito, ainda que suplente, até um ano após o final do mandato, salvo se cometer falta grave nos termos da lei.",
        isCurrentlyInForce: true,
      },
      {
        referenceLabel: "CF/1988, Art. 37, XVI e XVII",
        content:
          "XVI - é vedada a acumulação remunerada de cargos públicos, exceto, quando houver compatibilidade de horários, observado em qualquer caso o disposto no inciso XI: a) a de dois cargos de professor; b) a de um cargo de professor com outro técnico ou científico; c) a de dois cargos ou empregos privativos de profissionais de saúde, com profissões regulamentadas; XVII - a proibição de acumular estende-se a empregos e funções e abrange autarquias, fundações, empresas públicas, sociedades de economia mista, suas subsidiárias, e sociedades controladas, direta ou indiretamente, pelo poder público.",
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
      {
        referenceLabel: "Lei nº 8.429/1992, Art. 16, § 9º / Art. 17, § 10 (Redação Lei 14.230/2021)",
        content:
          "Da decisão que deferir ou indeferir a medida relativa à indisponibilidade de bens caberá agravo de instrumento, nos termos da Lei nº 13.105, de 16 de março de 2015 (Código de Processo Civil).",
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
        referenceLabel: "Código Penal, Art. 294 (Petrechos de Falsificação)",
        content:
          "Fabricar, adquirir, fornecer, possuir ou guardar objeto especialmente destinado à falsificação de qualquer dos papéis referidos no artigo anterior: Pena - reclusão, de um a três anos, e multa.",
        isCurrentlyInForce: true,
      },
      {
        referenceLabel: "Código Penal, Art. 312 (Peculato)",
        content:
          "Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio: Pena - reclusão, de dois a doze anos, e multa.",
        isCurrentlyInForce: true,
      },
      {
        referenceLabel: "Código Penal, Art. 316, caput e §§ 1º e 2º (Concussão e Excesso de Exação)",
        content:
          "Art. 316 - Exigir, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida: Pena - reclusão, de 2 (dois) a 12 (doze) anos, e multa. § 1º - Se o funcionário exige tributo ou contribuição social que sabe ou deveria saber indevido, ou, quando devido, emprega na cobrança meio vexatório ou gravoso, que a lei não autoriza: Pena - reclusão, de 3 (três) a 8 (oito) anos, e multa. § 2º - Se o funcionário desvia, em proveito próprio ou de outrem, o que recebeu indevidamente para recolher aos cofres públicos: Pena - reclusão, de dois a doze anos, e multa.",
        isCurrentlyInForce: true,
      },
    ],
  },
  {
    sourceType: "FEDERAL_LAW" as const,
    authority: "Presidência da República — Casa Civil (Planalto)",
    title: "Código de Processo Penal",
    documentNumber: "Decreto-Lei nº 3.689/1941",
    jurisdiction: "BR-FEDERAL",
    officialUrl:
      "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
    publishedAt: "1941-10-03",
    effectiveFrom: "1942-01-01",
    passages: [
      {
        referenceLabel: "Código de Processo Penal, Art. 362 e Art. 366",
        content:
          "Art. 366. Se o acusado, citado por edital, não comparecer, nem constituir advogado, ficarão suspensos o processo e o curso do prazo prescricional, podendo o juiz determinar a produção antecipada das provas consideradas urgentes e, se for o caso, decretar prisão preventiva, nos termos do disposto no art. 312.",
        isCurrentlyInForce: true,
      },
    ],
  },
  {
    sourceType: "FEDERAL_LAW" as const,
    authority: "Presidência da República — Casa Civil (Planalto)",
    title: "Lei dos Juizados Especiais da Fazenda Pública e Juizados Especiais Cíveis",
    documentNumber: "Leis nº 12.153/2009 e nº 9.099/1995",
    jurisdiction: "BR-FEDERAL",
    officialUrl:
      "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12153.htm",
    publishedAt: "2009-12-22",
    effectiveFrom: "2010-06-23",
    passages: [
      {
        referenceLabel: "Lei nº 12.153/2009, Art. 7º e Art. 8º",
        content:
          "Art. 7º Não haverá prazo diferenciado para a prática de qualquer ato processual pelas pessoas jurídicas de direito público, inclusive a interposição de recursos, devendo a citação para a audiência de conciliação ser efetuada com antecedência mínima de 30 (trinta) dias. Art. 8º Os representantes judiciais dos réus presentes à audiência poderão conciliar, transigir ou desistir nos processos da competência dos Juizados Especiais, nos termos e nas hipóteses previstas na lei do respectivo ente da Federação.",
        isCurrentlyInForce: true,
      },
      {
        referenceLabel: "Lei nº 9.099/1995, Art. 19",
        content:
          "Art. 19. As intimações serão feitas na forma prevista para citação, ou por qualquer outro meio idôneo de comunicação.",
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
        referenceLabel: "Lei Estadual SP nº 10.261/1968, Arts. 315, 316 e 317",
        content:
          "Art. 315 - Admitir-se-á, a qualquer tempo, a revisão de punição disciplinar de que não caiba mais recurso, se surgirem fatos ou circunstâncias ainda não apreciados, ou vícios insanáveis de procedimento, que possam justificar redução ou anulação da pena aplicada. § 1º - A simples alegação da injustiça da decisão não constitui fundamento do pedido. Art. 316 - A pena imposta não poderá ser agravada pela revisão.",
        isCurrentlyInForce: true,
      },
    ],
  },
  {
    sourceType: "ADMINISTRATIVE_RULE" as const,
    authority: "Corregedoria Geral da Justiça do Estado de São Paulo (TJSP)",
    title: "Normas de Serviço da Corregedoria Geral da Justiça do TJSP (Tomo I)",
    documentNumber: "NSCGJ-TJSP Tomo I",
    jurisdiction: "BR-SP",
    officialUrl: "https://www.tjsp.jus.br/Corregedoria/Comunicados/NormasExtrajudiciais",
    publishedAt: "2013-01-01",
    effectiveFrom: "2013-01-01",
    passages: [
      {
        referenceLabel: "NSCGJ-TJSP, Tomo I, Art. 47 e Art. 49, § 1º e Art. 51",
        content:
          "Art. 47. A inserção de dados no sistema informatizado oficial será a mais completa e abrangente possível, de modo que todas as ocorrências do processo físico constem do ambiente virtual, formando banco de dados que servirá de memória permanente. Art. 49, § 1º É vedado ao funcionário credenciado ceder a respectiva senha ou permitir que outrem, funcionário ou não, use-a para acessar indevidamente o sistema informatizado. Art. 51. Os escrivães judiciais do serviço de distribuição e dos ofícios de justiça realizarão auditoria semanal no sistema, de acordo com os níveis de criticidade definidos, comunicando à Corregedoria Geral da Justiça qualquer irregularidade.",
        isCurrentlyInForce: true,
      },
    ],
  },
] as const;
