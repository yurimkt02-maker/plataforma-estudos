import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";

async function main(): Promise<void> {
  const [tracks, jobs, qByStatus, oabSubjects] = await Promise.all([
    prisma.studyTrack.findMany({
      orderBy: { name: "asc" },
      include: {
        positions: {
          include: {
            examEditions: {
              orderBy: [{ year: "desc" }, { editionCode: "asc" }],
              include: {
                _count: {
                  select: {
                    examForms: true,
                    sourceDocuments: true,
                    importJobs: true,
                  },
                },
                examForms: {
                  include: {
                    questionInstances: {
                      select: {
                        isAnnulled: true,
                        question: { select: { status: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.importJob.findMany({
      include: {
        examEdition: { select: { editionCode: true, title: true } },
        examPdfDocument: {
          select: { title: true, verificationStatus: true },
        },
        answerKeyDocument: {
          select: { title: true, verificationStatus: true },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.question.groupBy({ by: ["status"], _count: true }),
    prisma.subject.findMany({
      include: {
        parent: { select: { slug: true, name: true } },
        _count: {
          select: {
            questionSubjects: {
              where: {
                question: {
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
              },
            },
          },
        },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    }),
  ]);

  console.info("=== 1. TOTAIS POR STATUS ===");
  for (const row of qByStatus) {
    console.info(`  ${row.status}: ${row._count}`);
  }

  console.info("\n=== 2. EDIÇÕES POR CARREIRA ===");
  for (const t of tracks) {
    console.info(`\n[${t.code}] ${t.name}`);
    for (const p of t.positions) {
      for (const ed of p.examEditions) {
        let published = 0;
        let awaiting = 0;
        let other = 0;
        let annulled = 0;
        for (const f of ed.examForms) {
          for (const qi of f.questionInstances) {
            if (qi.isAnnulled) annulled++;
            if (qi.question.status === "PUBLISHED") published++;
            else if (qi.question.status === "AWAITING_REVIEW") awaiting++;
            else other++;
          }
        }
        console.info(
          `  - ${ed.editionCode} (${ed.year}) | Esperado: ${ed.expectedQuestionCount ?? "?"} | Publicadas: ${published} (anul: ${annulled}) | Awaiting: ${awaiting} | Outros: ${other} | Docs: ${ed._count.sourceDocuments} | Jobs: ${ed._count.importJobs}`
        );
      }
    }
  }

  console.info("\n=== 3. IMPORT JOBS ===");
  for (const j of jobs) {
    console.info(
      `  - ${j.id} | ${j.examEdition?.editionCode ?? "-"} | status=${j.status} | items=${j._count.items} | provaDoc=${j.examPdfDocument?.verificationStatus ?? "-"} | gabDoc=${j.answerKeyDocument?.verificationStatus ?? "-"}`
    );
  }

  console.info("\n=== 4. ÁRVORE DE DISCIPLINAS E ASSUNTOS DA OAB ===");
  const roots = oabSubjects.filter((s) => !s.parentId);
  const childrenByParent = new Map<string, typeof oabSubjects>();
  for (const s of oabSubjects) {
    if (s.parentId) {
      const list = childrenByParent.get(s.parentId) ?? [];
      list.push(s);
      childrenByParent.set(s.parentId, list);
    }
  }
  for (const r of roots) {
    const kids = childrenByParent.get(r.id) ?? [];
    const totalOab =
      r._count.questionSubjects +
      kids.reduce((sum, k) => sum + k._count.questionSubjects, 0);
    if (totalOab === 0) continue;
    console.info(
      `  ROOT ${r.slug} | ${r.name} | qs_diretas=${r._count.questionSubjects} | filhos=${kids.length} | total_oab=${totalOab}`
    );
    for (const k of kids) {
      if (k._count.questionSubjects > 0 || kids.length <= 20) {
        console.info(
          `     └─ ${k.slug} | ${k.name} | qs=${k._count.questionSubjects}`
        );
      }
    }
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
