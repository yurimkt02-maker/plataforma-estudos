import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

const PORT = 3011;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function buildSamplePdfs(): { examPath: string; keyPath: string } {
  const dir = path.join(process.cwd(), "acervo", "_isolated_test_tmp");
  fs.mkdirSync(dir, { recursive: true });
  const examPath = path.join(dir, "sample_vunesp_exam.pdf");
  const keyPath = path.join(dir, "sample_vunesp_key.pdf");

  const pyCode = `
import pymupdf as fitz
doc = fitz.open()
p = doc.new_page()
p.insert_textbox(fitz.Rect(40, 40, 550, 780), """FUNDAÇÃO VUNESP — PROVA EXEMPLO ISOLADA
QUESTÃO 01 - Considerando o disposto na Lei nº 10.261/68, assinale a alternativa correta sobre revisão disciplinar.
(A) Depende sempre de advogado.
(B) Pode agravar a penalidade aplicada.
(C) Será conduzida pelo mesmo procurador.
(D) Caberá quando surgirem fatos novos ou vícios insanáveis de procedimento.
(E) Cabe por mera alegação de injustiça.

QUESTÃO 02 - Analise a tabela abaixo referente ao orçamento do exercício financeiro e assinale a alternativa correta.
(A) Alternativa A de exemplo completo.
(B) Alternativa B de exemplo completo.
(C) Alternativa C de exemplo completo.
(D) Alternativa D de exemplo completo.
(E) Alternativa E de exemplo completo.
""", fontsize=10)
doc.save(r"${examPath}")
doc.close()

kdoc = fitz.open()
kp = kdoc.new_page()
kp.insert_textbox(fitz.Rect(40, 40, 550, 780), """GABARITO DEFINITIVO EXEMPLO
VERSÃO 1
01 - D
02 - B
""", fontsize=11)
kdoc.save(r"${keyPath}")
kdoc.close()
`;
  execFileSync("python", ["-c", pyCode], { stdio: "inherit" });
  return { examPath, keyPath };
}

