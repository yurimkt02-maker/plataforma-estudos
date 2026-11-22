import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { chromium } from "@playwright/test";
import { prisma } from "../../src/lib/db/prisma";

const PROD_URL = "https://plataforma-estudos-virid.vercel.app";
const PRF_2013_PNGS = [
  "prf2013-q18-q22-grafico-acidentes.png",
  "prf2013-q23-q25-grafico-alcool.png",
  "prf2013-q46-q47-broffice-writer.png",
  "prf2013-q48-broffice-calc.png",
  "prf2013-q49-q50-google-chrome.png",
  "prf2013-q117-pendulo-balistico.png",
  "prf2013-q118-q119-equacao-mhs.png",
];

async function getAuthenticatedCookie(): Promise<string> {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error("OWNER_EMAIL ou OWNER_PASSWORD ausentes em .env.local");
  }
  const resp = await fetch(`${PROD_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    throw new Error(`Falha ao autenticar em produção: HTTP ${resp.status}`);
  }
  const setCookie = resp.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Cookie de sessão não retornado pelo /api/auth/login.");
  }
  return setCookie.split(";")[0]!;
}

async function verifyAll7PngsAuthenticated(): Promise<void> {
  const cookie = await getAuthenticatedCookie();
  console.info("=== ETAPA 1: VERIFICAÇÃO AUTENTICADA DOS 7 PNGs NA PRODUÇÃO ===");
  let allOk = true;
  for (const fname of PRF_2013_PNGS) {
    const url = `${PROD_URL}/images/questions/prf-2013/${fname}`;
    const res = await fetch(url, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    const ct = res.headers.get("content-type") ?? "";
    const buf = await res.arrayBuffer();
    const ok = res.status === 200 && ct.includes("image/png") && buf.byteLength > 1000;
    if (!ok) allOk = false;
    console.info(`  ${ok ? "✅" : "❌"} ${fname} -> HTTP ${res.status} | ${ct} | ${buf.byteLength} bytes`);
  }
  if (!allOk) {
    throw new Error("BLOQUEIO ETAPA 1: Nem todos os 7 PNGs responderam 200 image/png na produção!");
  }
}

async function verifyPostMigrationAndVisualProd(): Promise<void> {
  await verifyAll7PngsAuthenticated();

  // 1. Auditar banco pós-migração
  const [totalPublished, prf2013Instances, prf2013AssetsCount] = await Promise.all([
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.examQuestionInstance.findMany({
      where: { examForm: { examEdition: { editionCode: "PRF-2013-POLICIAL" } } },
      include: {
        question: {
          include: {
            assets: { orderBy: { position: "asc" } },
            subjects: { include: { subject: { include: { parent: true } } } },
          },
        },
        answerKeys: { orderBy: { revisionNumber: "desc" } },
      },
      orderBy: { originalNumber: "asc" },
    }),
    prisma.questionAsset.count({
      where: {
        objectUrl: { startsWith: "/images/questions/prf-2013/" },
      },
    }),
  ]);

  const residualMarkdown = prf2013Instances.filter((i) =>
    (i.question.supportText ?? "").includes("![")
  ).length;
  const annulled = prf2013Instances.filter((i) => i.isAnnulled).map((i) => i.originalNumber);
  const q18 = prf2013Instances.find((i) => i.originalNumber === 18);
  const q117 = prf2013Instances.find((i) => i.originalNumber === 117);

  const countsAfter: Record<string, number> = {};
  for (const inst of prf2013Instances) {
    const p = inst.question.subjects.find((s) => s.isPrimary)?.subject;
    if (p) countsAfter[p.slug] = (countsAfter[p.slug] ?? 0) + 1;
  }

  console.info("\n=== ETAPA 4: AUDITORIA DO BANCO PÓS-MIGRAÇÃO ===");
  console.info({
    totalPublishedInDb: totalPublished,
    prf2013Total: prf2013Instances.length,
    prf2013AssetsCount,
    residualMarkdownInSupportText: residualMarkdown,
    annulledNumbers: annulled,
    countsByPrimarySubjectAfter: countsAfter,
  });

  if (totalPublished !== 1240) throw new Error(`Esperado 1240 publicadas, obtido ${totalPublished}`);
  if (prf2013AssetsCount !== 16) throw new Error(`Esperado 16 QuestionAssets, obtido ${prf2013AssetsCount}`);
  if (residualMarkdown !== 0) throw new Error(`Ainda há ${residualMarkdown} itens com Markdown residual!`);

  // 2. Confirmar visualmente renderização de <img> em produção (desktop + mobile) via Playwright
  if (!q18 || !q117) throw new Error("Questões #18 ou #117 não encontradas.");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', process.env.OWNER_EMAIL!);
    await page.fill('input[type="password"]', process.env.OWNER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 20000 });

    // Abrir Q18 (gráfico de acidentes) em desktop
    await page.goto(`${PROD_URL}/questoes/${q18.question.id}`, { waitUntil: "networkidle" });
    const q18ImgCheck = await page.evaluate(() => {
      const img = document.querySelector('img[src*="/images/questions/prf-2013/"]') as HTMLImageElement | null;
      return img
        ? { src: img.getAttribute("src"), complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }
        : null;
    });
    await page.screenshot({
      path: "C:\\Users\\yurib\\.gemini\\antigravity\\brain\\60106d52-50c2-4fb5-8897-6647544e2a45\\prod-prf2013-q18-desktop.png",
      fullPage: false,
    });

    // Abrir Q117 (pêndulo balístico) em mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${PROD_URL}/questoes/${q117.question.id}`, { waitUntil: "networkidle" });
    const q117ImgCheck = await page.evaluate(() => {
      const img = document.querySelector('img[src*="/images/questions/prf-2013/"]') as HTMLImageElement | null;
      return img
        ? { src: img.getAttribute("src"), complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }
        : null;
    });
    await page.screenshot({
      path: "C:\\Users\\yurib\\.gemini\\antigravity\\brain\\60106d52-50c2-4fb5-8897-6647544e2a45\\prod-prf2013-q117-mobile.png",
      fullPage: false,
    });

    console.info("\n=== CONFIRMAÇÃO VISUAL EM PRODUÇÃO (PLAYWRIGHT) ===");
    console.info({ q18Desktop: q18ImgCheck, q117Mobile: q117ImgCheck });

    if (!q18ImgCheck?.complete || !q18ImgCheck.naturalWidth) {
      throw new Error("Imagem Q18 não carregou corretamente no DOM em produção!");
    }
    if (!q117ImgCheck?.complete || !q117ImgCheck.naturalWidth) {
      throw new Error("Imagem Q117 não carregou corretamente no DOM mobile em produção!");
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--post-migration")) {
    await verifyPostMigrationAndVisualProd();
  } else {
    await verifyAll7PngsAuthenticated();
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
