import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";

/**
 * CORREÇÃO CONTROLADA, CIRÚRGICA E IDEMPOTENTE DA PRF 2013:
 * 1) Migra as 16 associações visuais (7 PNGs em /images/questions/prf-2013/) de Markdown
 *    em supportText para registros QuestionAsset + limpa apenas o Markdown bruto sem apagar texto de apoio.
 * 2) Corrige as 13 classificações auditadas pelo caderno oficial (#67, #69–#73, #75, #77,
 *    #86–#88, #97–#98) SEM apagar vínculos adicionais legítimos (remove apenas `crimes-de-transito`
 *    e `legislacao-de-transito-ctb`, garantindo exatamente 1 vínculo principal consistente).
 * 3) Verifica se cada questão pertence a outras edições antes de alterar.
 * 4) Modo padrão: --dry-run (executa 2 passagens dentro da mesma transação com ROLLBACK forçado,
 *    comprovando idempotência e zero alterações persistidas).
 */

export const WRONG_PRF2013_TRAFFIC_SLUGS = new Set([
  "crimes-de-transito",
  "legislacao-de-transito-ctb",
]);

export const PRF_2013_AUDITED_CLASSIFICATION_FIXES: Array<{
  originalNumber: number;
  targetSubjectSlug: string;
  targetParentSlug: string;
  justification: string;
}> = [
  { originalNumber: 67, targetSubjectSlug: "teoria-do-crime-e-imputabilidade", targetParentSlug: "direito-penal", justification: "Embriaguez decorrente de caso fortuito e imputabilidade penal (CP, art. 28)." },
  { originalNumber: 69, targetSubjectSlug: "teoria-do-crime-e-imputabilidade", targetParentSlug: "direito-penal", justification: "Concurso de pessoas e teoria monista do Código Penal (CP, art. 29)." },
  { originalNumber: 70, targetSubjectSlug: "teoria-do-crime-e-imputabilidade", targetParentSlug: "direito-penal", justification: "Roubo consumado vs. tentado com emprego de arma de fogo (CP, art. 157)." },
  { originalNumber: 71, targetSubjectSlug: "crimes-contra-a-administracao-publica", targetParentSlug: "direito-penal", justification: "Peculato e comunicabilidade da condição de funcionário público (CP, arts. 30 e 312)." },
  { originalNumber: 72, targetSubjectSlug: "crimes-contra-a-administracao-publica", targetParentSlug: "direito-penal", justification: "Distinção entre concussão e corrupção passiva (CP, arts. 316 e 317)." },
  { originalNumber: 73, targetSubjectSlug: "teoria-do-crime-e-imputabilidade", targetParentSlug: "direito-penal", justification: "Distinção entre furto mediante fraude e estelionato (CP, arts. 155 §4º II e 171)." },
  { originalNumber: 75, targetSubjectSlug: "inquerito-policial", targetParentSlug: "direito-processual-penal", justification: "Disposições preliminares do CPP e aplicação analógica (CPP, art. 3º)." },
  { originalNumber: 77, targetSubjectSlug: "inquerito-policial", targetParentSlug: "direito-processual-penal", justification: "Dispensabilidade do inquérito policial para oferecimento de denúncia pelo MP (CPP, arts. 12 e 39 §5º)." },
  { originalNumber: 86, targetSubjectSlug: "legislacao-penal-especial-prf", targetParentSlug: "direito-penal", justification: "Abuso de autoridade — exigência de dolo vs. modalidade culposa (Legislação Penal Especial)." },
  { originalNumber: 87, targetSubjectSlug: "legislacao-penal-especial-prf", targetParentSlug: "direito-penal", justification: "Lei de Drogas — consumo/posse de substância entorpecente (Lei nº 11.343/2006, art. 28)." },
  { originalNumber: 88, targetSubjectSlug: "legislacao-penal-especial-prf", targetParentSlug: "direito-penal", justification: "Lei das Contravenções Penais — uso ilegítimo de uniforme público (DL nº 3.688/1941, art. 46)." },
  { originalNumber: 97, targetSubjectSlug: "direitos-humanos-e-uso-da-forca", targetParentSlug: "direito-constitucional", justification: "Direitos Humanos / Práticas policiais no espaço público — vedação a disparo de advertência para o alto (Portaria Interministerial nº 4.226/2010)." },
  { originalNumber: 98, targetSubjectSlug: "direitos-humanos-e-uso-da-forca", targetParentSlug: "direito-constitucional", justification: "Direitos Humanos / Uso diferenciado da força — emprego de arma de fogo contra veículo em fuga sem risco imediato (Portaria Interministerial nº 4.226/2010)." },
];

export interface ExistingSubjectLink {
  subjectId: string;
  subjectSlug: string;
  isPrimary: boolean;
}

export interface TargetedSubjectUpdatePlan {
  subjectIdsToRemove: string[];
  subjectIdsToDemotePrimary: string[];
  subjectToUpsertPrimary: string;
  subjectToUpsertParent: string;
  preservedAdditionalSlugs: string[];
}

