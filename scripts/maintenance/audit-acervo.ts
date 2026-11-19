import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";

async function main(): Promise<void> {
  console.info("=== AUDITORIA COMPLETA DO ACERVO NO PRISMA POSTGRES ===\n");

  const [
    totalQuestions,
    questionsByStatus,
    totalInstances,
    totalAnswerKeys,
    answerKeysByStatus,
    sourceDocs,
    editions,
    questionsWithoutSubject,
    allQuestions,
  ] = await Promise.all([
    prisma.question.count(),
    prisma.question.groupBy({ by: ["status"], _count: true }),
    prisma.examQuestionInstance.count(),
    prisma.officialAnswerKey.count(),
    prisma.officialAnswerKey.groupBy({
      by: ["status", "isDefinitive"],
      _count: true,
    }),
    prisma.sourceDocument.findMany({
      include: {
        examEdition: { select: { editionCode: true, title: true } },
        _count: { select: { questionSources: true, answerKeys: true } },
      },
      orderBy: { retrievedAt: "asc" },
    }),
    prisma.examEdition.findMany({
      include: {
        position: { include: { studyTrack: true } },
        examBoard: true,
        examForms: {
          include: {
            questionInstances: {
              include: {
                question: {
                  include: {
                    options: { orderBy: { displayOrder: "asc" } },
                    subjects: { include: { subject: true } },
                    sources: { include: { sourceDocument: true } },
                  },
                },
                answerKeys: {
                  include: { sourceDocument: true },
                  orderBy: { revisionNumber: "desc" },
                },
              },
              orderBy: { originalNumber: "asc" },
            },
          },
        },
      },
      orderBy: { editionCode: "asc" },
    }),
    prisma.question.count({
      where: { subjects: { none: {} } },
    }),
    prisma.question.findMany({
      select: {
        id: true,
        canonicalHash: true,
        statement: true,
        status: true,
        questionType: true,
        _count: { select: { options: true, examInstances: true, subjects: true } },
      },
    }),
  ]);

  console.info("1. TOTAIS GERAIS:");
  console.info({
    totalQuestions,
    questionsByStatus,
    totalInstances,
    totalAnswerKeys,
    answerKeysByStatus,
    questionsWithoutSubject,
  });

  // Verificar duplicidades por enunciado normalizado
  const normMap = new Map<string, string[]>();
  for (const q of allQuestions) {
    const norm = q.statement.toLowerCase().replace(/\s+/g, " ").trim();
    const list = normMap.get(norm) ?? [];
    list.push(q.id);
    normMap.set(norm, list);
  }
  const duplicates = [...normMap.entries()].filter(([, ids]) => ids.length > 1);
  console.info(`\n2. DUPLICIDADES DE ENUNCIADO: ${duplicates.length}`);
  for (const [stmt, ids] of duplicates) {
    console.info(`   - ${ids.length}x: "${stmt.slice(0, 80)}..." (${ids.join(", ")})`);
  }

  // Verificar integridade de opções
  const badOptions = allQuestions.filter((q) => {
    if (q.questionType === "TRUE_FALSE") return q._count.options !== 2;
    return q._count.options < 4 || q._count.options > 5;
  });
  console.info(`\n3. QUESTÕES COM CONTAGEM DE ALTERNATIVAS ANÔMALA: ${badOptions.length}`);
  for (const q of badOptions) {
    console.info(`   - ${q.id} (${q.questionType}): ${q._count.options} opções`);
  }

  console.info("\n4. DOCUMENTOS-FONTE (PROVENIÊNCIA):");
  for (const doc of sourceDocs) {
    console.info(
      `   - [${doc.documentType}] ${doc.examEdition?.editionCode ?? "SEM_EDICAO"} | ${doc.title}`
    );
    console.info(
      `     Status: ${doc.verificationStatus} | SHA-256: ${doc.sha256.slice(0, 16)}... | URL: ${doc.officialUrl}`
    );
    console.info(
      `     Questões vinculadas: ${doc._count.questionSources} | Gabaritos vinculados: ${doc._count.answerKeys} | Data: ${doc.sourceDate?.toISOString().slice(0, 10) ?? "N/A"}`
    );
  }

  console.info("\n5. DETALHAMENTO POR PROVA E CADERNO:");
  for (const ed of editions) {
    const totalInst = ed.examForms.reduce((acc, f) => acc + f.questionInstances.length, 0);
    if (totalInst === 0) continue;

    console.info(
      `\n   >>> ${ed.editionCode} | ${ed.title} | Banca: ${ed.examBoard.name} | Data: ${ed.examDate?.toISOString().slice(0, 10) ?? "N/A"}`
    );
    for (const form of ed.examForms) {
      if (form.questionInstances.length === 0) continue;
      const annulled = form.questionInstances
        .filter((i) => i.isAnnulled)
        .map((i) => i.originalNumber);
      const withoutKey = form.questionInstances
        .filter((i) => i.answerKeys.length === 0)
        .map((i) => i.originalNumber);
      const multipleKeys = form.questionInstances
        .filter((i) => i.answerKeys.length > 1)
        .map((i) => i.originalNumber);
      const nums = form.questionInstances.map((i) => i.originalNumber);
      console.info(
        `       Caderno: ${form.versionLabel} (default=${form.isDefault}) | Instâncias: ${nums.length} | Range: #${Math.min(...nums)}..#${Math.max(...nums)}`
      );
      console.info(
        `       Anuladas (${annulled.length}): [${annulled.join(", ")}] | Sem gabarito: [${withoutKey.join(", ")}] | Múltiplas revisões: [${multipleKeys.join(", ")}]`
      );

      // Para provas menores (<= 25 itens), listar cada questão para inspeção manual
      if (form.questionInstances.length <= 25) {
        for (const inst of form.questionInstances) {
          const defKey = inst.answerKeys.find((k) => k.isDefinitive) ?? inst.answerKeys[0];
          const subj = inst.question.subjects
            .filter((s) => s.isPrimary)
            .map((s) => s.subject.name)
            .join(", ");
          const mapping = inst.optionMapping ? JSON.stringify(inst.optionMapping) : "null";
          console.info(
            `         #${inst.originalNumber} | Gab: ${defKey?.answerValue ?? "NONE"} (${defKey?.status ?? "-"}) | Anulada=${inst.isAnnulled} | Status=${inst.question.status} | Disc: ${subj || "SEM_DISC"} | Map=${mapping}`
          );
          console.info(`            Enunciado: ${inst.question.statement.slice(0, 110)}...`);
        }
      }
    }
  }
}

main()
  .catch((err) => {
    console.error("[ERRO AUDITORIA]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
