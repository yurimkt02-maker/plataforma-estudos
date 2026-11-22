import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";
import { searchPublishedQuestions } from "../../src/features/question-bank/service";
import { gradeSimulationAttempt } from "../../src/features/scoring/engine";

async function main(): Promise<void> {
  const [owner, prf2013Edition, fisicaRoot, matRoot, infRoot] = await Promise.all([
    prisma.user.findFirst({ select: { id: true } }),
    prisma.examEdition.findUnique({
      where: { editionCode: "PRF-2013-POLICIAL" },
      include: {
        position: { include: { studyTrack: true } },
        ruleset: true,
        examForms: {
          include: {
            questionInstances: {
              include: {
                question: {
                  select: {
                    id: true,
                    status: true,
                    supportText: true,
                    subjects: { include: { subject: true } },
                  },
                },
                answerKeys: { orderBy: { revisionNumber: "desc" } },
              },
              orderBy: { originalNumber: "asc" },
            },
          },
        },
      },
    }),
    prisma.subject.findUnique({ where: { slug: "fisica" } }),
    prisma.subject.findUnique({ where: { slug: "matematica" } }),
    prisma.subject.findUnique({ where: { slug: "informatica" } }),
  ]);

  if (!prf2013Edition || !owner) {
    throw new Error("Edição PRF-2013-POLICIAL ou usuário não encontrado.");
  }

  const form = prf2013Edition.examForms[0];
  const instances = form?.questionInstances ?? [];
  const annulledNums = instances.filter((i) => i.isAnnulled).map((i) => i.originalNumber);
  const q53 = instances.find((i) => i.originalNumber === 53);
  const withImages = instances.filter((i) =>
    (i.question.supportText ?? "").includes("/images/questions/prf-2013/")
  ).length;

  const baseFilter = {
    page: 1,
    pageSize: 20,
    resolutionFilter: "ALL" as const,
    accuracyFilter: "ALL" as const,
    onlyBookmarked: false,
    onlyVerifiedExplanations: false,
    includeAnnulled: true,
    onlyOutdated: false,
    sortBy: "ORIGINAL_NUMBER" as const,
  };

  // 1. Testar filtros reais do Banco de Questões (searchPublishedQuestions)
  const [allPrf2013, fisica2013, mat2013, inf2013, allPrfTotal] = await Promise.all([
    searchPublishedQuestions({
      userId: owner.id,
      filters: {
        ...baseFilter,
        trackCode: "PRF",
        year: 2013,
        questionType: "TRUE_FALSE",
      },
    }),
    searchPublishedQuestions({
      userId: owner.id,
      filters: {
        ...baseFilter,
        trackCode: "PRF",
        year: 2013,
        subjectId: fisicaRoot?.id,
      },
    }),
    searchPublishedQuestions({
      userId: owner.id,
      filters: {
        ...baseFilter,
        trackCode: "PRF",
        year: 2013,
        subjectId: matRoot?.id,
      },
    }),
    searchPublishedQuestions({
      userId: owner.id,
      filters: {
        ...baseFilter,
        trackCode: "PRF",
        year: 2013,
        subjectId: infRoot?.id,
      },
    }),
    searchPublishedQuestions({
      userId: owner.id,
      filters: {
        ...baseFilter,
        trackCode: "PRF",
      },
    }),
  ]);

  // 2. Testar motor de simulado com as 120 questões reais da PRF 2013 (Cebraspe +1 / -1 / 0 + anuladas)
  const simItems = instances.map((inst) => {
    const key = inst.answerKeys.find((k) => k.isDefinitive) ?? inst.answerKeys[0]!;
    const subj = inst.question.subjects.find((s) => s.isPrimary)?.subject ?? inst.question.subjects[0]?.subject;
    const selected = inst.originalNumber <= 100 ? "C" : null;
    return {
      simulationItemId: `sim-prf13-${inst.originalNumber}`,
      questionId: inst.question.id,
      subjectId: subj?.id ?? "unknown",
      subjectName: subj?.name ?? "Sem disciplina",
      selectedAnswer: selected,
      officialKey: {
        id: key.id,
        answerValue: key.answerValue,
        status: key.status,
        revisionNumber: key.revisionNumber,
        isDefinitive: key.isDefinitive,
      },
      isInstanceAnnulled: inst.isAnnulled,
    };
  });

  const simScore = gradeSimulationAttempt({
    attemptStatus: "IN_PROGRESS",
    ruleset: {
      code: prf2013Edition.ruleset.code,
      name: prf2013Edition.ruleset.name,
      questionType:
        prf2013Edition.ruleset.questionType === "TRUE_FALSE"
          ? ("TRUE_FALSE" as const)
          : ("MULTIPLE_CHOICE" as const),
      correctPoints: Number(prf2013Edition.ruleset.correctPoints),
      wrongPoints: Number(prf2013Edition.ruleset.wrongPoints),
      blankPoints: Number(prf2013Edition.ruleset.blankPoints),
      annulledPolicy: prf2013Edition.ruleset.annulledPolicy,
      minPassingPercentage: Number(prf2013Edition.ruleset.minPassingPercentage),
    },
    items: simItems,
  });

  console.info("=== VERIFICAÇÃO DE FILTROS E SIMULADO — PRF 2013 ===");
  console.info({
    editionCode: prf2013Edition.editionCode,
    instancesInEdition: instances.length,
    annulledNumbers: annulledNums,
    item53Answer: q53?.answerKeys[0]?.answerValue ?? null,
    item53Annulled: q53?.isAnnulled ?? null,
    itemsWithVisualAssets: withImages,
    filters: {
      prf2013Total: allPrf2013.totalCount,
      prf2013Fisica: fisica2013.totalCount,
      prf2013Matematica: mat2013.totalCount,
      prf2013Informatica: inf2013.totalCount,
      prfAllYearsTotal: allPrfTotal.totalCount,
    },
    simulationDryRun: {
      totalItems: simItems.length,
      correctCount: simScore.correctCount,
      wrongCount: simScore.wrongCount,
      blankCount: simScore.blankCount,
      annulledCount: simScore.annulledCount,
      netScore: simScore.netScore,
      maxScore: simScore.maxScore,
      subjectsCount: simScore.bySubject.length,
    },
  });

  if (allPrf2013.totalCount !== 120) {
    throw new Error(`Esperado 120 no filtro PRF 2013, obtido ${allPrf2013.totalCount}`);
  }
  if (annulledNums.join(",") !== "47,50") {
    throw new Error(`Esperado anuladas [47,50], obtido [${annulledNums.join(",")}]`);
  }
  if (simScore.annulledCount !== 2) {
    throw new Error(`Esperado 2 anuladas no simulado, obtido ${simScore.annulledCount}`);
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
