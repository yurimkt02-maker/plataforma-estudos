import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

export interface OabSubjectLinkSnapshot {
  questionId: string;
  editionCode: string;
  originalNumber: number;
  subjectId: string;
  subjectSlug: string;
  subjectName: string;
  parentId: string | null;
  parentSlug: string | null;
  isPrimary: boolean;
}

export interface OabTaxonomySnapshot {
  schemaVersion: 1;
  createdAt: string;
  totalQuestions: number;
  totalLinks: number;
  countsByEdition: Record<string, number>;
  countsByDisciplineSlug: Record<string, number>;
  links: OabSubjectLinkSnapshot[];
  checksumSha256: string;
}

export function computeSnapshotChecksum(links: OabSubjectLinkSnapshot[]): string {
  const canonical = JSON.stringify(
    [...links].sort((a, b) =>
      `${a.questionId}:${a.subjectId}`.localeCompare(`${b.questionId}:${b.subjectId}`)
    )
  );
  return crypto.createHash("sha256").update(canonical, "utf-8").digest("hex");
}

export function computeRollbackPlan(
  currentLinks: Array<{ questionId: string; subjectId: string; isPrimary: boolean }>,
  snapshotLinks: Array<{ questionId: string; subjectId: string; isPrimary: boolean }>
): {
  toDelete: Array<{ questionId: string; subjectId: string }>;
  toInsert: Array<{ questionId: string; subjectId: string; isPrimary: boolean }>;
  toUpdatePrimary: Array<{ questionId: string; subjectId: string; isPrimary: boolean }>;
} {
  const currMap = new Map(currentLinks.map((l) => [`${l.questionId}::${l.subjectId}`, l]));
  const snapMap = new Map(snapshotLinks.map((l) => [`${l.questionId}::${l.subjectId}`, l]));

  const toDelete: Array<{ questionId: string; subjectId: string }> = [];
  const toInsert: Array<{ questionId: string; subjectId: string; isPrimary: boolean }> = [];
  const toUpdatePrimary: Array<{ questionId: string; subjectId: string; isPrimary: boolean }> = [];

  for (const [key, curr] of currMap.entries()) {
    if (!snapMap.has(key)) {
      toDelete.push({ questionId: curr.questionId, subjectId: curr.subjectId });
    }
  }

  for (const [key, snap] of snapMap.entries()) {
    const curr = currMap.get(key);
    if (!curr) {
      toInsert.push({
        questionId: snap.questionId,
        subjectId: snap.subjectId,
        isPrimary: snap.isPrimary,
      });
    } else if (curr.isPrimary !== snap.isPrimary) {
      toUpdatePrimary.push({
        questionId: snap.questionId,
        subjectId: snap.subjectId,
        isPrimary: snap.isPrimary,
      });
    }
  }

  return { toDelete, toInsert, toUpdatePrimary };
}

