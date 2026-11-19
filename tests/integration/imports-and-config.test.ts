import { describe, expect, it } from "vitest";
import {
  resolveDirectDatabaseUrl,
  resolvePooledDatabaseUrl,
} from "../../prisma.config";
import {
  computeQuestionCanonicalHash,
  validateExtractedQuestionItem,
} from "@/features/imports/pipeline";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth/rate-limit";
import {
  isSessionRevokedServerless,
  revokeSessionServerless,
} from "@/lib/auth/session-revocation";

describe("Integração: Pipeline de Importação, Segurança e Configuração Prisma Postgres", () => {
  it("valida resolução de DATABASE_URL_POOLED e DIRECT_URL e bloqueia Prisma Accelerate", () => {
    const direct = resolveDirectDatabaseUrl({
      NODE_ENV: "production",
      DIRECT_URL: "postgresql://user:pass@host:5432/plataforma-estudos-prod?sslmode=require",
    });
    expect(direct).toContain("plataforma-estudos-prod");

    expect(() =>
      resolvePooledDatabaseUrl({
        NODE_ENV: "production",
        DIRECT_URL: "postgresql://user:pass@host:5432/plataforma-estudos-prod",
      })
    ).toThrow(/DATABASE_URL_POOLED é obrigatória em produção/);

    expect(() =>
      resolveDirectDatabaseUrl({
        NODE_ENV: "development",
        DIRECT_URL: "prisma+postgres://accelerate.prisma-data.net/?api_key=abc",
      })
    ).toThrow(/Prisma Accelerate não são permitidas/);
  });

  it("impede publicação de questão extraída com enunciado incompleto, alternativas faltantes ou sem versão de prova", () => {
    const invalidItem = validateExtractedQuestionItem({
      originalNumber: 12,
      questionType: "MULTIPLE_CHOICE",
      statement: "Texto curto",
      options: [{ label: "A", content: "Única opção" }],
      officialAnswer: "C",
      subjectSlug: "",
      sourceDocumentSha256: "invalid-hash",
      examFormVersionLabel: "",
    });

    expect(invalidItem.isValid).toBe(false);
    const codes = invalidItem.issues.map((i) => i.code);
    expect(codes).toContain("MISSING_DOCUMENT_ORIGIN");
    expect(codes).toContain("MISSING_VERSION_LABEL");
    expect(codes).toContain("INCOMPLETE_STATEMENT");
    expect(codes).toContain("MISSING_OPTIONS");
    expect(codes).toContain("INVALID_ANSWER_KEY");
  });

  it("gera hash canônico idêntico para a mesma questão em versões diferentes de caderno (deduplicação)", () => {
    const qV1 = computeQuestionCanonicalHash({
      questionType: "MULTIPLE_CHOICE",
      statement: "Nos termos do Art. 5º, XI, da Constituição Federal, a casa é asilo inviolável do indivíduo.",
      options: [
        { label: "A", content: "Salvo em caso de flagrante delito." },
        { label: "B", content: "Salvo por ordem policial noturna." },
      ],
    });

    const qV2 = computeQuestionCanonicalHash({
      questionType: "MULTIPLE_CHOICE",
      statement: "Nos termos do Art. 5º, XI, da Constituição Federal,  a casa é asilo inviolável do indivíduo.",
      options: [
        { label: "A", content: "Salvo por ordem policial noturna." },
        { label: "B", content: "Salvo em caso de flagrante delito." },
      ],
    });

    expect(qV1).toBe(qV2);
  });

  it("executa hash criptográfico de senha e rate-limiting de login", () => {
    const hash = hashPassword("SenhaForte#Concurso2026");
    expect(verifyPassword("SenhaForte#Concurso2026", hash)).toBe(true);
    expect(verifyPassword("SenhaErrada123", hash)).toBe(false);

    const key = "127.0.0.1:owner@estudos.local";
    resetLoginRateLimit(key);
    for (let i = 0; i < 4; i++) {
      const r = recordFailedLoginAttempt(key, 1000);
      expect(r.allowed).toBe(true);
    }
    const locked = recordFailedLoginAttempt(key, 1000);
    expect(locked.allowed).toBe(false);
    expect(checkLoginRateLimit(key, 2000).allowed).toBe(false);
    resetLoginRateLimit(key);
  });

  it("revoga token de sessão por JTI impedindo reutilização após logout", async () => {
    const mockSession = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "owner@estudos.local",
      name: "Proprietário",
      role: "OWNER" as const,
      activeTrackCode: "TJSP",
      jti: "test-jti-revocation-001",
    };

    await revokeSessionServerless(mockSession);
    const revoked = await isSessionRevokedServerless(mockSession);
    expect(revoked).toBe(true);
  });
});
