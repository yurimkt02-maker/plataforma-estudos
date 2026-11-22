import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

export interface Prf2013ItemSnapshot {
  questionId: string;
  originalNumber: number;
  status: string;
  supportText: string | null;
  assets: Array<{
    id: string;
    assetType: string;
    storagePath: string;
    objectUrl: string | null;
    caption: string | null;
    position: number;
  }>;
  subjects: Array<{
    subjectId: string;
    subjectSlug: string;
    subjectName: string;
    parentId: string | null;
    isPrimary: boolean;
  }>;
}

export interface Prf2013Snapshot {
  schemaVersion: 1;
  editionCode: "PRF-2013-POLICIAL";
  createdAt: string;
  totalItems: number;
  countsByPrimarySubject: Record<string, number>;
  items: Prf2013ItemSnapshot[];
  checksumSha256: string;
}

export function computePrfSnapshotChecksum(items: Prf2013ItemSnapshot[]): string {
  const canonical = JSON.stringify(
    [...items].sort((a, b) => a.originalNumber - b.originalNumber)
  );
  return crypto.createHash("sha256").update(canonical, "utf-8").digest("hex");
}

async function fetchCurrentPrf2013State(): Promise<{
  items: Prf2013ItemSnapshot[];
  countsByPrimarySubject: Record<string, number>;
}> {
  const instances = await prisma.examQuestionInstance.findMany({
    where: {
      examForm: { examEdition: { editionCode: "PRF-2013-POLICIAL" } },
    },
    include: {
      question: {
        include: {
          assets: { orderBy: { position: "asc" } },
          subjects: {
            include: { subject: true },
            orderBy: { isPrimary: "desc" },
          },
        },
      },
    },
    orderBy: { originalNumber: "asc" },
  });

  const countsByPrimarySubject: Record<string, number> = {};
  const items: Prf2013ItemSnapshot[] = instances.map((inst) => {
    const primary = inst.question.subjects.find((s) => s.isPrimary) ?? inst.question.subjects[0];
    if (primary) {
      countsByPrimarySubject[primary.subject.slug] =
        (countsByPrimarySubject[primary.subject.slug] ?? 0) + 1;
    }
    return {
      questionId: inst.question.id,
      originalNumber: inst.originalNumber,
      status: inst.question.status,
      supportText: inst.question.supportText,
      assets: inst.question.assets.map((a) => ({
        id: a.id,
        assetType: a.assetType,
        storagePath: a.storagePath,
        objectUrl: a.objectUrl,
        caption: a.caption,
        position: a.position,
      })),
      subjects: inst.question.subjects.map((s) => ({
        subjectId: s.subjectId,
        subjectSlug: s.subject.slug,
        subjectName: s.subject.name,
        parentId: s.subject.parentId,
        isPrimary: s.isPrimary,
      })),
    };
  });

  return { items, countsByPrimarySubject };
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0];

  if (mode === "--snapshot") {
    const outFile =
      args[1] ??
      "C:\\Users\\yurib\\OneDrive\\Desktop\\plataforma-estudos-backups-privados\\prf-2013-snapshot-2026-11-22.json";
    const { items, countsByPrimarySubject } = await fetchCurrentPrf2013State();
    const snapshot: Prf2013Snapshot = {
      schemaVersion: 1,
      editionCode: "PRF-2013-POLICIAL",
      createdAt: new Date().toISOString(),
      totalItems: items.length,
      countsByPrimarySubject,
      items,
      checksumSha256: computePrfSnapshotChecksum(items),
    };
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2), "utf-8");
    console.info("=== SNAPSHOT PRIVADO PRF 2013 GERADO ===");
    console.info({
      path: outFile,
      totalItems: snapshot.totalItems,
      checksumSha256: snapshot.checksumSha256,
      countsByPrimarySubject,
    });
    return;
  }

  if (mode === "--rollback") {
    const snapFile = args[1];
    const apply = args.includes("--apply");
    if (!snapFile || !fs.existsSync(snapFile)) {
      throw new Error("Informe um arquivo de snapshot PRF 2013 válido.");
    }
    const snapshot = JSON.parse(fs.readFileSync(snapFile, "utf-8")) as Prf2013Snapshot;
    const expected = computePrfSnapshotChecksum(snapshot.items);
    if (expected !== snapshot.checksumSha256) {
      throw new Error("Checksum SHA-256 do snapshot PRF 2013 inválido!");
    }

    const { items: currentItems } = await fetchCurrentPrf2013State();
    const currById = new Map(currentItems.map((i) => [i.questionId, i]));

    let supportDiffs = 0;
    let assetDiffs = 0;
    let subjectDiffs = 0;

    for (const snap of snapshot.items) {
      const curr = currById.get(snap.questionId);
      if (!curr) continue;
      if (curr.supportText !== snap.supportText) supportDiffs++;
      if (JSON.stringify(curr.assets.map((a) => a.objectUrl)) !== JSON.stringify(snap.assets.map((a) => a.objectUrl))) {
        assetDiffs++;
      }
      const currSubs = curr.subjects.map((s) => `${s.subjectId}:${s.isPrimary}`).sort().join("|");
      const snapSubs = snap.subjects.map((s) => `${s.subjectId}:${s.isPrimary}`).sort().join("|");
      if (currSubs !== snapSubs) subjectDiffs++;
    }

    console.info(`=== ROLLBACK PRF 2013 (${apply ? "APLICANDO" : "DRY-RUN"}) ===`);
    console.info({
      totalItems: snapshot.totalItems,
      checksumVerified: true,
      supportDiffs,
      assetDiffs,
      subjectDiffs,
    });

    if (apply && (supportDiffs > 0 || assetDiffs > 0 || subjectDiffs > 0)) {
      await prisma.$transaction(
        async (tx) => {
          for (const snap of snapshot.items) {
            await tx.question.update({
              where: { id: snap.questionId },
              data: { supportText: snap.supportText },
            });
            await tx.questionAsset.deleteMany({ where: { questionId: snap.questionId } });
            if (snap.assets.length > 0) {
              await tx.questionAsset.createMany({
                data: snap.assets.map((a) => ({
                  questionId: snap.questionId,
                  assetType: a.assetType,
                  storagePath: a.storagePath,
                  objectUrl: a.objectUrl,
                  caption: a.caption,
                  position: a.position,
                })),
              });
            }
            await tx.questionSubject.deleteMany({ where: { questionId: snap.questionId } });
            if (snap.subjects.length > 0) {
              await tx.questionSubject.createMany({
                data: snap.subjects.map((s) => ({
                  questionId: snap.questionId,
                  subjectId: s.subjectId,
                  isPrimary: s.isPrimary,
                })),
              });
            }
          }
        },
        { timeout: 30000 }
      );
      console.info("Rollback transacional PRF 2013 aplicado com sucesso.");
    }
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