async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${url}/api/health`);
      if (r.ok) return;
    } catch {
      // waiting
    }
    await new Promise((res) => setTimeout(res, 600));
  }
  throw new Error("Servidor Next.js local não respondeu a tempo.");
}

async function main(): Promise<void> {
  const { examPath, keyPath } = buildSamplePdfs();

  const server = spawn("npx.cmd", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    stdio: "pipe",
    shell: true,
  });

  let createdJobId: string | null = null;
  let createdExamDocId: string | null = null;
  let createdKeyDocId: string | null = null;
  let examSha: string | null = null;
  let keySha: string | null = null;

  try {
    await waitForServer(BASE_URL);
    console.info("[1/8] Servidor Next.js isolado iniciado em", BASE_URL);

    // Login como admin
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.OWNER_EMAIL || "yurimkt02@gmail.com",
        password: process.env.OWNER_PASSWORD || "",
      }),
    });
    if (!loginRes.ok) throw new Error(`Login falhou: ${loginRes.status}`);
    const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] ?? "";

    // Buscar edição TJSP Capital (vazia, ideal para teste isolado sem tocar em questões publicadas)
    const edition = await prisma.examEdition.findUnique({
      where: { editionCode: "TJSP-2024-ESCREVENTE-CAPITAL" },
      include: { examForms: true },
    });
    if (!edition || !edition.examForms[0]) {
      throw new Error("Edição TJSP-2024-ESCREVENTE-CAPITAL não encontrada.");
    }

    // Upload multipart/form-data
    const fd = new FormData();
    fd.append("examEditionId", edition.id);
    fd.append("examFormId", edition.examForms[0].id);
    fd.append("questionType", "MULTIPLE_CHOICE");
    fd.append(
      "examPdf",
      new Blob([fs.readFileSync(examPath)], { type: "application/pdf" }),
      "sample_vunesp_exam.pdf"
    );
    fd.append(
      "answerKeyPdf",
      new Blob([fs.readFileSync(keyPath)], { type: "application/pdf" }),
      "sample_vunesp_key.pdf"
    );

    const uploadRes = await fetch(`${BASE_URL}/api/admin/imports/upload`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: fd,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(`Upload falhou (${uploadRes.status}): ${JSON.stringify(uploadData)}`);
    }

    createdJobId = uploadData.job.id;
    createdExamDocId = uploadData.job.examPdfDocument.id;
    createdKeyDocId = uploadData.job.answerKeyDocument.id;
    examSha = uploadData.job.examPdfDocument.sha256;
    keySha = uploadData.job.answerKeyDocument.sha256;

    console.info(
      `[2/8] Upload privado OK: job=${createdJobId}, detected=${uploadData.job.totalDetected}, validated=${uploadData.job.totalValidated} (deve ser 0), docStatus=${uploadData.job.examPdfDocument.verificationStatus} (deve ser PENDING)`
    );
    if (uploadData.job.totalValidated !== 0) {
      throw new Error("ERRO: totalValidated deveria iniciar em 0 antes da revisão humana!");
    }
    if (uploadData.job.examPdfDocument.verificationStatus !== "PENDING") {
      throw new Error("ERRO: SourceDocument não deveria nascer VERIFIED no upload!");
    }

    // Verificar privacidade do PDF (401 sem cookie, 200 %PDF com cookie admin)
    const anonPdfRes = await fetch(`${BASE_URL}/api/admin/documents/${createdExamDocId}/file`);
    if (anonPdfRes.status !== 401) {
      throw new Error(`ERRO: PDF privado retornou ${anonPdfRes.status} sem autenticação (esperado 401)!`);
    }
    const authPdfRes = await fetch(`${BASE_URL}/api/admin/documents/${createdExamDocId}/file`, {
      headers: { Cookie: cookie },
    });
    const pdfBytes = Buffer.from(await authPdfRes.arrayBuffer());
    if (!authPdfRes.ok || pdfBytes.subarray(0, 4).toString("ascii") !== "%PDF") {
      throw new Error("ERRO: PDF privado autenticado não retornou binário %PDF válido!");
    }
    console.info(`[3/8] Armazenamento privado validado: anônimo=401, admin=200 (%PDF, ${pdfBytes.length} bytes)`);

    // Tentar publicar ANTES de confirmar documentos -> deve retornar 422 DOCUMENTS_NOT_VERIFIED
    const pubBeforeDocs = await fetch(`${BASE_URL}/api/admin/imports/${createdJobId}/approve`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const pubBeforeDocsBody = await pubBeforeDocs.json();
    if (pubBeforeDocs.status !== 422 || pubBeforeDocsBody.error !== "DOCUMENTS_NOT_VERIFIED") {
      throw new Error(`Esperado 422 DOCUMENTS_NOT_VERIFIED, recebido ${pubBeforeDocs.status}`);
    }
    console.info("[4/8] Bloqueio de publicação antes da conferência documental validado (422 DOCUMENTS_NOT_VERIFIED)");

    // Confirmar documentos e gabarito
    const verifyDocsRes = await fetch(
      `${BASE_URL}/api/admin/imports/${createdJobId}/verify-documents`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          confirmedEditionAndDate: true,
          confirmedBookletVersion: true,
          confirmedAnswerKeyMap: true,
        }),
      }
    );
    if (!verifyDocsRes.ok) throw new Error("Falha ao verificar documentos");
    console.info("[5/8] Conferência independente de documentos e gabarito registrada com sucesso");

    // Tentar publicar ANTES de aprovar itens individualmente -> deve retornar 422 NO_VERIFIED_ITEMS
    const pubBeforeItems = await fetch(`${BASE_URL}/api/admin/imports/${createdJobId}/approve`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const pubBeforeItemsBody = await pubBeforeItems.json();
    if (pubBeforeItems.status !== 422 || pubBeforeItemsBody.error !== "NO_VERIFIED_ITEMS") {
      throw new Error(`Esperado 422 NO_VERIFIED_ITEMS, recebido ${pubBeforeItems.status}`);
    }
    console.info("[6/8] Bloqueio de publicação sem revisão humana individual validado (422 NO_VERIFIED_ITEMS)");

    // Tentar aprovar Q2 (CLASSIFICATION_PENDING + tabela abaixo) -> deve bloquear com 422 APPROVAL_BLOCKED
    const item1 = uploadData.job.items.find((i: { originalNumber: number }) => i.originalNumber === 1);
    const item2 = uploadData.job.items.find((i: { originalNumber: number }) => i.originalNumber === 2);

    const approveQ2Res = await fetch(
      `${BASE_URL}/api/admin/imports/${createdJobId}/items/${item2.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ action: "APPROVE" }),
      }
    );
    if (approveQ2Res.status !== 422) {
      throw new Error(`Esperado bloqueio 422 na Q2 (CLASSIFICATION_PENDING + tabela), recebido ${approveQ2Res.status}`);
    }
    console.info("[7/8] Bloqueio individual da Q2 (CLASSIFICATION_PENDING + tabela pendente) validado (422)");

    // Aprovar Q1 após marcar answerKeyVerified=true e rejeitar Q2
    const approveQ1Res = await fetch(
      `${BASE_URL}/api/admin/imports/${createdJobId}/items/${item1.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ action: "APPROVE", answerKeyVerified: true }),
      }
    );
    if (!approveQ1Res.ok) {
      throw new Error(`Falha ao aprovar Q1: ${await approveQ1Res.text()}`);
    }

    const rejectQ2Res = await fetch(
      `${BASE_URL}/api/admin/imports/${createdJobId}/items/${item2.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ action: "REJECT", reviewNotes: "Tabela ausente no exemplo" }),
      }
    );
    if (!rejectQ2Res.ok) throw new Error("Falha ao rejeitar Q2");
    console.info("[8/8] Curadoria individual validada: Q1=VERIFIED, Q2=REJECTED (sem publicar no acervo real)");
  } finally {
    server.kill();

    // Limpeza cirúrgica dos registros do teste isolado (zero impacto no acervo real!)
    if (createdJobId) {
      await prisma.contentReviewLog.deleteMany({
        where: { entityId: createdJobId },
      });
      await prisma.importJob.deleteMany({ where: { id: createdJobId } });
    }
    if (createdExamDocId || createdKeyDocId) {
      await prisma.sourceDocument.deleteMany({
        where: {
          id: { in: [createdExamDocId, createdKeyDocId].filter(Boolean) as string[] },
        },
      });
    }
    if (examSha || keySha) {
      await prisma.storedDocumentFile.deleteMany({
        where: { sha256: { in: [examSha, keySha].filter(Boolean) as string[] } },
      });
    }
    fs.rmSync(path.join(process.cwd(), "acervo", "_isolated_test_tmp"), {
      recursive: true,
      force: true,
    });
    await prisma.$disconnect();
    console.info("[CLEANUP] Dados temporários do teste isolado removidos. Acervo real intacto.");
  }
}

main().catch((err) => {
  console.error("[ERRO TESTE ISOLADO]", err);
  process.exit(1);
});
