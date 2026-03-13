import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CalendarioEditor from "@/app/protected/empresas/[empresaId]/calendario/CalendarioEditor";

type PageProps = {
  params: Promise<{ empresaId: string; calendarioId: string }>;
};

export default async function CalendarioDetailPage({ params }: PageProps) {
  const { empresaId, calendarioId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: appUser } = await supabase
    .from("app_user")
    .select("agencia_id")
    .eq("id", user.id)
    .maybeSingle();

  const agenciaId = appUser?.agencia_id ?? null;
  if (!agenciaId) notFound();

  const [{ data: empresa }, { data: calendario }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase
      .from("rag_artifacts")
      .select("id, title, status, version, content_json, updated_at")
      .eq("id", calendarioId)
      .eq("artifact_type", "calendario")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
  ]);

  if (!empresa || !calendario) notFound();

  const updatedLabel = new Date(calendario.updated_at).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
    plan:      { label: "Plan",      color: "#93c5fd", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.22)" },
    revision:  { label: "Revisión",  color: "#c4b5fd", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.22)" },
    aprobado:  { label: "Aprobado",  color: "#6ee7b7", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.22)" },
    publicado: { label: "Publicado", color: "#fde68a", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.22)" },
  };

  const status = STATUS_MAP[calendario.status] ?? STATUS_MAP["plan"];

  return (
    <div
      className="min-h-screen text-white"
      style={{
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
        background: "#080c12",
        backgroundImage: [
          "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(56,189,248,0.055) 0%, transparent 60%)",
          "radial-gradient(ellipse 50% 40% at 98% 85%, rgba(139,92,246,0.045) 0%, transparent 55%)",
        ].join(", "),
      }}
    >
      {/* Fine dot grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          opacity: 0.018,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative flex min-h-screen flex-col">

        {/* ── TOP NAV BAR ─────────────────────────────────────────── */}
        <nav
          className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b px-6 sm:px-10 xl:px-16"
          style={{
            borderColor: "rgba(255,255,255,0.055)",
            background: "rgba(8,12,18,0.85)",
            backdropFilter: "blur(20px)",
            height: "56px",
          }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[11px] tracking-wide min-w-0">
            {[
              { label: "Empresas", href: "/protected/empresas" },
              { label: empresa.nombre, href: `/protected/empresas/${empresaId}` },
              { label: "Calendario", href: `/protected/empresas/${empresaId}/calendario` },
            ].map(({ label, href }, i) => (
              <span key={href} className="flex items-center gap-2 min-w-0">
                {i > 0 && <span style={{ color: "rgba(255,255,255,0.12)" }}>›</span>}
                <Link
                  href={href}
                  className="truncate transition-colors hover:text-white"
                  style={{ color: "rgba(255,255,255,0.32)" }}
                >
                  {label}
                </Link>
              </span>
            ))}
            <span style={{ color: "rgba(255,255,255,0.12)" }}>›</span>
            <span className="font-medium truncate" style={{ color: "rgba(56,189,248,0.85)" }}>
              Editar
            </span>
          </div>

          {/* Right badges */}
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="hidden sm:inline-flex items-center rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                background: status.bg,
                border: `1px solid ${status.border}`,
                color: status.color,
              }}
            >
              {status.label}
            </span>
            <Link
              href={`/protected/empresas/${empresaId}/calendario/${calendarioId}/studio`}
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors hover:text-white"
              style={{
                background: "rgba(56,189,248,0.08)",
                border: "1px solid rgba(56,189,248,0.18)",
                color: "rgba(56,189,248,0.75)",
              }}
            >
              Studio IA
            </Link>
            <span
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.38)",
              }}
            >
              v{calendario.version}
            </span>
          </div>
        </nav>

        {/* ── PAGE BODY ────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-0">

          {/* ── HEADER CARD ─────────────────────────────────────────── */}
          <header
            className="relative overflow-hidden border-b"
            style={{
              borderColor: "rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.012)",
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute left-0 top-0 h-[1.5px] w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.7) 20%, rgba(139,92,246,0.5) 70%, transparent 100%)",
              }}
            />
            {/* Ambient glow */}
            <div
              className="pointer-events-none absolute -right-40 top-0 h-64 w-96 -translate-y-1/2"
              style={{
                background: "radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 70%)",
                filter: "blur(50px)",
              }}
            />

            <div className="relative px-6 sm:px-10 xl:px-16 py-10 sm:py-12">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">

                {/* Title block */}
                <div className="space-y-3 max-w-2xl">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.25em]"
                    style={{ color: "rgba(56,189,248,0.6)" }}
                  >
                    Editor de calendario
                  </p>
                  <h1
                    className="text-4xl sm:text-5xl font-semibold leading-[1.05]"
                    style={{ letterSpacing: "-0.03em", color: "rgba(255,255,255,0.95)" }}
                  >
                    {calendario.title || "Calendario editorial"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ background: "rgba(56,189,248,0.6)" }}
                      />
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                        {empresa.nombre}
                      </span>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                      Actualizado: {updatedLabel}
                    </span>
                  </div>
                </div>

                {/* Metadata pills row */}
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "Tipo", value: "Calendario editorial", accent: false },
                    { label: "Estado", value: status.label, accent: true, accentColor: status.color },
                    { label: "Versión", value: `v${calendario.version}`, accent: false },
                  ].map(({ label, value, accent, accentColor }) => (
                    <div
                      key={label}
                      className="rounded-xl px-5 py-3.5"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        minWidth: 100,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.22)",
                          marginBottom: 5,
                        }}
                      >
                        {label}
                      </p>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: accent ? (accentColor ?? "rgba(255,255,255,0.8)") : "rgba(255,255,255,0.78)",
                        }}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* ── EDITOR AREA ─────────────────────────────────────────── */}
          <section className="relative flex-1 px-6 sm:px-10 xl:px-16 py-8">

            {/* Inner label bar */}
            <div
              className="mb-6 flex items-center justify-between gap-4 rounded-2xl px-6 py-4"
              style={{
                background: "rgba(255,255,255,0.022)",
                border: "1px solid rgba(255,255,255,0.055)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-5 w-[2px] rounded-full"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(56,189,248,0.9) 0%, rgba(139,92,246,0.5) 100%)",
                  }}
                />
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  Contenido del calendario
                </p>
              </div>

              {/* Hint chip */}
              <span
                className="hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px]"
                style={{
                  background: "rgba(56,189,248,0.06)",
                  border: "1px solid rgba(56,189,248,0.15)",
                  color: "rgba(56,189,248,0.65)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4.5" stroke="rgba(56,189,248,0.65)" />
                  <rect x="4.5" y="3" width="1" height="4" fill="rgba(56,189,248,0.65)" rx="0.5" />
                  <circle cx="5" cy="2.5" r="0.5" fill="rgba(56,189,248,0.65)" />
                </svg>
                Haz clic en un post para ver y editar detalles
              </span>
            </div>

            {/* The actual editor — full width, tall, spacious */}
            <div
              className="relative overflow-hidden rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.016)",
                border: "1px solid rgba(255,255,255,0.055)",
                minHeight: "72vh",
              }}
            >
              {/* Corner glows */}
              <div
                className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
                  filter: "blur(60px)",
                }}
              />
              <div
                className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 70%)",
                  filter: "blur(50px)",
                }}
              />

              <div className="relative p-6 sm:p-8 xl:p-10 h-full">
                <CalendarioEditor
                  empresaId={empresaId}
                  calendarioId={calendario.id}
                  initialTitle={calendario.title || "Calendario editorial"}
                  initialStatus={calendario.status || "plan"}
                  initialContent={calendario.content_json}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
