import { test, expect } from "@playwright/test";

test.describe("Fluxos E2E e Segurança de Rotas Privadas", () => {
  test("redireciona usuário não autenticado de /dashboard e /questoes para /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /Plataforma Pessoal de Estudos/i })
    ).toBeVisible();
  });

  test("bloqueia acesso anônimo aos endpoints de API com HTTP 401", async ({
    request,
  }) => {
    const questionsRes = await request.get("/api/questions");
    expect(questionsRes.status()).toBe(401);

    const statsRes = await request.get("/api/stats");
    expect(statsRes.status()).toBe(401);

    const adminImportsRes = await request.get("/api/admin/imports");
    expect(adminImportsRes.status()).toBe(401);
  });

  test("valida formulário de login privado e rejeita credenciais inválidas", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail do proprietário/i).fill("invalido");
    await page.getByLabel(/Senha de acesso/i).fill("123");
    await page.getByRole("button", { name: /Entrar na plataforma/i }).click();

    await expect(page.getByText(/Formato de e-mail inválido/i)).toBeVisible();
  });
});
