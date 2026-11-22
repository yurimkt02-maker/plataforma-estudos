import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

/**
 * AUDITORIA SOMENTE LEITURA (READ-ONLY) DE QUALIDADE DOS 120 ITENS DA PRF 2013.
 * Não remove nem altera nenhuma questão no banco de dados.
 */

async function main(): Promise<void> {
  const edition = await prisma.examEdition.findUnique({
    where: { editionCode: "PRF-2013-POLICIAL" },
    include: {
      sourceDocuments: true,
      importJobs: {
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: { originalNumber: "asc" } },
        },
      },
      examForms: {
        include: {
          questionInstances: {
            orderBy: { originalNumber: "asc" },
            include: {
              question: {
                include: {
                  options: { orderBy: { displayOrder: "asc" } },
                  subjects: { include: { subject: { include: { parent: true } } } },
                },
              },
              answerKeys: { orderBy: { revisionNumber: "desc" } },
            },
          },
        },
      },
    },
  });

  if (!edition) {
    throw new Error("Edição PRF-2013-POLICIAL não encontrada.");
  }

  const form = edition.examForms[0];
  const instances = form?.questionInstances ?? [];
  const job = edition.importJobs[0];

  const qIds = instances.map((i) => i.question.id);
  const humanReviewLogsCount = await prisma.contentReviewLog.count({
    where: { entityId: { in: qIds } },
  });
  let publishedCount = 0;
  let annulledCount = 0;
  let missingOptionsCount = 0;
  let missingDefinitiveKeyCount = 0;
  let missingVisualFileCount = 0;
  let itemsWithVisualLink = 0;

  const statementFindings: Array<{ num: number; issue: string; excerpt: string }> = [];
  const classificationFindings: Array<{
    num: number;
    currentSubject: string;
    currentParent: string;
    reason: string;
    proposedSubject: string;
    excerpt: string;
  }> = [];

  for (const inst of instances) {
    const q = inst.question;
    if (q.status === "PUBLISHED") publishedCount++;
    if (inst.isAnnulled) annulledCount++;

    if (q.options.length !== 2) missingOptionsCount++;
    const defKey = inst.answerKeys.find((k) => k.isDefinitive);
    if (!defKey) missingDefinitiveKeyCount++;

    // Verificar imagens referenciadas em supportText
    const imgMatches = [...(q.supportText ?? "").matchAll(/!\[[^\]]*\]\((\/images\/[^)]+)\)/g)];
    if (imgMatches.length > 0) {
      itemsWithVisualLink++;
      for (const m of imgMatches) {
        const rel = m[1]!.replace(/^\//, "");
        const fullPath = path.join(process.cwd(), "public", rel);
        if (!fs.existsSync(fullPath)) {
          missingVisualFileCount++;
          statementFindings.push({
            num: inst.originalNumber,
            issue: `Imagem ausente em disco: ${rel}`,
            excerpt: q.statement.slice(0, 90),
          });
        }
      }
    }

    // Verificar sinais de artefatos de extração / texto curto / ícones inline ausentes no texto
    if (q.statement.length < 35) {
      statementFindings.push({
        num: inst.originalNumber,
        issue: `Enunciado curto (${q.statement.length} chars) — conferir se completo com texto de apoio`,
        excerpt: q.statement,
      });
    }
    if (/\s{2,}/.test(q.statement) || /o botão\s*,|menu\s*\.|tecla\s+e\s+teclar|teclar\s*;/.test(q.statement)) {
      statementFindings.push({
        num: inst.originalNumber,
        issue: "Lacuna textual de ícone inline do PDF original (ícone visível na imagem recortada anexada em supportText)",
        excerpt: q.statement.slice(0, 120),
      });
    }
    if (/![\d(]/.test(q.statement) || /![\d(]/.test(q.supportText ?? "")) {
      statementFindings.push({
        num: inst.originalNumber,
        issue: "Possível artefato residual da fonte Symbol (! no lugar de sinal negativo)",
        excerpt: q.statement.slice(0, 120),
      });
    }

    // Auditar classificação temática dos itens 63..114 (Direito Penal, CPP, Legislação Especial, Direitos Humanos, CTB)
    const primaryLink = q.subjects.find((s) => s.isPrimary) ?? q.subjects[0];
    const currSlug = primaryLink?.subject.slug ?? "SEM_ASSUNTO";
    const currParent = primaryLink?.subject.parent?.slug ?? primaryLink?.subject.slug ?? "-";
    const fullLower = `${q.supportText ?? ""} ${q.statement}`.toLowerCase();

    // Checar se item classificado como crimes-de-transito realmente trata de trânsito/CTB ou se é Legislação Especial/Penal
    if (currSlug === "crimes-de-transito") {
      const mentionsTraffic = /\b(ctb|tr[aâ]nsito|ve[ií]culo|condutor|rodovia|cnh|habilita[cç][aã]o|contran|pedestre|dire[cç][aã]o\s+de\s+ve[ií]culo)\b/i.test(fullLower);
      const mentionsSpecialCrime = /\b(drogas|entorpecente|desarmamento|arma\s+de\s+fogo|abuso\s+de\s+autoridade|contraven[cç][aã]o|tortura|crime\s+hediondo|estatuto\s+do\s+desarmamento|lei\s+n?[º°]?\s*11\.343)\b/i.test(fullLower);
      if (mentionsSpecialCrime && !mentionsTraffic) {
        classificationFindings.push({
          num: inst.originalNumber,
          currentSubject: currSlug,
          currentParent: currParent,
          reason: 'Item de Legislação Penal Especial (Drogas/Armas/Abuso/Contravenções) caiu em "crimes-de-transito" por citar "pena/crime" com contexto amplo',
          proposedSubject: "teoria-do-crime-e-imputabilidade (ou novo filho legislacao-penal-especial-prf sob direito-penal)",
          excerpt: q.statement.slice(0, 110),
        });
      } else if (!mentionsTraffic) {
        classificationFindings.push({
          num: inst.originalNumber,
          currentSubject: currSlug,
          currentParent: currParent,
          reason: 'Classificado como "crimes-de-transito" sem menção a trânsito/CTB no texto',
          proposedSubject: "revisar disciplina (Direito Penal / Processo Penal)",
          excerpt: q.statement.slice(0, 110),
        });
      } else if (!/\b(crime|deten[cç][aã]o|reclus[aã]o|homic[ií]dio|les[aã]o\s+corporal|art\.\s*30[2-9]|embriaguez\s+ao\s+volante)\b/i.test(q.statement)) {
        // Menciona trânsito/CTB, mas é norma administrativa/infração, não crime de trânsito
        classificationFindings.push({
          num: inst.originalNumber,
          currentSubject: currSlug,
          currentParent: currParent,
          reason: 'Item administrativo/infracional do CTB classificado em "crimes-de-transito" por menção genérica a "pena/penalidade"',
          proposedSubject: "normas-gerais-de-circulacao-e-conduta",
          excerpt: q.statement.slice(0, 110),
        });
      }
    }
  }

  console.info("=== AUDITORIA DE QUALIDADE PRF 2013 (READ-ONLY) ===");
  console.info({
    editionCode: edition.editionCode,
    jobId: job?.id,
    jobStatus: job?.status,
    totalInstances: instances.length,
    publishedCount,
    annulledCount,
    humanReviewLogsCount,
    missingOptionsCount,
    missingDefinitiveKeyCount,
    itemsWithVisualLink,
    missingVisualFileCount,
    statementFindingsCount: statementFindings.length,
    classificationFindingsCount: classificationFindings.length,
  });

  if (statementFindings.length > 0) {
    console.info("\n--- ACHADOS DE ENUNCIADO / MÍDIA ---");
    for (const f of statementFindings) {
      console.info(`  #${f.num}: ${f.issue} | "${f.excerpt}"`);
    }
  }

  if (classificationFindings.length > 0) {
    console.info("\n--- ACHADOS DE CLASSIFICAÇÃO (PROPOSTA SEM MUTAÇÃO) ---");
    for (const f of classificationFindings) {
      console.info(`  #${f.num} [${f.currentSubject} -> ${f.proposedSubject}]: ${f.reason} | "${f.excerpt}"`);
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
