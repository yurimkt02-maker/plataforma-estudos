import path from "node:path";
import dotenv from "dotenv";
import { test, expect } from "@playwright/test";

dotenv.config({ path: [".env.local", ".env"] });

const ARTIFACT_DIR =
  "C:/Users/yurib/.gemini/antigravity/brain/60106d52-50c2-4fb5-8897-6647544e2a45";

test.describe.serial("Auditoria Funcional E2E, Estudo Real TJSP 2024, Explicações Jurídicas e Revisão Visual", () => {
  test.setTimeout(180_000);

  test("1. Proteção de rotas privadas, bloqueio anônimo de APIs (401) e revogação segura de sessão", async ({
    page,
    request,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    const anonQuestions = await request.get("/api/questions");
    expect(anonQuestions.status()).toBe(401);

    const anonStats = await request.get("/api/stats");
    expect(anonStats.status()).toBe(401);

    const anonImports = await request.get("/api/admin/imports");
    expect(anonImports.status()).toBe(401);

    const ownerEmail = process.env.OWNER_EMAIL || "yurimkt02@gmail.com";
    const ownerPassword = process.env.OWNER_PASSWORD || "";
    expect(ownerPassword.length).toBeGreaterThanOrEqual(8);

    // Login via API e captura do cookie JWT para testar revogação serverless
    const loginRes = await request.post("/api/auth/login", {
      data: { email: ownerEmail, password: ownerPassword },
    });
    expect(loginRes.status()).toBe(200);

    const setCookieHeader = loginRes.headers()["set-cookie"] || "";
    const tokenMatch = setCookieHeader.match(/pe_session_v1=([^;]+)/);
    expect(tokenMatch).toBeTruthy();
    const rawToken = tokenMatch![1]!;

    // Antes do logout, o token é aceito
    const authStatsBefore = await request.get("/api/stats", {
      headers: { Cookie: `pe_session_v1=${rawToken}` },
    });
    expect(authStatsBefore.status()).toBe(200);

    // Executa logout que registra SESSION_REVOKED no Prisma Postgres
    const logoutRes = await request.post("/api/auth/logout", {
      headers: { Cookie: `pe_session_v1=${rawToken}` },
    });
    expect(logoutRes.status()).toBe(200);

    // Tenta reutilizar o mesmo token JWT após o logout -> deve ser rejeitado com 401 SESSION_REVOKED
    const replayAfterLogout = await request.get("/api/stats", {
      headers: { Cookie: `pe_session_v1=${rawToken}` },
    });
    expect(replayAfterLogout.status()).toBe(401);
    const replayBody = await replayAfterLogout.json();
    expect(replayBody.error).toBe("SESSION_REVOKED");
  });

  test("2. Fluxo completo de estudo real (OAB 41º Exame + PRF 2021/2019), gabarito oficial, simulados, anuladas e painel de qualidade /admin/acervo", async ({
    page,
  }) => {
    const ownerEmail = process.env.OWNER_EMAIL || "yurimkt02@gmail.com";
    const ownerPassword = process.env.OWNER_PASSWORD || "";

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "01-login-privado.png"),
      fullPage: true,
    });

    await page.getByLabel(/E-mail do proprietário/i).fill(ownerEmail);
    await page.getByLabel(/Senha de acesso/i).fill(ownerPassword);
    await page.getByRole("button", { name: /Entrar na plataforma/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Seu próximo avanço começa aqui/i })
    ).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "02-dashboard-tjsp-desktop.png"),
      fullPage: true,
    });

    // 1. Navegar para o Banco de Questões filtrando por OAB (80 questões oficiais FGV 41º Exame)
    await page.goto("/questoes?trackCode=OAB&includeAnnulled=true");
    await expect(
      page.getByText(/questão\(ões\) oficial\(is\) encontrada\(s\)/i)
    ).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "03-banco-questoes-tjsp-desktop.png"),
      fullPage: true,
    });

    const firstCard = page.locator("article").first();
    await expect(firstCard).toBeVisible();

    const focusLinks = page.getByRole("link", { name: /Foco Individual/i });
    expect(await focusLinks.count()).toBeGreaterThan(0);

    await focusLinks.first().click();
    await expect(page).toHaveURL(/\/questoes\/[0-9a-f-]+/);

    // Responder questão oficial OAB 41º Exame e verificar gabarito oficial FGV + explicação pendente de verificação
    const radioButtons = page.getByRole("radio");
    await radioButtons.nth(1).click();
    await page.getByRole("button", { name: /Responder questão/i }).click();

    await expect(
      page.getByText(/Gabarito Oficial Definitivo da Banca:/i)
    ).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("button", { name: /Gabarito comentado completo/i })
      .click();
    await expect(
      page.getByText(/Entendimento na Data da Prova/i)
    ).toBeVisible({ timeout: 20_000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "04-questao-resolvida-gabarito-comentado.png"),
      fullPage: true,
    });

    // 2. Testar filtro de questões anuladas oficiais na PRF (Cebraspe)
    await page.goto("/questoes?trackCode=PRF&includeAnnulled=true");
    await expect(
      page.getByText(/questão\(ões\) oficial\(is\) encontrada\(s\)/i)
    ).toBeVisible();

    // Verificar Cadernos, Revisões e Estatísticas
    await page.goto("/cadernos?track=OAB");
    await expect(
      page.getByRole("heading", { name: /Caderno Automático de Erros/i }).first()
    ).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "05-cadernos-de-estudo.png"),
      fullPage: true,
    });

    await page.goto("/revisoes?track=OAB");
    await expect(
      page.getByRole("heading", { name: /Fila de Revisão Espaçada/i })
    ).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "06-revisoes-espacadas.png"),
      fullPage: true,
    });

    await page.goto("/estatisticas?track=OAB");
    await expect(
      page.getByText(/Questões Únicas vs\. Tentativas/i)
    ).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "07-estatisticas-desempenho.png"),
      fullPage: true,
    });

    // 3. Criar e finalizar um Simulado Real OAB 41º Exame (FGV — Múltipla Escolha A-D)
    await page.goto("/simulados?track=OAB");
    await page.getByLabel(/Quantidade de Questões/i).fill("5");
    await page.getByRole("button", { name: /Iniciar Simulado/i }).click();

    await expect(page).toHaveURL(/\/simulados\/[0-9a-f-]+/, {
      timeout: 25_000,
    });
    await expect(page.getByText(/Cartão de Respostas/i)).toBeVisible();

    await page.getByRole("button", { name: /Encerrar Prova/i }).click();
    await page.getByRole("button", { name: /Confirmar e corrigir/i }).click();

    await expect(page).toHaveURL(/\/simulados\/[0-9a-f-]+\/resultado/, {
      timeout: 25_000,
    });
    await expect(
      page.getByText(/Pontuação Líquida Oficial/i)
    ).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "08-simulado-resultado.png"),
      fullPage: true,
    });

    // 4. Verificar Painel Administrativo de Qualidade do Acervo (/admin/acervo)
    await page.goto("/admin/acervo");
    await expect(
      page.getByRole("heading", {
        name: /Painel Administrativo de Qualidade do Acervo/i,
      })
    ).toBeVisible();
    await expect(page.getByText(/PRF-2021-POLICIAL/i).first()).toBeVisible();
    await expect(page.getByText(/PRF-2019-POLICIAL/i).first()).toBeVisible();
    await expect(page.getByText(/OAB-41-1FASE/i).first()).toBeVisible();
    await expect(page.getByText(/COMPLETA/i).first()).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "12-admin-painel-acervo.png"),
      fullPage: true,
    });

    // 5. Testar Simulado Real PRF (Cebraspe Certo/Errado com pontuação negativa)
    await page.goto("/simulados?track=PRF");
    await page.getByLabel(/Quantidade de Questões/i).fill("5");
    await page.getByRole("button", { name: /Iniciar Simulado/i }).click();
    await expect(page).toHaveURL(/\/simulados\/[0-9a-f-]+/, {
      timeout: 25_000,
    });
    await page.getByRole("button", { name: /Encerrar Prova/i }).click();
    await page.getByRole("button", { name: /Confirmar e corrigir/i }).click();
    await expect(page).toHaveURL(/\/simulados\/[0-9a-f-]+\/resultado/, {
      timeout: 25_000,
    });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "13-simulado-prf-cebraspe-resultado.png"),
      fullPage: true,
    });

    // Verificar Painel Administrativo de Importações e Curadoria
    await page.goto("/admin/importacoes");
    await expect(
      page.getByRole("heading", {
        name: /Pipeline de Importação de Provas Reais/i,
      })
    ).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "09-admin-curadoria-importacoes.png"),
      fullPage: true,
    });

    // Revisão Visual Mobile (390x844 - iPhone 14)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard?track=OAB");
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "10-dashboard-mobile.png"),
      fullPage: true,
    });

    await page.goto("/questoes?trackCode=OAB");
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "11-questoes-mobile.png"),
      fullPage: true,
    });
  });
});
