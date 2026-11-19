# Plataforma Pessoal de Questões e Simulados — Concursos Públicos & OAB

Aplicação web privada, responsiva e orientada a alta precisão para estudo de questões reais, realização de simulados cronometrados, repetição espaçada e consulta a fundamentos jurídicos verificáveis.

## Carreiras Prioritárias

- **TJSP**: Escrevente Técnico Judiciário (Fundação Vunesp)
- **PCSP**: Investigador de Polícia (`PCSP2304`) e Escrivão de Polícia (`PCSP2305`) (Fundação Vunesp)
- **PRF**: Policial Rodoviário Federal (Cebraspe — Modelo Certo/Errado com pontuação negativa)
- **OAB**: Exame de Ordem Unificado — 1ª Fase (FGV Conhecimento — 80 questões)

## Stack Tecnológica

- **Frontend & Backend**: Next.js 15 App Router, React 19, TypeScript 5 (`strict: true`), Tailwind CSS, Radix UI, Lucide Icons, React Hook Form, Zod, Recharts
- **Banco de Dados**: **Prisma Postgres + Prisma ORM** (`@prisma/client`, `@prisma/adapter-pg`, `pg`, `prisma.config.ts`) — *Sem Supabase em nenhuma camada*
- **Autenticação Privada**: Sessão JWT assinada (`jose`) em cookie HTTP-only + hash de senha `scrypt` em tempo constante + rate-limiting de login
- **Extração de PDFs Oficiais**: Python + PyMuPDF (`scripts/imports/extract_pdf_exam.py`) + Pipeline de validação e curadoria
- **Testes**: Vitest (Unitários, Integração e Validação Jurídica) + Playwright (E2E)
- **Hospedagem**: Vercel (Runtime Node.js, região `gru1`)

## Instalação e Configuração Local

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente**:
   Copie `.env.example` para `.env.local` e preencha as URLs do seu banco **Prisma Postgres** (`DATABASE_URL_POOLED` e `DIRECT_URL`), o segredo `AUTH_SECRET` e as credenciais iniciais do proprietário (`OWNER_EMAIL` e `OWNER_PASSWORD`):
   ```bash
   cp .env.example .env.local
   ```

3. **Aplicar migrations, popular catálogo inicial e verificar conexão**:
   ```bash
   npm run db:validate
   npm run db:migrate:deploy
   npm run db:seed
   npm run db:verify
   ```

4. **Executar testes e iniciar servidor**:
   ```bash
   npm test
   npm run typecheck
   npm run dev
   ```

## Documentação Técnica Detalhada

- [Arquitetura do Sistema](docs/architecture.md)
- [Modelagem do Banco de Dados (Prisma Postgres)](docs/database.md)
- [Configuração e Deploy na Vercel](docs/deployment.md)
- [Pipeline de Importação de Provas em PDF](docs/imports.md)
- [Auditoria e Validação de Explicações Jurídicas](docs/legal-validation.md)
