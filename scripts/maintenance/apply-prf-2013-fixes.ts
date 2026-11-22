import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";

/**
 * CORREÇÃO CONTROLADA E REVERSÍVEL DA PRF 2013:
 * 1) Migra as 16 referências visuais (7 PNGs em /images/questions/prf-2013/) de Markdown
 *    em supportText para registros reais em QuestionAsset + limpa o texto de apoio.
 * 2) Corrige as 13 classificações auditadas pelo caderno oficial (#67, #69–#73, #75, #77,
 *    #86–#88, #97–#98), criando o assunto filho `legislacao-penal-especial-prf` sob `direito-penal`.
 *
 * Modo padrão: --dry-run (executa simulação transacional REAL com rollback forçado).
 * Somente persiste quando executado explicitamente com `--apply` após autorização.
 */

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
  { originalNumber: 97, targetSubjectSlug: "direitos-e-garantias-fundamentais", targetParentSlug: "direito-constitucional", justification: "Direitos Humanos / Práticas policiais no espaço público — vedação a disparo de advertência (Portaria Interministerial nº 4.226/2010)." },
  { originalNumber: 98, targetSubjectSlug: "direitos-e-garantias-fundamentais", targetParentSlug: "direito-constitucional", justification: "Direitos Humanos / Uso diferenciado da força — emprego de arma de fogo contra veículo em fuga (Portaria Interministerial nº 4.226/2010)." },
];

class DryRunSentinel extends Error {
  constructor(public readonly summary: Record<string, unknown>) {
    super("DRY_RUN_OK");
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const instances = await prisma.examQuestionInstance.findMany({
    where: {
      examForm: { examEdition: { editionCode: "PRF-2013-POLICIAL" } },
    },
    include: {
      question: {
        include: {
          assets: true,
          subjects: { include: { subject: true } },
        },
      },
    },
    orderBy: { originalNumber: "asc" },
  });

  const instByNum = new Map(instances.map((i) => [i.originalNumber, i]));
  const direitoPenalRoot = await prisma.subject.findUnique({ where: { slug: "direito-penal" } });
  if (!direitoPenalRoot) throw new Error("Raiz direito-penal não encontrada.");

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Garantir assunto filho de Legislação Penal Especial sob Direito Penal
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

      const allSubjects = await tx.subject.findMany();
      const subjBySlug = new Map(allSubjects.map((s) => [s.slug, s]));

      // 2. Migrar 16 itens visuais para QuestionAsset + limpar Markdown do supportText
      let assetsMigrated = 0;
      for (const inst of instances) {
        const rawSupport = inst.question.supportText ?? "";
        const imgRegex = /!\[([^\]]*)\]\((\/images\/questions\/prf-2013\/[^)]+)\)/g;
        const matches = [...rawSupport.matchAll(imgRegex)];
        if (matches.length === 0) continue;

        for (let idx = 0; idx < matches.length; idx++) {
          const alt = matches[idx]![1] ?? "";
          const url = matches[idx]![2]!;
          const alreadyExists = inst.question.assets.some(
            (a) => a.objectUrl === url || a.storagePath === url
          );
          if (!alreadyExists) {
            await tx.questionAsset.create({
              data: {
                questionId: inst.question.id,
                assetType: "IMAGE",
                storagePath: url.replace(/^\//, ""),
                objectUrl: url,
                caption: alt || `Figura oficial — PRF 2013 Item #${inst.originalNumber}`,
                position: idx + 1,
              },
            });
            assetsMigrated++;
          }
        }

        const cleanedSupport = rawSupport
          .replace(/!\[[^\]]*\]\(\/images\/questions\/prf-2013\/[^)]+\)\s*/g, "")
          .trim();

        await tx.question.update({
          where: { id: inst.question.id },
          data: { supportText: cleanedSupport || null },
        });
      }

      // 3. Corrigir as 13 classificações auditadas
      let classificationsUpdated = 0;
      for (const fix of PRF_2013_AUDITED_CLASSIFICATION_FIXES) {
        const inst = instByNum.get(fix.originalNumber);
        const childSubj = subjBySlug.get(fix.targetSubjectSlug);
        const parentSubj = subjBySlug.get(fix.targetParentSlug);
        if (!inst || !childSubj || !parentSubj) {
          throw new Error(`Item #${fix.originalNumber} ou assunto ${fix.targetSubjectSlug} não encontrado.`);
        }

        await tx.questionSubject.deleteMany({
          where: { questionId: inst.question.id },
        });
        await tx.questionSubject.createMany({
          data: [
            { questionId: inst.question.id, subjectId: childSubj.id, isPrimary: true },
            { questionId: inst.question.id, subjectId: parentSubj.id, isPrimary: false },
          ],
        });
        classificationsUpdated++;
      }

      const summary = {
        mode: apply ? "APPLIED" : "DRY_RUN_ROLLED_BACK",
        assetsMigrated,
        classificationsUpdated,
      };
      if (!apply) throw new DryRunSentinel(summary);
      console.info("=== CORREÇÕES PRF 2013 APLICADAS ===", summary);
    }, { timeout: 30000 });
  } catch (err) {
    if (err instanceof DryRunSentinel) {
      console.info("=== SIMULAÇÃO TRANSACIONAL PRF 2013 (ROLLBACK CONFIRMADO) ===");
      console.info(err.summary);
      return;
    }
    throw err;
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
