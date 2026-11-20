"use client";

import { useState } from "react";
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
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ArrowRight,
  Shield,
  MoreHorizontal,
} from "lucide-react";
import { BrandMark, useTheme } from "@/components/ui";
import type { ResumeTarget } from "@/features/question-bank/service";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Visão Geral", shortLabel: "Início", icon: LayoutDashboard },
  { href: "/questoes", label: "Banco de Questões", shortLabel: "Questões", icon: BookOpenCheck },
  { href: "/simulados", label: "Simulados", shortLabel: "Simulados", icon: Timer },
  { href: "/revisoes", label: "Revisões", shortLabel: "Revisões", icon: RotateCcw },
  { href: "/cadernos", label: "Meus Cadernos", shortLabel: "Cadernos", icon: FolderKanban },
  { href: "/estatisticas", label: "Estatísticas", shortLabel: "Dados", icon: BarChart3 },
  { href: "/fontes", label: "Fontes Jurídicas", shortLabel: "Fontes", icon: Scale },
  { href: "/configuracoes", label: "Configurações", shortLabel: "Config.", icon: Settings },
];

const MOBILE_BOTTOM_NAV: NavItem[] = PRIMARY_NAV_ITEMS.slice(0, 4);

const TRACK_OPTIONS = [
  { code: "TJSP", label: "TJSP • Escrevente", shortLabel: "TJSP" },
  { code: "PCSP", label: "PCSP • Investigador & Escrivão", shortLabel: "PCSP" },
  { code: "PRF", label: "PRF • Policial Rodoviário", shortLabel: "PRF" },
  { code: "OAB", label: "OAB • 1ª Fase Unificado", shortLabel: "OAB" },
] as const;

export function PlatformShell({
  user,
  resumeTarget,
  children,
}: {
  user: {
    name: string;
    email: string;
    role: string;
    activeTrackCode: string;
  };
  resumeTarget: ResumeTarget;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme, mounted, toggleTheme } = useTheme();
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";

  const currentTrack =
    searchParams.get("track")?.toUpperCase() || user.activeTrackCode || "TJSP";

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

  const isDrawerItemActive = PRIMARY_NAV_ITEMS.slice(4).some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-surface-subtle border-r border-border z-30">
        <div className="h-16 px-4 flex items-center justify-between border-b border-border/80">
          <Link
            href={`/dashboard?track=${currentTrack}`}
            className="flex items-center gap-2.5 min-w-0"
          >
            <BrandMark size="md" />
            <div className="min-w-0">
              <span className="font-display text-sm font-semibold text-foreground block leading-none truncate">
                Estudo Jurídico
              </span>
              <span className="text-[11px] text-muted block mt-0.5 truncate">
                Concursos &amp; OAB
              </span>
            </div>
          </Link>
        </div>

        <div className="px-3 py-4 flex-1 overflow-y-auto space-y-5">
          <div>
            <div className="px-2.5 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
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
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors duration-150",
                      isActive
                        ? "bg-brand-tint text-brand-accent font-semibold"
                        : "text-muted hover:text-foreground hover:bg-surface/70"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-brand-accent" : "text-subtle"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {isAdmin && (
            <div className="pt-4 border-t border-border/80">
              <div className="px-2.5 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
                Curadoria &amp; Acervo
              </div>
              <Link
                href="/admin/acervo"
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors duration-150",
                  pathname.startsWith("/admin")
                    ? "bg-brand text-white"
                    : "text-muted hover:text-foreground hover:bg-surface/70"
                )}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span className="truncate">Painel do Acervo</span>
              </Link>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border/80 bg-surface/50">
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
              aria-label="Encerrar sessão privada"
              className="p-2 rounded-md text-muted hover:text-semantic-error hover:bg-surface transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer ("Mais" / Menu completo) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-surface h-full flex flex-col border-r border-border z-10 shadow-elevated">
            <div className="h-14 px-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <BrandMark size="sm" />
                <span className="font-display text-sm font-semibold text-foreground truncate">
                  Estudo Jurídico
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="p-2 rounded-md text-muted hover:text-foreground hover:bg-surface-subtle"
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
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-tint text-brand-accent font-semibold"
                        : "text-muted hover:text-foreground hover:bg-surface-subtle"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {isAdmin && (
                <div className="pt-3 mt-3 border-t border-border space-y-1">
                  <Link
                    href="/admin/acervo"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface-subtle"
                  >
                    <Shield className="w-4 h-4 shrink-0" />
                    <span>Painel do Acervo &amp; Curadoria</span>
                  </Link>
                  <Link
                    href="/admin/importacoes"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface-subtle"
                  >
                    <BookOpenCheck className="w-4 h-4 shrink-0" />
                    <span>Importação de Provas (PDF)</span>
                  </Link>
                </div>
              )}
            </nav>

            <div className="p-3 border-t border-border bg-surface-subtle/60 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-muted truncate">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Encerrar sessão privada"
                className="p-2 rounded-md text-muted hover:text-semantic-error hover:bg-surface"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 sm:h-16 bg-surface/95 backdrop-blur-sm border-b border-border px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-subtle shrink-0"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              href={`/dashboard?track=${currentTrack}`}
              className="lg:hidden shrink-0"
              aria-label="Ir para o início"
            >
              <BrandMark size="sm" />
            </Link>
            <div className="min-w-0 hidden xs:block sm:block">
              <h1 className="font-display text-sm sm:text-base font-semibold text-foreground truncate">
                {activeNav.label}
              </h1>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted">
                <span>Foco ativo:</span>
                <span className="font-medium text-foreground">
                  {currentTrack}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Seletor rápido de carreira */}
            <label htmlFor="header-track-select" className="sr-only">
              Selecionar carreira ativa
            </label>
            <select
              id="header-track-select"
              value={currentTrack}
              onChange={(e) => handleTrackChange(e.target.value)}
              className="h-9 max-w-[140px] sm:max-w-none px-2.5 sm:px-3 rounded-md bg-background border border-border text-xs font-medium text-foreground hover:border-border-strong focus:outline-none focus:border-brand transition-colors"
            >
              {TRACK_OPTIONS.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                mounted && resolvedTheme === "dark"
                  ? "Ativar tema claro"
                  : "Ativar tema escuro"
              }
              title={
                mounted && resolvedTheme === "dark"
                  ? "Alternar para modo claro"
                  : "Alternar para modo escuro"
              }
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-background text-muted hover:text-foreground hover:border-border-strong transition-colors shrink-0"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <Link
              href={resumeTarget.href}
              title={resumeTarget.contextSubtitle}
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-brand hover:bg-brand-dark text-white text-xs font-medium transition-colors shadow-subtle"
            >
              <span>{resumeTarget.shortLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Navegação Inferior Fixa Mobile (5 destinos confortáveis ao polegar) */}
      <nav
        aria-label="Navegação rápida mobile"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border pb-safe"
      >
        <div className="grid grid-cols-5 h-14">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={`${item.href}?track=${currentTrack}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors min-h-[48px]",
                  isActive
                    ? "text-brand-accent font-semibold"
                    : "text-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-full px-1">
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir mais opções"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors min-h-[48px]",
              isDrawerItemActive || mobileMenuOpen
                ? "text-brand-accent font-semibold"
                : "text-muted hover:text-foreground"
            )}
          >
            <MoreHorizontal className="w-4 h-4 shrink-0" />
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