async function fetchCurrentOabLinks(): Promise<{
  questionIds: string[];
  links: OabSubjectLinkSnapshot[];
  countsByEdition: Record<string, number>;
  countsByDisciplineSlug: Record<string, number>;
}> {
  const instances = await prisma.examQuestionInstance.findMany({
    where: {
      question: { status: "PUBLISHED" },
      examForm: {
        examEdition: {
          position: { studyTrack: { is: { code: "OAB" } } },
        },
      },
    },
    include: {
      examForm: {
        include: { examEdition: { select: { editionCode: true } } },
      },
      question: {
        include: {
          subjects: {
            include: {
              subject: {
                include: { parent: { select: { slug: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { examForm: { examEdition: { editionCode: "asc" } } },
      { originalNumber: "asc" },
    ],
  });

  const questionIds: string[] = [];
  const links: OabSubjectLinkSnapshot[] = [];
  const countsByEdition: Record<string, number> = {};
  const countsByDisciplineSlug: Record<string, number> = {};

  for (const inst of instances) {
    const edCode = inst.examForm.examEdition.editionCode;
    questionIds.push(inst.question.id);
    countsByEdition[edCode] = (countsByEdition[edCode] ?? 0) + 1;

    for (const qs of inst.question.subjects) {
      links.push({
        questionId: inst.question.id,
        editionCode: edCode,
        originalNumber: inst.originalNumber,
        subjectId: qs.subjectId,
        subjectSlug: qs.subject.slug,
        subjectName: qs.subject.name,
        parentId: qs.subject.parentId,
        parentSlug: qs.subject.parent?.slug ?? null,
        isPrimary: qs.isPrimary,
      });
      if (qs.isPrimary) {
        const rootSlug = qs.subject.parent?.slug ?? qs.subject.slug;
        countsByDisciplineSlug[rootSlug] = (countsByDisciplineSlug[rootSlug] ?? 0) + 1;
      }
    }
  }

  return { questionIds, links, countsByEdition, countsByDisciplineSlug };
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0];

  if (mode === "--snapshot") {
    const outFile =
      args[1] ??
      path.resolve(
        "C:/Users/yurib/.gemini/antigravity/brain/60106d52-50c2-4fb5-8897-6647544e2a45/scratch/oab-subjects-snapshot.json"
      );

    const { questionIds, links, countsByEdition, countsByDisciplineSlug } =
      await fetchCurrentOabLinks();

    const snapshot: OabTaxonomySnapshot = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      totalQuestions: questionIds.length,
      totalLinks: links.length,
      countsByEdition,
      countsByDisciplineSlug,
      links,
      checksumSha256: computeSnapshotChecksum(links),
    };

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2), "utf-8");

    console.info("=== SNAPSHOT OAB GERADO COM SUCESSO ===");
    console.info({
      path: outFile,
      totalQuestions: snapshot.totalQuestions,
      totalLinks: snapshot.totalLinks,
      editionsCount: Object.keys(countsByEdition).length,
      checksumSha256: snapshot.checksumSha256,
    });
    return;
  }

  if (mode === "--rollback") {
    const snapFile = args[1];
    const apply = args.includes("--apply");
    if (!snapFile || !fs.existsSync(snapFile)) {
      throw new Error("Informe um arquivo de snapshot válido para --rollback.");
    }

    const snapshot = JSON.parse(
      fs.readFileSync(snapFile, "utf-8")
    ) as OabTaxonomySnapshot;
    const expectedChecksum = computeSnapshotChecksum(snapshot.links);
    if (expectedChecksum !== snapshot.checksumSha256) {
      throw new Error("Integridade do snapshot comprometida (checksum SHA-256 divergente).");
    }

    const { links: currentLinks } = await fetchCurrentOabLinks();
    const plan = computeRollbackPlan(currentLinks, snapshot.links);

    console.info(`=== ROLLBACK OAB (${apply ? "APLICANDO" : "DRY-RUN"}) ===`);
    console.info({
      snapshotQuestions: snapshot.totalQuestions,
      snapshotLinks: snapshot.totalLinks,
      checksumVerified: true,
      toDelete: plan.toDelete.length,
      toInsert: plan.toInsert.length,
      toUpdatePrimary: plan.toUpdatePrimary.length,
    });

    if (apply && (plan.toDelete.length > 0 || plan.toInsert.length > 0 || plan.toUpdatePrimary.length > 0)) {
      await prisma.$transaction(async (tx) => {
        for (const d of plan.toDelete) {
          await tx.questionSubject.delete({
            where: {
              questionId_subjectId: {
                questionId: d.questionId,
                subjectId: d.subjectId,
              },
            },
          });
        }
        for (const ins of plan.toInsert) {
          await tx.questionSubject.create({
            data: {
              questionId: ins.questionId,
              subjectId: ins.subjectId,
              isPrimary: ins.isPrimary,
            },
          });
        }
        for (const upd of plan.toUpdatePrimary) {
          await tx.questionSubject.update({
            where: {
              questionId_subjectId: {
                questionId: upd.questionId,
                subjectId: upd.subjectId,
              },
            },
            data: { isPrimary: upd.isPrimary },
          });
        }
      });
      console.info("Rollback transacional aplicado com sucesso.");
    }
    return;
  }

  console.info("Uso: tsx scripts/maintenance/oab-subjects-snapshot-and-rollback.ts --snapshot [path] | --rollback <path> [--apply]");
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