/**
 * Calcula a substituição cirúrgica dos vínculos incorretos sem apagar vínculos legítimos adicionais,
 * garantindo exatamente 1 vínculo principal (`isPrimary: true`) e idempotência total.
 */
export function computeTargetedSubjectUpdate(params: {
  existingLinks: ExistingSubjectLink[];
  wrongSlugs: Set<string>;
  targetChildId: string;
  targetParentId: string;
}): TargetedSubjectUpdatePlan {
  const { existingLinks, wrongSlugs, targetChildId, targetParentId } = params;

  const subjectIdsToRemove: string[] = [];
  const subjectIdsToDemotePrimary: string[] = [];
  const preservedAdditionalSlugs: string[] = [];

  for (const link of existingLinks) {
    if (wrongSlugs.has(link.subjectSlug)) {
      subjectIdsToRemove.push(link.subjectId);
      continue;
    }
    if (link.subjectId !== targetChildId && link.subjectId !== targetParentId) {
      preservedAdditionalSlugs.push(link.subjectSlug);
    }
    if (link.isPrimary && link.subjectId !== targetChildId) {
      subjectIdsToDemotePrimary.push(link.subjectId);
    }
  }

  return {
    subjectIdsToRemove,
    subjectIdsToDemotePrimary,
    subjectToUpsertPrimary: targetChildId,
    subjectToUpsertParent: targetParentId,
    preservedAdditionalSlugs,
  };
}

class DryRunSentinel extends Error {
  constructor(public readonly summary: Record<string, unknown>) {
    super("DRY_RUN_OK");
  }
}

