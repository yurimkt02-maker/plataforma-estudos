import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../../src/lib/db/prisma";
import { CLASSIFICATION_PENDING_SLUG } from "../../src/features/imports/pdf-parser";

const JOB_ID = "55bbff6b-372f-4968-8a04-5fb2dd7727bb";

const NEW_GENERAL_SUBJECTS = [
  { name: "Atualidades", slug: "atualidades", isLegalSubject: false, displayOrder: 80 },
  { name: "Matemática", slug: "matematica", isLegalSubject: false, displayOrder: 81 },
  { name: "Informática", slug: "informatica", isLegalSubject: false, displayOrder: 82 },
  { name: "Raciocínio Lógico", slug: "raciocinio-logico", isLegalSubject: false, displayOrder: 83 },
];

type AssetDef = {
  url: string;
  filePath: string;
  caption: string;
};

const VISUAL_ASSETS_BY_Q: Record<number, AssetDef> = {
  53: {
    url: "/images/questions/tjsp-2025/tjsp2503-q53.png",
    filePath: "public/images/questions/tjsp-2025/tjsp2503-q53.png",
    caption:
      "Figura oficial da Questão 53 (TJSP2503, Versão 1, pág. 18): quadrado com dois retângulos internos, área livre de 253 cm², cotas 4 cm e 10 cm.",
  },
  58: {
    url: "/images/questions/tjsp-2025/tjsp2503-q58.png",
    filePath: "public/images/questions/tjsp-2025/tjsp2503-q58.png",
    caption:
      "Planilha oficial da Questão 58 (TJSP2503, Versão 1, pág. 20): MS-Excel 365 (células A1:D9 — Código, Descrição, Processo, Data, Situação).",
  },
  59: {
    url: "/images/questions/tjsp-2025/tjsp2503-q59.png",
    filePath: "public/images/questions/tjsp-2025/tjsp2503-q59.png",
    caption:
      "Planilha oficial da Questão 59 (TJSP2503, Versão 1, pág. 20): MS-Excel 365 (células A1:C4 — matriz numérica para fórmula SE/MAIOR/MENOR).",
  },
};

