import { Suspense } from "react";
import { requireServerAuth } from "@/lib/auth/session";
import { getQuickResumeTarget } from "@/features/question-bank/service";
import { PlatformShell } from "@/components/layout/platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireServerAuth();
  const resumeTarget = await getQuickResumeTarget({
    userId: user.id,
    activeTrackCode: user.activeTrackCode,
  });

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted">
          Carregando ambiente de estudo...
        </div>
      }
    >
      <PlatformShell user={user} resumeTarget={resumeTarget}>
        {children}
      </PlatformShell>
    </Suspense>
  );
}