async function runCli(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const instances = await prisma.examQuestionInstance.findMany({
    where: {
      examForm: { examEdition: { editionCode: "PRF-2013-POLICIAL" } },
    },
    include: {
      question: {
        include: {
          assets: { orderBy: { position: "asc" } },
          subjects: { include: { subject: true } },
          _count: { select: { examInstances: true } },
        },
      },
    },
    orderBy: { originalNumber: "asc" },
  });

  const instByNum = new Map(instances.map((i) => [i.originalNumber, i]));
  const [direitoPenalRoot, direitoConstRoot] = await Promise.all([
    prisma.subject.findUnique({ where: { slug: "direito-penal" } }),
    prisma.subject.findUnique({ where: { slug: "direito-constitucional" } }),
  ]);
  if (!direitoPenalRoot || !direitoConstRoot) {
    throw new Error("Raízes direito-penal ou direito-constitucional não encontradas.");
  }

  // Verificar se alguma das 13 questões está vinculada a outras edições
  const sharedAcrossEditions: number[] = [];
  for (const fix of PRF_2013_AUDITED_CLASSIFICATION_FIXES) {
    const inst = instByNum.get(fix.originalNumber);
    if (inst && inst.question._count.examInstances > 1) {
      sharedAcrossEditions.push(fix.originalNumber);
    }
  }
  if (sharedAcrossEditions.length > 0) {
    throw new Error(
      `Abortado: itens [${sharedAcrossEditions.join(", ")}] estão vinculados a múltiplas edições.`
    );
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Garantir os 2 novos assuntos filhos (sem duplicar)
        await tx.subject.upsert({
          where: { slug: "legislacao-penal-especial-prf" },
          update: { parentId: direitoPenalRoot.id },
          create: {
            slug: "legislacao-penal-especial-prf",
            name: "Legislação Penal Especial (Drogas, Armas, Abuso de Autoridade e Contravenções)",
            parentId: direitoPenalRoot.id,
            isLegalSubject: true,
            displayOrder: 12,
          },
        });
        await tx.subject.upsert({
          where: { slug: "direitos-humanos-e-uso-da-forca" },
          update: { parentId: direitoConstRoot.id },
          create: {
            slug: "direitos-humanos-e-uso-da-forca",
            name: "Direitos Humanos e Uso Diferenciado da Força (Portaria Interministerial nº 4.226/2010)",
            parentId: direitoConstRoot.id,
            isLegalSubject: true,
            displayOrder: 12,
          },
        });

        const allSubjects = await tx.subject.findMany();
        const subjBySlug = new Map(allSubjects.map((s) => [s.slug, s]));

        const visualInstanceIds = instances
          .filter((i) =>
            (i.question.supportText ?? "").includes("/images/questions/prf-2013/") ||
            i.question.assets.length > 0
          )
          .map((i) => i.question.id);
        const visualNumByQId = new Map(
          instances.map((i) => [i.question.id, i.originalNumber])
        );

        async function executeSinglePass(): Promise<{
          assetsMigrated: number;
          supportTextsCleaned: number;
          wrongLinksRemoved: number;
          classificationsChecked: number;
        }> {
          let assetsMigrated = 0;
          let supportTextsCleaned = 0;
          let wrongLinksRemoved = 0;

          // A. Migrar imagens Markdown -> QuestionAsset (1 query em lote, idempotente)
          const freshVisualQuestions = await tx.question.findMany({
            where: { id: { in: visualInstanceIds } },
            include: { assets: true },
          });

          for (const freshQ of freshVisualQuestions) {
            const origNum = visualNumByQId.get(freshQ.id) ?? 0;
            const rawSupport = freshQ.supportText ?? "";
            const imgRegex = /!\[([^\]]*)\]\((\/images\/questions\/prf-2013\/[^)]+)\)/g;
            const matches = [...rawSupport.matchAll(imgRegex)];
            if (matches.length === 0) continue;

            for (let idx = 0; idx < matches.length; idx++) {
              const alt = matches[idx]![1] ?? "";
              const url = matches[idx]![2]!;
              const alreadyExists = freshQ.assets.some(
                (a) => a.objectUrl === url || a.storagePath === url.replace(/^\//, "")
              );
              if (!alreadyExists) {
                await tx.questionAsset.create({
                  data: {
                    questionId: freshQ.id,
                    assetType: "IMAGE",
                    storagePath: url.replace(/^\//, ""),
                    objectUrl: url,
                    caption: alt || `Figura oficial — PRF 2013 Item #${origNum}`,
                    position: idx + 1,
                  },
                });
                assetsMigrated++;
              }
            }

            const cleanedSupport = rawSupport
              .replace(/!\[[^\]]*\]\(\/images\/questions\/prf-2013\/[^)]+\)\s*/g, "")
              .trim();
            if (cleanedSupport !== rawSupport) {
              await tx.question.update({
                where: { id: freshQ.id },
                data: { supportText: cleanedSupport || null },
              });
              supportTextsCleaned++;
            }
          }

          // B. Substituir cirurgicamente apenas os vínculos incorretos das 13 questões
          for (const fix of PRF_2013_AUDITED_CLASSIFICATION_FIXES) {
            const inst = instByNum.get(fix.originalNumber);
            const childSubj = subjBySlug.get(fix.targetSubjectSlug);
            const parentSubj = subjBySlug.get(fix.targetParentSlug);
            if (!inst || !childSubj || !parentSubj) {
              throw new Error(`Item #${fix.originalNumber} ou assunto ${fix.targetSubjectSlug} ausente.`);
            }

            const liveLinks = await tx.questionSubject.findMany({
              where: { questionId: inst.question.id },
              include: { subject: true },
            });

            const plan = computeTargetedSubjectUpdate({
              existingLinks: liveLinks.map((l) => ({
                subjectId: l.subjectId,
                subjectSlug: l.subject.slug,
                isPrimary: l.isPrimary,
              })),
              wrongSlugs: WRONG_PRF2013_TRAFFIC_SLUGS,
              targetChildId: childSubj.id,
              targetParentId: parentSubj.id,
            });

            if (plan.subjectIdsToRemove.length > 0) {
              const delRes = await tx.questionSubject.deleteMany({
                where: {
                  questionId: inst.question.id,
                  subjectId: { in: plan.subjectIdsToRemove },
                },
              });
              wrongLinksRemoved += delRes.count;
            }

            if (plan.subjectIdsToDemotePrimary.length > 0) {
              await tx.questionSubject.updateMany({
                where: {
                  questionId: inst.question.id,
                  subjectId: { in: plan.subjectIdsToDemotePrimary },
                },
                data: { isPrimary: false },
              });
            }

            await tx.questionSubject.upsert({
              where: {
                questionId_subjectId: {
                  questionId: inst.question.id,
                  subjectId: plan.subjectToUpsertPrimary,
                },
              },
              update: { isPrimary: true },
              create: {
                questionId: inst.question.id,
                subjectId: plan.subjectToUpsertPrimary,
                isPrimary: true,
              },
            });

            await tx.questionSubject.upsert({
              where: {
                questionId_subjectId: {
                  questionId: inst.question.id,
                  subjectId: plan.subjectToUpsertParent,
                },
              },
              update: { isPrimary: false },
              create: {
                questionId: inst.question.id,
                subjectId: plan.subjectToUpsertParent,
                isPrimary: false,
              },
            });
          }

          return {
            assetsMigrated,
            supportTextsCleaned,
            wrongLinksRemoved,
            classificationsChecked: PRF_2013_AUDITED_CLASSIFICATION_FIXES.length,
          };
        }

        const pass1 = await executeSinglePass();
        // Em dry-run, executamos uma 2ª passagem na mesma transação para provar idempotência!
        const pass2 = !apply ? await executeSinglePass() : null;

        const summary = {
          mode: apply ? "APPLIED" : "DRY_RUN_ROLLED_BACK",
          sharedAcrossEditionsCount: sharedAcrossEditions.length,
          pass1,
          pass2IdempotencyProof: pass2,
        };

        if (!apply) throw new DryRunSentinel(summary);
        console.info("=== CORREÇÕES CIRÚRGICAS PRF 2013 APLICADAS ===", summary);
      },
      { timeout: 30000 }
    );
  } catch (err) {
    if (err instanceof DryRunSentinel) {
      console.info("=== SIMULAÇÃO TRANSACIONAL PRF 2013 (2 PASSAGENS + ROLLBACK OK) ===");
      console.info(err.summary);
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
