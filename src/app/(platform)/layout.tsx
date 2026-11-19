import { Suspense } from "react";
import { requireServerAuth } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/db/prisma";
import { PlatformShell } from "@/components/layout/platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireServerAuth();
  const dbConnected = isDatabaseConfigured();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted">
          Carregando ambiente de estudo...
        </div>
      }
    >
      <PlatformShell user={user} dbConnected={dbConnected}>
        {children}
      </PlatformShell>
    </Suspense>
  );
}