function resolveObjectiveTjsp2025Subject(
  num: number,
  statement: string
): {
  subjectSlug: string;
  classificationStatus: "CLASSIFIED" | "CLASSIFICATION_PENDING";
  pdfSection: string;
  reviewNote: string | null;
} {
  // Língua Portuguesa (p. 3–6)
  if (num >= 1 && num <= 16) {
    if ([1, 6, 11].includes(num)) {
      return {
        subjectSlug: "interpretacao-e-compreensao-de-textos",
        classificationStatus: "CLASSIFIED",
        pdfSection: "Língua Portuguesa",
        reviewNote: null,
      };
    }
    if ([4, 5, 14, 16].includes(num)) {
      return {
        subjectSlug: "concordancia-e-regencia",
        classificationStatus: "CLASSIFIED",
        pdfSection: "Língua Portuguesa",
        reviewNote: null,
      };
    }
    return {
      subjectSlug: "lingua-portuguesa",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Língua Portuguesa",
      reviewNote: null,
    };
  }

  // Direito Penal (p. 7)
  if (num >= 17 && num <= 20) {
    if (num === 17 || num === 18) {
      return {
        subjectSlug: "crimes-contra-a-fe-publica",
        classificationStatus: "CLASSIFIED",
        pdfSection: "Direito Penal",
        reviewNote: null,
      };
    }
    return {
      subjectSlug: "crimes-contra-a-administracao-publica",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Direito Penal",
      reviewNote: null,
    };
  }

  // Direito Processual Penal (p. 7–8)
  if (num >= 21 && num <= 25) {
    if (num === 23) {
      return {
        subjectSlug: "citacoes-e-intimacoes-cpp",
        classificationStatus: "CLASSIFIED",
        pdfSection: "Direito Processual Penal",
        reviewNote: null,
      };
    }
    return {
      subjectSlug: "direito-processual-penal",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Direito Processual Penal",
      reviewNote: null,
    };
  }

  // Direito Processual Civil (p. 8–9)
  if (num >= 26 && num <= 30) {
    if (num === 29 || /juizado especial/i.test(statement)) {
      return {
        subjectSlug: "juizados-especiais-civeis-e-fazenda-publica",
        classificationStatus: "CLASSIFIED",
        pdfSection: "Direito Processual Civil",
        reviewNote: null,
      };
    }
    return {
      subjectSlug: "direito-processual-civil",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Direito Processual Civil",
      reviewNote: null,
    };
  }

  // Direito Constitucional (p. 10–11)
  if (num >= 31 && num <= 35) {
    if (num === 34) {
      return {
        subjectSlug: "administracao-publica-cf88",
        classificationStatus: "CLASSIFIED",
        pdfSection: "Direito Constitucional",
        reviewNote: null,
      };
    }
    return {
      subjectSlug: "direitos-e-garantias-fundamentais",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Direito Constitucional",
      reviewNote: null,
    };
  }

  // Direito Administrativo (p. 11–15)
  if (num >= 36 && num <= 38) {
    return {
      subjectSlug: "estatuto-funcionarios-publicos-sp-lei-10261",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Direito Administrativo",
      reviewNote: null,
    };
  }
  if (num >= 39 && num <= 41) {
    if (/8\.429|improbidade/i.test(statement)) {
      return {
        subjectSlug: "improbidade-administrativa-lei-8429",
        classificationStatus: "CLASSIFIED",
        pdfSection: "Direito Administrativo",
        reviewNote: null,
      };
    }
    return {
      subjectSlug: "direito-administrativo",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Direito Administrativo",
      reviewNote: null,
    };
  }
  if (num >= 42 && num <= 46) {
    // Fronteira entre Direito Administrativo e Normas da Corregedoria/Regimento Interno/LC 1.111/2010:
    // encaminhar expressamente para decisão humana sem forçar classificação genérica.
    return {
      subjectSlug: CLASSIFICATION_PENDING_SLUG,
      classificationStatus: "CLASSIFICATION_PENDING",
      pdfSection: "Direito Administrativo / Normas Internas TJSP",
      reviewNote:
        "No caderno TJSP2503 está sob Direito Administrativo, mas versa sobre norma interna do TJSP (eproc, teletrabalho, LC nº 1.111/2010, Regimento Interno ou ofício judicial). Confirme manualmente a disciplina/assunto antes de aprovar.",
    };
  }

  // Atualidades (p. 15–16)
  if (num >= 47 && num <= 49) {
    return {
      subjectSlug: "atualidades",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Atualidades",
      reviewNote: null,
    };
  }
  if (num === 50) {
    return {
      subjectSlug: CLASSIFICATION_PENDING_SLUG,
      classificationStatus: "CLASSIFICATION_PENDING",
      pdfSection: "Atualidades (Lei nº 13.146/2015)",
      reviewNote:
        "No caderno TJSP2503 aparece no bloco Atualidades (p. 16), mas trata da Lei nº 13.146/2015 (Estatuto da Pessoa com Deficiência). Confirme manualmente se prefere classificar em Atualidades ou disciplina jurídica.",
    };
  }

  // Matemática (p. 17–18)
  if (num >= 51 && num <= 54) {
    return {
      subjectSlug: "matematica",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Matemática",
      reviewNote: null,
    };
  }

  // Informática (p. 19–21)
  if (num >= 55 && num <= 63) {
    return {
      subjectSlug: "informatica",
      classificationStatus: "CLASSIFIED",
      pdfSection: "Informática",
      reviewNote: null,
    };
  }

  // Raciocínio Lógico (p. 22–23)
  return {
    subjectSlug: "raciocinio-logico",
    classificationStatus: "CLASSIFIED",
    pdfSection: "Raciocínio Lógico",
    reviewNote: null,
  };
}

