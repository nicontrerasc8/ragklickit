import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, LayoutGrid, Sparkles } from "lucide-react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,hsl(var(--muted))_0%,transparent_38%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--background)))]">
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-40 border-b border-b-foreground/10 bg-background/85 backdrop-blur">
          <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 text-sm sm:px-6">
            <div className="flex items-center gap-6">
              <Link href="/protected" className="flex items-center gap-3 font-semibold tracking-tight">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
                  <Sparkles size={16} />
                </span>
                <span className="flex flex-col leading-none">
                  <span>Ragklickit</span>
                  <span className="text-[11px] font-medium text-muted-foreground">Operacion de agencia</span>
                </span>
              </Link>

              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href="/protected"
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <LayoutGrid size={13} />
                  Dashboard
                </Link>
                <Link
                  href="/protected/empresas"
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Building2 size={13} />
                  Empresas
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              {!hasEnvVars ? (
                <EnvVarWarning />
              ) : (
                <Suspense>
                  <AuthButton />
                </Suspense>
              )}
            </div>
          </nav>
        </header>

        <div className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>

        <footer className="border-t border-t-foreground/10">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:px-6">
            <p>Ragklickit</p>
            <p>Workspace interno para briefs, BEC y planes de trabajo</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
