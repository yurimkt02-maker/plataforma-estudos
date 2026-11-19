# Arquitetura da Plataforma Pessoal de Estudos

## 1. Visão Geral e Princípios Arquiteturais

A plataforma foi projetada como um sistema monolítico modular por domínio utilizando **Next.js App Router (TypeScript estrito)**, **Prisma ORM + Prisma Postgres** (`@prisma/adapter-pg` + `pg`) e hospedagem na **Vercel** (runtime Node.js).

### Decisões Principais

1. **Zero Supabase / Zero Prisma Accelerate**: Toda a persistência relacional ocorre diretamente no **Prisma Postgres** via conexões TCP/TLS gerenciadas pelo driver adapter `@prisma/adapter-pg`.
2. **Isolamento Servidor-Cliente**: O módulo `src/lib/db/prisma.ts` valida explicitamente a execução no servidor (`typeof window !== "undefined"` lança erro imediato) e está listado em `serverExternalPackages` no `next.config.ts`.
3. **Separação de Conexões Pooled vs. Direta**:
   - **Runtime (`DATABASE_URL_POOLED`)**: Utilizado pelas Vercel Functions para consultas da aplicação. Em produção (`NODE_ENV === "production"`), a ausência de `DATABASE_URL_POOLED` bloqueia a execução para evitar uso silencioso de conexões diretas sem pool.
   - **CLI e Migrations (`DIRECT_URL`)**: Resolvido em `prisma.config.ts` para `prisma migrate deploy` e `prisma studio`.
4. **Motor de Correção Independente (`src/features/scoring/engine.ts`)**:
   - Calcula pontuações exclusivamente no servidor.
   - Suporta múltipla escolha (`VUNESP_STANDARD_5`, `FGV_OAB_1FASE_80`) e Certo/Errado com pontuação negativa (`CEBRASPE_CERTO_ERRADO_PRF2021`).
   - Preserva a versão exata do gabarito oficial (`officialKeyRevisionId`) em cada tentativa.
5. **Autenticação Privada de Usuário Único (`src/lib/auth/`)**:
   - Sem cadastro público.
   - Senha armazenada com hash criptográfico `scrypt` (`N=16384, r=8, p=1, keylen=64`) e verificação em tempo constante (`timingSafeEqual`).
   - Sessão assinada via JWT (`HS256` com `jose`) em cookie HTTP-only, `Secure` (produção) e `SameSite=Lax`.
   - Rate-limiting por IP + e-mail contra força bruta (`src/lib/auth/rate-limit.ts`).
   - Dupla camada de proteção: `src/middleware.ts` + verificação explícita no servidor (`requireServerAuth`, `requireAdminAuth`, `requireApiAuth`, `requireApiAdmin`).