async function main(): Promise<void> {
  // 1. Garantir disciplinas de Conhecimentos Gerais no catálogo
  for (const subj of NEW_GENERAL_SUBJECTS) {
    await prisma.subject.upsert({
      where: { slug: subj.slug },
      update: { name: subj.name, isLegalSubject: subj.isLegalSubject },
      create: subj,
    });
  }

  const job = await prisma.importJob.findUnique({
    where: { id: JOB_ID },
    include: {
      answerKeyDocument: true,
      items: { orderBy: { originalNumber: "asc" } },
    },
  });

  if (!job) {
    throw new Error(`ImportJob ${JOB_ID} não encontrado.`);
  }

  // 2. Preservar integridade do gabarito: não marcar gabarito preliminar (07/12/2025) como definitivo verificado
  if (job.answerKeyDocumentId) {
    await prisma.sourceDocument.update({
      where: { id: job.answerKeyDocumentId },
      data: {
        verificationStatus: "PENDING",
      },
    });
  }

  let classifiedCount = 0;
  let pendingClassCount = 0;
  let visualAssetsAttached = 0;

  for (const item of job.items) {
    const payload = (item.structuredPayloadJson as Record<string, unknown>) ?? {};
    const statement = String(payload.statement ?? "");
    const mapping = resolveObjectiveTjsp2025Subject(item.originalNumber, statement);

    if (mapping.classificationStatus === "CLASSIFIED") {
      classifiedCount++;
    } else {
      pendingClassCount++;
    }

    const assetDef = VISUAL_ASSETS_BY_Q[item.originalNumber];
    let assets: Array<{
      url: string;
      caption: string;
      assetType: string;
      sha256: string;
    }> = [];

    if (assetDef) {
      const absPath = path.resolve(process.cwd(), assetDef.filePath);
      if (!fs.existsSync(absPath)) {
        throw new Error(`Arquivo visual ausente: ${absPath}`);
      }
      const sha256 = createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
      assets = [
        {
          url: assetDef.url,
          caption: assetDef.caption,
          assetType: "IMAGE",
          sha256,
        },
      ];
      visualAssetsAttached++;
    }

    const nextReviewState =
      mapping.classificationStatus === "CLASSIFICATION_PENDING"
        ? "AWAITING_REVIEW"
        : "STRUCTURALLY_VALID";

    await prisma.importJobItem.update({
      where: { id: item.id },
      data: {
        validationStatus: "PENDING",
        reviewedAt: null,
        structuredPayloadJson: {
          ...payload,
          subjectSlug: mapping.subjectSlug,
          classificationStatus: mapping.classificationStatus,
          pdfSection: mapping.pdfSection,
          hasMissingVisualOrTable: false,
          visualWarning: assetDef
            ? `Recurso visual extraído do PDF oficial e anexado (${assetDef.url}). Confira visualmente antes de aprovar.`
            : null,
          assets,
          answerKeyVerified: false,
          reviewState: nextReviewState,
          reviewNotes: mapping.reviewNote,
        },
      },
    });
  }

  await prisma.importJob.update({
    where: { id: JOB_ID },
    data: {
      status: "AWAITING_REVIEW",
      totalDetected: job.items.length,
      totalStructured: job.items.length,
      totalValidated: 0,
      totalPublished: 0,
    },
  });

  console.log("=== CURADORIA PREPARADA (SEM APROVAÇÃO HUMANA FICTÍCIA) ===", {
    jobId: JOB_ID,
    totalItems: job.items.length,
    classifiedCount,
    pendingClassCount,
    visualAssetsAttached,
    answerKeyDocStatus: "PENDING (gabarito preliminar 07/12/2025 — aguardando conferência definitiva jan/2026)",
    totalValidated: 0,
    totalPublished: 0,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
