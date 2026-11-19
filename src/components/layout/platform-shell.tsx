"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  BookOpenCheck,
  Timer,
  FolderKanban,
  RotateCcw,
  BarChart3,
  Scale,
  Settings,
  Database,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ArrowRight,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/questoes", label: "Banco de Questões", icon: BookOpenCheck },
  { href: "/simulados", label: "Simulados", icon: Timer },
  { href: "/cadernos", label: "Meus Cadernos", icon: FolderKanban },
  { href: "/revisoes", label: "Revisões", icon: RotateCcw },
  { href: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { href: "/fontes", label: "Fontes Jurídicas", icon: Scale },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const TRACK_OPTIONS = [
  { code: "TJSP", label: "TJSP • Escrevente" },
  { code: "PCSP", label: "PCSP • Investigador & Escrivão" },
  { code: "PRF", label: "PRF • Policial Rodoviário" },
  { code: "OAB", label: "OAB • 1ª Fase Unificado" },
] as const;

export function PlatformShell({
  user,
  dbConnected,
  children,
}: {
  user: {
    name: string;
    email: string;
    role: string;
    activeTrackCode: string;
  };
  dbConnected: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const currentTrack =
    searchParams.get("track")?.toUpperCase() || user.activeTrackCode || "TJSP";

  useEffect(() => {
    const savedTheme = localStorage.getItem("pe_theme");
    if (savedTheme === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("pe_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("pe_theme", "light");
    }
  }

  function handleTrackChange(newTrackCode: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("track", newTrackCode);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const activeNav =
    PRIMARY_NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    ) ?? PRIMARY_NAV_ITEMS[0]!;

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-surface border-r border-border z-30">
        <div className="h-16 px-5 flex items-center justify-between border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-navy text-white flex items-center justify-center font-display text-sm font-semibold">
              PE
            </div>
            <div>
              <span className="font-display text-sm font-semibold text-foreground block leading-none">
                Estudo Jurídico
              </span>
              <span className="text-[11px] text-muted block mt-0.5">
                Concursos &amp; OAB
              </span>
            </div>
          </Link>
        </div>

        <div className="px-3 py-4 flex-1 overflow-y-auto space-y-6">
          <div>
            <div className="px-2.5 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
              Ambiente de Estudo
            </div>
            <nav className="space-y-0.5" aria-label="Navegação Principal">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={`${item.href}?track=${currentTrack}`}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
                      isActive
                        ? "bg-navy text-white shadow-subtle"
                        : "text-muted hover:text-foreground hover:bg-surface-subtle"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="px-2.5 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
              Curadoria &amp; Acervo
            </div>
            <Link
              href="/admin/acervo"
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-petrol text-white"
                  : "text-muted hover:text-foreground hover:bg-surface-subtle"
              )}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Painel do Acervo &amp; Curadoria</span>
            </Link>
          </div>
        </div>

        <div className="p-3.5 border-t border-border bg-surface-subtle/40">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-muted truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Encerrar sessão privada"
              className="p-1.5 rounded-md text-muted hover:text-semantic-error hover:bg-surface transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-full bg-surface h-full flex flex-col border-r border-border z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-border">
              <span className="font-display text-sm font-semibold">
                Estudo Jurídico
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={`${item.href}?track=${currentTrack}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                      isActive
                        ? "bg-navy text-white"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="pt-3 mt-3 border-t border-border">
                <Link
                  href="/admin/importacoes"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:text-foreground"
                >
                  <Shield className="w-4 h-4" />
                  <span>Administração de Provas</span>
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md text-muted hover:text-foreground shrink-0"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base font-semibold text-foreground truncate">
                {activeNav.label}
              </h1>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted">
                <span>Foco ativo:</span>
                <span className="font-medium text-foreground">
                  {currentTrack}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Seletor rápido de carreira */}
            <label htmlFor="header-track-select" className="sr-only">
              Selecionar carreira ativa
            </label>
            <select
              id="header-track-select"
              value={currentTrack}
              onChange={(e) => handleTrackChange(e.target.value)}
              className="h-9 px-3 rounded-md bg-background border border-border text-xs font-medium text-foreground focus:outline-none focus:border-petrol"
            >
              {TRACK_OPTIONS.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Status do Prisma Postgres */}
            <div
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border",
                dbConnected
                  ? "bg-semantic-success-bg text-semantic-success border-semantic-success/25"
                  : "bg-semantic-warning-bg text-semantic-warning border-semantic-warning/30"
              )}
              title={
                dbConnected
                  ? "Conectado ao Prisma Postgres (Connection Pool ativo)"
                  : "Aguardando variáveis DATABASE_URL_POOLED e DIRECT_URL no ambiente"
              }
            >
              <Database className="w-3 h-3" />
              <span>
                {dbConnected ? "Prisma Postgres Ativo" : "Banco Pendente (.env)"}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Alternar tema claro ou escuro"
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-background text-muted hover:text-foreground transition-colors"
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <Link
              href={`/questoes?track=${currentTrack}`}
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-petrol hover:bg-petrol-dark text-white text-xs font-medium transition-colors"
            >
              <span>Continuar estudando</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
