import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { chromium } from "@playwright/test";

const PROD_URL = "https://plataforma-estudos-virid.vercel.app";

async function main(): Promise<void> {
  const email = process.env.OWNER_EMAIL || "yurimkt02@gmail.com";
  const password = process.env.OWNER_PASSWORD || "";
  if (!password) throw new Error("OWNER_PASSWORD ausente no .env.local");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results: Array<{ step: string; status: string; detail: string }> = [];

  try {
    // 1. Health check em produção
    const healthRes = await context.request.get(`${PROD_URL}/api/health`);
    const healthBody = await healthRes.json();
    results.push({
      step: "1. Health API (/api/health)",
      status: healthRes.status() === 200 ? "PASS" : "FAIL",
      detail: JSON.stringify(healthBody),
    });

    // 2. Proteção anônima (redirecionamento para /login) + Login real em produção
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });
    const redirectedToLogin = page.url().includes("/login");
    await page.getByLabel(/E-mail do proprietário/i).fill(email);
    await page.getByLabel(/Senha de acesso/i).fill(password);
    await page.getByRole("button", { name: /Entrar na plataforma/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 25000 });
    results.push({
      step: "2. Proteção privada e Login em Produção",
      status: redirectedToLogin && page.url().includes("/dashboard") ? "PASS" : "FAIL",
      detail: `Redirected=${redirectedToLogin}, URL=${page.url()}`,
    });

    // 3. Resolução de questão oficial + Gabarito oficial (OAB 41º Exame)
    await page.goto(`${PROD_URL}/questoes?trackCode=OAB`, { waitUntil: "networkidle" });
    const countText = await page.getByText(/questão\(ões\) oficial\(is\) encontrada\(s\)/i).textContent();
    await page.getByRole("link", { name: /Foco Individual/i }).first().click();
    await page.waitForURL(/\/questoes\/[0-9a-f-]+/, { timeout: 20000 });
    await page.getByRole("radio").nth(1).click();
    await page.getByRole("button", { name: /Responder questão/i }).click();
    await page.getByText(/Gabarito Oficial Definitivo da Banca:/i).waitFor({ timeout: 20000 });
    const keyText = await page.getByText(/Gabarito Oficial Definitivo da Banca:/i).textContent();
    results.push({
      step: "3. Resolução de Questão e Gabarito Oficial (OAB 41)",
      status: "PASS",
      detail: `${countText?.trim()} | ${keyText?.trim()}`,
    });

    // 4. Conferência de item visual PRF 2019 (#24 com figura oficial carregada em produção)
    await page.goto(`${PROD_URL}/questoes?trackCode=PRF&query=vista%20frontal`, {
      waitUntil: "networkidle",
    });
    const imgCount = await page.locator("figure img").count();
    results.push({
      step: "4. Figuras Oficiais PRF 2019 (#24-#26) em Produção",
      status: imgCount >= 2 ? "PASS" : "WARN",
      detail: `${imgCount} figura(s) oficial(is) renderizada(s) em /questoes`,
    });

    // 5. Simulado completo em produção (PRF Certo/Errado) + Persistência
    await page.goto(`${PROD_URL}/simulados?track=PRF`, { waitUntil: "networkidle" });
    await page.getByLabel(/Quantidade de Questões/i).fill("5");
    await page.getByRole("button", { name: /Iniciar Simulado/i }).click();
    await page.waitForURL(/\/simulados\/[0-9a-f-]+/, { timeout: 25000 });
    await page.getByRole("button", { name: /Encerrar Prova/i }).click();
    await page.getByRole("button", { name: /Confirmar e corrigir/i }).click();
    await page.waitForURL(/\/simulados\/[0-9a-f-]+\/resultado/, { timeout: 25000 });
    const simResultUrl = page.url();
    await page.reload({ waitUntil: "networkidle" });
    const persistedScoreVisible = await page.getByText(/Pontuação Líquida Oficial/i).isVisible();
    results.push({
      step: "5. Simulado e Persistência após Reload (PRF)",
      status: persistedScoreVisible ? "PASS" : "FAIL",
      detail: `URL=${simResultUrl}, Persistência pós-reload=${persistedScoreVisible}`,
    });

    // 6. Estatísticas em produção
    await page.goto(`${PROD_URL}/estatisticas?track=OAB`, { waitUntil: "networkidle" });
    const statsOk = await page.getByText(/Questões Únicas vs\. Tentativas/i).isVisible();
    results.push({
      step: "6. Estatísticas de Desempenho (/estatisticas)",
      status: statsOk ? "PASS" : "FAIL",
      detail: `Indicadores reais visíveis=${statsOk}`,
    });

    // 7. Painel Administrativo /admin/acervo e /admin/importacoes
    await page.goto(`${PROD_URL}/admin/acervo`, { waitUntil: "networkidle" });
    const acervoHeading = await page
      .getByRole("heading", { name: /Painel Administrativo de Qualidade do Acervo/i })
      .isVisible();
    const prf19Visible = await page.getByText(/PRF-2019-POLICIAL/i).first().isVisible();
    const oab41Visible = await page.getByText(/OAB-41-1FASE/i).first().isVisible();

    await page.goto(`${PROD_URL}/admin/importacoes`, { waitUntil: "networkidle" });
    const uploadFormVisible = await page
      .getByRole("button", { name: /Enviar PDFs e Gerar Prévia/i })
      .isVisible();
    const examFileInputVisible = await page.locator("#examPdf").isVisible();
    const keyFileInputVisible = await page.locator("#answerKeyPdf").isVisible();

    results.push({
      step: "7. Painel Administrativo (/admin/acervo e /admin/importacoes)",
      status:
        acervoHeading && prf19Visible && oab41Visible && uploadFormVisible && examFileInputVisible && keyFileInputVisible
          ? "PASS"
          : "FAIL",
      detail: `acervo=${acervoHeading}, PRF19=${prf19Visible}, OAB41=${oab41Visible}, uploadUI=${uploadFormVisible}`,
    });

    console.info("\n=== RESULTADO DO TESTE E2E EM PRODUÇÃO (VERCEL + PRISMA POSTGRES) ===");
    for (const r of results) {
      console.info(`[${r.status}] ${r.step} -> ${r.detail}`);
    }

    const anyFail = results.some((r) => r.status === "FAIL");
    if (anyFail) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[ERRO E2E PRODUÇÃO]", err);
  process.exit(1);
});
