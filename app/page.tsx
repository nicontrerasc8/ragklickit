import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, BookOpenText, Building2, CalendarCheck2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const highlights = [
  {
    title: "Contexto por empresa",
    description: "Centraliza informacion clave de cada cliente para evitar retrabajo.",
    icon: Building2,
  },
  {
    title: "Briefs accionables",
    description: "Estructura objetivos, entregables y criterios de exito en un solo flujo.",
    icon: BookOpenText,
  },
  {
    title: "Plan y calendario",
    description: "Convierte estrategia en ejecucion con seguimiento claro por equipo.",
    icon: CalendarCheck2,
  },
];

async function UserRedirectGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/protected");
  }

  return null;
}

export default function Home() {

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <Suspense fallback={null}>
        <UserRedirectGate />
      </Suspense>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
        <nav className="mt-4 flex h-16 items-center justify-between border px-4 sm:px-5">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            Ragklickit
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/auth/login">Ingresar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Crear cuenta</Link>
            </Button>
          </div>
        </nav>

        <section className="grid flex-1 items-center gap-10 py-12 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Operacion de agencia con contexto persistente
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Gestiona empresas, briefs y planes sin perder el hilo.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Una vista clara para coordinar estrategia y ejecucion de clientes desde un solo sistema.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/auth/sign-up">
                  Empezar ahora
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 sm:p-6">
            <p className="text-sm font-medium">Flujo rapido</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs">01</p>
                <p className="mt-1 font-medium text-foreground">Crear empresa</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs">02</p>
                <p className="mt-1 font-medium text-foreground">Documentar brief</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs">03</p>
                <p className="mt-1 font-medium text-foreground">Ejecutar plan de trabajo</p>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-10">
          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-xl border bg-card p-5">
                <div className="mb-4 inline-flex rounded-md border bg-muted/40 p-2">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
