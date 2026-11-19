# Configuração e Deploy na Vercel com Prisma Postgres

## 1. Provisionamento dos Bancos Exclusivos

Crie dois bancos dedicados no **Prisma Postgres** (via Vercel Marketplace ou Console do Prisma), sem reutilizar bancos de projetos anteriores:

- **Desenvolvimento / Preview**: `plataforma-estudos-dev`
- **Produção**: `plataforma-estudos-prod`

### Região Recomendada

No arquivo `vercel.json`, a região padrão de execução das Vercel Functions está configurada como `gru1` (São Paulo, Brasil) para baixa latência ao usuário. Escolha a região do Prisma Postgres mais próxima disponível (ex.: `sa-east-1` ou `us-east-1`).

## 2. Variáveis de Ambiente na Vercel

Configure as seguintes variáveis protegidas no painel da Vercel (separando **Production** de **Preview / Development**):

| Variável | Ambiente | Descrição |
|---|---|---|
| `DATABASE_URL_POOLED` | Production / Preview | String de conexão PostgreSQL com Connection Pool (obrigatória em produção) |
| `DIRECT_URL` | Production / Preview | String de conexão PostgreSQL direta para migrations (`prisma migrate deploy`) |
| `AUTH_SECRET` | Todos | Segredo criptográfico de 32+ bytes (`openssl rand -base64 32`) |
| `OWNER_EMAIL` | Todos | E-mail do proprietário único para inicialização no seed |
| `OWNER_PASSWORD` | Todos | Senha inicial do proprietário (mínimo 8 caracteres) |
| `BLOB_READ_WRITE_TOKEN` | Production / Preview | Token do Vercel Blob para armazenamento persistente de PDFs e figuras |
| `AI_API_KEY` | Production / Preview | Chave da API do modelo de linguagem para explicações jurídicas |

## 3. Fluxo Controlado de Migrations em Produção

Implantação de Preview **não** executa `migrate deploy` nem `seed` contra o banco produtivo. O comando de build na Vercel (`npm run build`) executa apenas `prisma generate && next build`.

Antes de promover uma versão com alterações de schema para produção, aplique as migrations de forma controlada apontando `DIRECT_URL` para `plataforma-estudos-prod`:

```bash
npm run db:migrate:deploy
npm run db:seed
npm run db:verify
```
