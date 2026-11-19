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

  test("2. Fluxo completo de estudo real TJSP 2024, gabarito comentado, recuperação de erro, simulado e revisão visual (Desktop & Mobile)", async ({
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

    // Navegar para o Banco de Questões filtrando por TJSP
    await page.goto("/questoes?trackCode=TJSP&includeAnnulled=true");
    await expect(
      page.getByText(/questão\(ões\) oficial\(is\) encontrada\(s\)/i)
    ).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "03-banco-questoes-tjsp-desktop.png"),
      fullPage: true,
    });

    // Abrir a questão #56 (Lei nº 10.261/68 - Revisão de Punição Disciplinar - Gabarito Oficial D)
    const firstCard = page.locator("article").first();
    await expect(firstCard).toBeVisible();

    // Responder a primeira questão corretamente e abrir a explicação jurídica verificada
    const focusLinks = page.getByRole("link", { name: /Foco Individual/i });
    const countLinks = await focusLinks.count();
    expect(countLinks).toBeGreaterThan(0);

    await focusLinks.first().click();
    await expect(page).toHaveURL(/\/questoes\/[0-9a-f-]+/);

    // Selecionar a alternativa B na primeira questão da lista ou verificar gabarito
    const radioButtons = page.getByRole("radio");
    await radioButtons.nth(1).click();
    await page.getByRole("button", { name: /Responder questão/i }).click();

    await expect(
      page.getByText(/Gabarito Oficial Definitivo da Banca:/i)
    ).toBeVisible({ timeout: 20_000 });

    // Solicitar o Gabarito Comentado Completo (Etapa 4)
    await page
      .getByRole("button", { name: /Gabarito comentado completo/i })
      .click();

    await expect(
      page.getByText(/Entendimento na Data da Prova/i)
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/Entendimento Atual Verificado/i)
    ).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "04-questao-resolvida-gabarito-comentado.png"),
      fullPage: true,
    });

    // Agora testar erro proposital + Caderno Automático de Erros + Recuperação da questão errada
    await page.goto("/questoes?trackCode=TJSP&query=10.261");
    await expect(page.getByText(/Lei nº 10\.261\/68/i)).toBeVisible();

    await page.getByRole("link", { name: /Foco Individual/i }).first().click();
    await expect(page).toHaveURL(/\/questoes\/[0-9a-f-]+/);

    // Na questão da Lei 10.261/68 (Gabarito D), selecionar A (incorreta) na 1ª tentativa
    await page.getByRole("radio").nth(0).click();
    await page.getByRole("button", { name: /Responder questão/i }).click();
    await expect(
      page.getByText(/Resposta Incorreta — Adicionada ao Caderno Automático de Erros/i)
    ).toBeVisible({ timeout: 20_000 });

    // Verificar fundamentos jurídicos na questão da Lei 10.261/68
    await page
      .getByRole("button", { name: /Mostre o fundamento legal/i })
      .click();
    await expect(
      page.getByText(/Lei Estadual SP nº 10\.261\/1968/i).first()
    ).toBeVisible({ timeout: 20_000 });

    // Refazer a mesma questão agora assinalando a alternativa D (Correta - índice 3) para registrar recuperação
    await page.getByRole("radio").nth(3).click();
    await page.getByRole("button", { name: /Responder questão/i }).click();
    await expect(page.getByText(/Resposta Correta!/i)).toBeVisible({
      timeout: 20_000,
    });

    // Verificar Cadernos e Fila de Revisão Espaçada
    await page.goto("/cadernos?track=TJSP");
    await expect(
      page.getByRole("heading", { name: /Caderno Automático de Erros/i }).first()
    ).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "05-cadernos-de-estudo.png"),
      fullPage: true,
    });

    await page.goto("/revisoes?track=TJSP");
    await expect(
      page.getByRole("heading", { name: /Fila de Revisão Espaçada/i })
    ).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "06-revisoes-espacadas.png"),
      fullPage: true,
    });

    // Verificar Estatísticas Atualizadas
    await page.goto("/estatisticas?track=TJSP");
    await expect(
      page.getByText(/Questões Únicas vs\. Tentativas/i)
    ).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "07-estatisticas-desempenho.png"),
      fullPage: true,
    });

    // Criar e finalizar um Simulado Real TJSP 2024
    await page.goto("/simulados?track=TJSP");
    await page.getByLabel(/Quantidade de Questões/i).fill("5");
    await page.getByRole("button", { name: /Iniciar Simulado/i }).click();

    await expect(page).toHaveURL(/\/simulados\/[0-9a-f-]+/, {
      timeout: 25_000,
    });
    await expect(page.getByText(/Cartão de Respostas/i)).toBeVisible();

    // Responder itens do simulado
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
    await page.goto("/dashboard?track=TJSP");
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "10-dashboard-mobile.png"),
      fullPage: true,
    });

    await page.goto("/questoes?trackCode=TJSP");
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "11-questoes-mobile.png"),
      fullPage: true,
    });
  });
});
