import { Database, ShieldCheck, HardDriveDownload, Server } from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/db/prisma";

export default async function SettingsPage() {
  const user = await requireServerAuth();
  const dbConnected = isDatabaseConfigured();

  return (
    <div className="space-y-6">
      {/* Perfil e Sessão Privada */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <ShieldCheck className="w-4 h-4 text-navy" />
          <h2 className="font-display text-sm font-semibold text-foreground">
            Segurança da Conta Privada (Usuário Único)
          </h2>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-md bg-background border border-border">
            <dt className="text-muted">Proprietário Autenticado</dt>
            <dd className="font-semibold text-foreground mt-1">{user.name}</dd>
          </div>
          <div className="p-3.5 rounded-md bg-background border border-border">
            <dt className="text-muted">E-mail de Acesso</dt>
            <dd className="font-semibold text-foreground mt-1">{user.email}</dd>
          </div>
          <div className="p-3.5 rounded-md bg-background border border-border">
            <dt className="text-muted">Nível de Autorização</dt>
            <dd className="font-semibold text-petrol mt-1">
              {user.role} (Acesso Integral + Curadoria)
            </dd>
          </div>
        </dl>
      </section>

      {/* Diagnóstico de Infraestrutura Prisma Postgres & Vercel */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-petrol" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Diagnóstico Prisma Postgres &amp; Driver Adapter (@prisma/adapter-pg)
            </h3>
          </div>
          <span
            className={
              dbConnected
                ? "px-2.5 py-0.5 rounded bg-semantic-success-bg text-semantic-success text-xs font-semibold"
                : "px-2.5 py-0.5 rounded bg-semantic-warning-bg text-semantic-warning text-xs font-semibold"
            }
          >
            {dbConnected ? "Conectado" : "Aguardando Variáveis de Ambiente"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-background border border-border space-y-2">
            <div className="font-display font-semibold text-foreground flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-navy" />
              <span>Conexão Pooled em Runtime (DATABASE_URL_POOLED)</span>
            </div>
            <p className="text-muted leading-relaxed">
              Utilizada pelo módulo{" "}
              <code className="font-mono text-foreground">
                src/lib/db/prisma.ts
              </code>{" "}
              por meio do adapter oficial{" "}
              <code className="font-mono text-foreground">
                @prisma/adapter-pg
              </code>{" "}
              nas Vercel Functions (runtime Node.js).
            </p>
          </div>

          <div className="p-4 rounded-lg bg-background border border-border space-y-2">
            <div className="font-display font-semibold text-foreground flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-petrol" />
              <span>Conexão Direta para Migrations (DIRECT_URL)</span>
            </div>
            <p className="text-muted leading-relaxed">
              Resolvida por{" "}
              <code className="font-mono text-foreground">prisma.config.ts</code>{" "}
              para execução controlada de{" "}
              <code className="font-mono text-foreground">
                prisma migrate deploy
              </code>{" "}
              e{" "}
              <code className="font-mono text-foreground">npm run db:seed</code>.
            </p>
          </div>
        </div>
      </section>

      {/* Exportação e Backup */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <HardDriveDownload className="w-4 h-4 text-navy" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Exportação de Desempenho e Backup Local Auditado
          </h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Para exportar todo o seu histórico de respostas, anotações pessoais,
          cadernos, fila de revisão espaçada e comentários jurídicos com hash de
          verificação SHA-256, execute no terminal:
        </p>
        <pre className="p-3 rounded-md bg-background border border-border font-mono text-xs text-foreground overflow-x-auto">
          npm run db:backup
        </pre>
      </section>
    </div>
  );
}
