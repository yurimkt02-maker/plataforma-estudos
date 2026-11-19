import Link from "next/link";
import { Shield, ArrowLeft, FileUp, CheckSquare, Scale, BookCopy, BarChart2 } from "lucide-react";
import { requireAdminAuth } from "@/lib/auth/session";

const ADMIN_NAV = [
  {
    href: "/admin/acervo",
    label: "Painel do Acervo",
    icon: BarChart2,
  },
  {
    href: "/admin/importacoes",
    label: "Importação de Provas (PDF)",
    icon: FileUp,
  },
  {
    href: "/admin/provas",
    label: "Edições & Versões de Caderno",
    icon: BookCopy,
  },
  {
    href: "/admin/questoes",
    label: "Curadoria de Questões & Gabaritos",
    icon: CheckSquare,
  },
  {
    href: "/admin/fontes-juridicas",
    label: "Fontes Jurídicas Verificadas",
    icon: Scale,
  },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-navy text-white border-b border-navy-dark px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold">
                Curadoria Administrativa &amp; Auditoria do Acervo
              </h1>
              <p className="text-[11px] text-white/75">
                Ambiente separado de estudo • Administrador: {admin.email}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Ambiente de Estudos</span>
          </Link>
        </div>

        <nav className="max-w-7xl mx-auto mt-4 pt-3 border-t border-white/15 flex flex-wrap gap-2">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
