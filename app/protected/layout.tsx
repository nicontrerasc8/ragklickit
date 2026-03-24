import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, LayoutGrid } from "lucide-react";

const navItems = [
  { href: "/protected", label: "Dashboard", icon: LayoutGrid },
  { href: "/protected/empresas", label: "Empresas", icon: Building2 },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%),radial-gradient(circle_at_top,rgba(34,211,238,0.08)_0%,transparent_34%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--background)))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_62%)]" />

      <div className="relative flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-background/70 backdrop-blur-2xl">
          <nav className="mx-auto flex min-h-[76px] w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 xl:px-10">
            <div className="flex min-w-0 items-center gap-3 sm:gap-6">
              <Link
                href="/protected"
                className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 transition hover:border-sky-400/25 hover:bg-white/[0.06]"
              >
                <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#38bdf8_0%,#0f172a_52%,#f97316_100%)] shadow-[0_14px_34px_rgba(56,189,248,0.18)]">
                  <span className="relative flex items-end gap-[3px]">
                    <span className="h-4 w-[5px] rounded-full bg-white/95" />
                    <span className="h-6 w-[5px] rounded-full bg-white/88" />
                    <span className="h-3 w-[5px] rounded-full bg-white/72" />
                  </span>
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_55%)]" />
                </span>
                <span className="flex min-w-0 flex-col leading-none">
                  <span className="truncate font-semibold tracking-[0.18em] text-foreground">ABA</span>
                  <span className="truncate text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Agency Brain OS
                  </span>
                </span>
              </Link>

              <div className="hidden items-center gap-2 lg:flex">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-sky-400/20 hover:bg-white/[0.06] hover:text-foreground"
                  >
                    <Icon size={14} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium text-muted-foreground xl:inline-flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.8)]" />
                Workspace activo
              </div>
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

        <div className="flex-1 px-4 py-6 sm:px-6 xl:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
          

            <div className="w-full">{children}</div>
          </div>
        </div>

        <footer className="border-t border-white/8 bg-white/[0.02]">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 xl:px-10">
            <p className="font-medium text-foreground/80">Ragklickit</p>
            <p>Workspace interno para estrategia, briefs, BEC, planes de trabajo y calendario editorial.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
