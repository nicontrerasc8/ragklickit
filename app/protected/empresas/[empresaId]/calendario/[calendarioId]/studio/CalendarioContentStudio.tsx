"use client";

import { useEffect, useState } from "react";
import type { CalendarioItem, CalendarioItemAssetBundle } from "@/lib/calendario/schema";

type Props = {
  empresaId: string;
  calendarioId: string;
  initialItems: CalendarioItem[];
  initialSelectedId?: string;
};

function hashtagsToText(tags: string[]) {
  return tags.join(" ");
}

function textToHashtags(text: string) {
  return text
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getStudioSections(item: CalendarioItem, bundle: CalendarioItemAssetBundle | null) {
  const format = item.formato.toLowerCase();
  const channel = item.canal.toLowerCase();
  const kind =
    bundle?.content_kind ??
    (format.includes("carrusel")
      ? "carousel"
      : format.includes("video") ||
          format.includes("reel") ||
          channel.includes("youtube") ||
          channel.includes("tiktok")
        ? "video"
        : format.includes("art") || channel.includes("blog")
          ? "blog"
          : format.includes("email") ||
              format.includes("newsletter") ||
              channel.includes("email")
            ? "email"
            : "social");

  return {
    kind,
    isBlog: kind === "blog",
    isEmail: kind === "email",
    isVideo: kind === "video",
    isCarousel: kind === "carousel",
    showImagePrompts: kind !== "email",
  };
}

type ChannelConfig = {
  gradient: string;
  accent: string;
  pill: string;
  dot: string;
  label: string;
  icon: string;
};

function getChannelConfig(channel: string): ChannelConfig {
  const key = channel.toLowerCase();
  if (key.includes("instagram"))
    return {
      gradient: "linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)",
      accent: "#f97316",
      pill: "bg-orange-500/12 text-orange-300 border-orange-400/20",
      dot: "#f97316",
      label: "Instagram",
      icon: "◈",
    };
  if (key.includes("facebook"))
    return {
      gradient: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
      accent: "#3b82f6",
      pill: "bg-blue-500/12 text-blue-300 border-blue-400/20",
      dot: "#3b82f6",
      label: "Facebook",
      icon: "◉",
    };
  if (key.includes("linkedin"))
    return {
      gradient: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
      accent: "#06b6d4",
      pill: "bg-cyan-500/12 text-cyan-300 border-cyan-400/20",
      dot: "#06b6d4",
      label: "LinkedIn",
      icon: "◎",
    };
  if (key.includes("tiktok"))
    return {
      gradient: "linear-gradient(135deg, #18181b 0%, #a21caf 50%, #ec4899 100%)",
      accent: "#e879f9",
      pill: "bg-fuchsia-500/12 text-fuchsia-300 border-fuchsia-400/20",
      dot: "#e879f9",
      label: "TikTok",
      icon: "◈",
    };
  if (key.includes("youtube"))
    return {
      gradient: "linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)",
      accent: "#ef4444",
      pill: "bg-red-500/12 text-red-300 border-red-400/20",
      dot: "#ef4444",
      label: "YouTube",
      icon: "▶",
    };
  if (key.includes("whatsapp"))
    return {
      gradient: "linear-gradient(135deg, #14532d 0%, #22c55e 100%)",
      accent: "#22c55e",
      pill: "bg-emerald-500/12 text-emerald-300 border-emerald-400/20",
      dot: "#22c55e",
      label: "WhatsApp",
      icon: "◌",
    };
  if (key.includes("blog"))
    return {
      gradient: "linear-gradient(135deg, #78350f 0%, #f59e0b 100%)",
      accent: "#f59e0b",
      pill: "bg-amber-500/12 text-amber-300 border-amber-400/20",
      dot: "#f59e0b",
      label: "Blog",
      icon: "⊞",
    };
  return {
    gradient: "linear-gradient(135deg, #312e81 0%, #6366f1 100%)",
    accent: "#818cf8",
    pill: "bg-indigo-500/12 text-indigo-300 border-indigo-400/20",
    dot: "#818cf8",
    label: "Social",
    icon: "◆",
  };
}

export default function CalendarioContentStudio({
  empresaId,
  calendarioId,
  initialItems,
  initialSelectedId,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(
    initialItems.find((item) => item.id === initialSelectedId)?.id ??
      initialItems[0]?.id ??
      "",
  );
  const [draft, setDraft] = useState<CalendarioItemAssetBundle | null>(
    initialItems.find((item) => item.id === initialSelectedId)?.asset_bundle ??
      initialItems[0]?.asset_bundle ??
      null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"ok" | "err">("ok");

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const studioSections = selectedItem ? getStudioSections(selectedItem, draft) : null;
  const channelConfig = selectedItem
    ? getChannelConfig(selectedItem.canal)
    : getChannelConfig("default");

  const bundleCount = items.filter((item) => item.asset_bundle).length;

  useEffect(() => {
    setDraft(selectedItem?.asset_bundle ?? null);
  }, [selectedId, selectedItem?.asset_bundle]);

  async function generateBundle() {
    if (!selectedItem) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/empresas/${empresaId}/calendario/${calendarioId}/studio/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: selectedItem.id }),
        },
      );
      const data = (await response.json()) as {
        error?: string;
        bundle?: CalendarioItemAssetBundle;
      };
      if (!response.ok || !data.bundle) throw new Error(data.error || "No se pudo generar el bundle.");
      setDraft(data.bundle);
      setMessageKind("ok");
      setMessage("Bundle generado. Revisa textos y prompts visuales antes de guardar.");
    } catch (error) {
      setMessageKind("err");
      setMessage(error instanceof Error ? error.message : "Error generando bundle.");
    } finally {
      setLoading(false);
    }
  }

  async function saveBundle() {
    if (!selectedItem || !draft) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/empresas/${empresaId}/calendario/${calendarioId}/studio/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: selectedItem.id, bundle: draft }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo guardar.");

      setItems((current) =>
        current.map((item) =>
          item.id === selectedItem.id ? { ...item, asset_bundle: draft } : item,
        ),
      );
      setMessageKind("ok");
      setMessage("Bundle guardado correctamente en el calendario.");
    } catch (error) {
      setMessageKind("err");
      setMessage(error instanceof Error ? error.message : "Error guardando bundle.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ background: "#05080f", fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
    >
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-[0.06]"
          style={{ background: channelConfig.gradient, filter: "blur(120px)" }}
        />
        <div
          className="absolute bottom-0 -left-40 h-[400px] w-[400px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent)", filter: "blur(80px)" }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative flex h-screen flex-col">
        {/* ─── TOP BAR: Studio header + horizontal item list ─── */}
        <header className="flex-none border-b border-white/[0.06]">
          {/* Studio identity row */}
          <div className="flex items-center justify-between gap-6 px-6 py-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ background: channelConfig.gradient }}
              >
                S
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Content Studio
              </p>
              <span className="text-white/15">·</span>
              <p className="text-[11px] text-white/30">Editorial</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Progress bar inline */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] text-white/28">
                  {bundleCount}/{items.length} listos
                </span>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: items.length > 0 ? `${(bundleCount / items.length) * 100}%` : "0%",
                      background: channelConfig.gradient,
                    }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-white/28">
                  {items.length > 0 ? Math.round((bundleCount / items.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Horizontal scrollable item list */}
          <div className="overflow-x-auto border-t border-white/[0.04]">
            <div className="flex gap-1 px-4 pb-3 pt-2" style={{ minWidth: "max-content" }}>
              {items.map((item, index) => {
                const cfg = getChannelConfig(item.canal);
                const isActive = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="group relative flex-none overflow-hidden rounded-2xl px-4 py-3 text-left transition-all duration-200"
                    style={{
                      minWidth: 200,
                      maxWidth: 240,
                      background: isActive ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                      borderBottom: isActive ? `2px solid ${cfg.accent}` : "2px solid transparent",
                      border: isActive
                        ? `1px solid ${cfg.accent}30`
                        : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {isActive && (
                      <div
                        className="pointer-events-none absolute inset-0 rounded-2xl"
                        style={{
                          background: `linear-gradient(180deg, ${cfg.accent}12 0%, transparent 100%)`,
                        }}
                      />
                    )}
                    <div className="relative">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[9px] font-bold uppercase tracking-[0.14em]"
                            style={{ color: cfg.accent }}
                          >
                            {item.canal}
                          </span>
                          <span className="text-[9px] text-white/20">·</span>
                          <span className="text-[9px] text-white/28">{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <span
                          className="h-1.5 w-1.5 flex-none rounded-full"
                          style={{
                            background: item.asset_bundle ? "#34d399" : "rgba(255,255,255,0.1)",
                            boxShadow: item.asset_bundle ? "0 0 6px rgba(52,211,153,0.55)" : "none",
                          }}
                        />
                      </div>
                      <p className="mt-1.5 truncate text-xs font-medium leading-5 text-white/75 group-hover:text-white/95">
                        {item.titulo_base || item.tema || "Sin título"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[8px] text-white/30">
                          {item.formato}
                        </span>
                        <span className="text-[8px] text-white/20">{item.fecha || "—"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* ─── MAIN PANEL ─── */}
        <main className="flex flex-col overflow-hidden">
          {selectedItem ? (
            <>
              {/* ── Top bar */}
              <div className="flex-none border-b border-white/[0.06]">
                {/* Channel accent strip */}
                <div className="h-[2px] w-full" style={{ background: channelConfig.gradient }} />

                <div className="flex items-center justify-between gap-6 px-7 py-4">
                  <div className="flex min-w-0 items-center gap-4">
                    {/* Channel icon orb */}
                    <div
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl text-base font-bold text-white shadow-lg"
                      style={{ background: channelConfig.gradient }}
                    >
                      {channelConfig.icon}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: channelConfig.accent }}
                      >
                        {selectedItem.canal} · {selectedItem.formato}
                      </p>
                      <h1 className="mt-0.5 truncate text-lg font-semibold text-white/92">
                        {selectedItem.titulo_base || selectedItem.tema || "Sin título"}
                      </h1>
                    </div>
                  </div>

                  <div className="flex flex-none items-center gap-2.5">
                    {message && (
                      <div
                        className="hidden items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium sm:flex"
                        style={{
                          background:
                            messageKind === "ok"
                              ? "rgba(52,211,153,0.10)"
                              : "rgba(239,68,68,0.10)",
                          color: messageKind === "ok" ? "#6ee7b7" : "#fca5a5",
                          border:
                            messageKind === "ok"
                              ? "1px solid rgba(52,211,153,0.2)"
                              : "1px solid rgba(239,68,68,0.2)",
                        }}
                      >
                        <span>{messageKind === "ok" ? "✓" : "⚠"}</span>
                        {message}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={generateBundle}
                      disabled={loading}
                      className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-40"
                      style={{
                        background: loading ? "rgba(255,255,255,0.08)" : channelConfig.gradient,
                        boxShadow: loading ? "none" : `0 4px 24px ${channelConfig.accent}40`,
                      }}
                    >
                      {loading ? (
                        <>
                          <SpinnerIcon />
                          Generando…
                        </>
                      ) : (
                        <>
                          <span className="text-base leading-none">⚡</span>
                          Generar con IA
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={saveBundle}
                      disabled={saving || !draft}
                      className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/80 transition-all hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {saving ? (
                        <>
                          <SpinnerIcon />
                          Guardando…
                        </>
                      ) : (
                        <>
                          <span className="text-base leading-none">↑</span>
                          Guardar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Meta tags row */}
                <div className="flex items-center gap-2 px-7 pb-4">
                  <MetaTag label="Fecha" value={selectedItem.fecha || "Sin fecha"} />
                  <MetaTag label="Tipo" value={studioSections?.kind || "social"} />
                  <MetaTag label="Estado" value={draft ? "Con bundle" : "Pendiente"} ready={!!draft} />
                </div>
              </div>

              {/* ── Scrollable content */}
              <div className="flex-1 overflow-y-auto px-7 py-7">
                {draft ? (
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    {/* ── Left column */}
                    <div className="space-y-6">
                      <EditorSection
                        label="01"
                        title="Copy principal"
                        subtitle="Texto base, estructura narrativa y llamada a la acción."
                        accentColor={channelConfig.accent}
                      >
                        <div className="space-y-4">
                          <EditableField
                            label="Headline"
                            value={draft.headline}
                            accentColor={channelConfig.accent}
                            onChange={(v) => setDraft({ ...draft, headline: v })}
                          />
                          <EditableArea
                            label="Caption"
                            value={draft.caption}
                            rows={6}
                            accentColor={channelConfig.accent}
                            onChange={(v) => setDraft({ ...draft, caption: v })}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <EditableArea
                              label="Copy corto"
                              value={draft.short_copy}
                              rows={4}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, short_copy: v })}
                            />
                            <EditableField
                              label="CTA"
                              value={draft.cta}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, cta: v })}
                            />
                          </div>
                          <EditableField
                            label="Hashtags"
                            value={hashtagsToText(draft.hashtags)}
                            accentColor={channelConfig.accent}
                            onChange={(v) => setDraft({ ...draft, hashtags: textToHashtags(v) })}
                            mono
                          />
                        </div>
                      </EditorSection>

                      {studioSections?.isVideo && (
                        <EditorSection
                          label="02"
                          title="Video"
                          subtitle="Hook y guion para producción audiovisual."
                          accentColor={channelConfig.accent}
                        >
                          <div className="space-y-4">
                            <EditableField
                              label="Hook de video"
                              value={draft.video_hook}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, video_hook: v })}
                            />
                            <EditableArea
                              label="Guion"
                              value={draft.video_script}
                              rows={11}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, video_script: v })}
                            />
                          </div>
                        </EditorSection>
                      )}

                      {studioSections?.isEmail && (
                        <EditorSection
                          label="02"
                          title="Email"
                          subtitle="Asunto, preheader y cuerpo del correo."
                          accentColor={channelConfig.accent}
                        >
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <EditableField
                                label="Asunto"
                                value={draft.email_subject}
                                accentColor={channelConfig.accent}
                                onChange={(v) => setDraft({ ...draft, email_subject: v })}
                              />
                              <EditableField
                                label="Preheader"
                                value={draft.email_preheader}
                                accentColor={channelConfig.accent}
                                onChange={(v) => setDraft({ ...draft, email_preheader: v })}
                              />
                            </div>
                            <EditableArea
                              label="Cuerpo (markdown)"
                              value={draft.email_body_markdown}
                              rows={12}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, email_body_markdown: v })}
                              mono
                            />
                          </div>
                        </EditorSection>
                      )}

                      {studioSections?.showImagePrompts && (
                        <EditorSection
                          label={studioSections.isVideo || studioSections.isEmail ? "03" : "02"}
                          title="Dirección visual"
                          subtitle="Guía estética y prompt base para generación de imágenes."
                          accentColor={channelConfig.accent}
                        >
                          <div className="space-y-4">
                            <EditableArea
                              label="Dirección visual"
                              value={draft.visual_direction}
                              rows={4}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, visual_direction: v })}
                            />
                            <EditableArea
                              label="Prompt base de imagen"
                              value={draft.image_prompt_base}
                              rows={6}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, image_prompt_base: v })}
                              mono
                            />
                          </div>
                        </EditorSection>
                      )}
                    </div>

                    {/* ── Right column */}
                    <div className="space-y-6">
                      {studioSections?.isBlog && (
                        <EditorSection
                          label="B"
                          title="Blog"
                          subtitle="Versión larga para publicación editorial."
                          accentColor={channelConfig.accent}
                        >
                          <div className="space-y-4">
                            <EditableField
                              label="Título del artículo"
                              value={draft.blog_title}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, blog_title: v })}
                            />
                            <EditableArea
                              label="Cuerpo (markdown)"
                              value={draft.blog_body_markdown}
                              rows={16}
                              accentColor={channelConfig.accent}
                              onChange={(v) => setDraft({ ...draft, blog_body_markdown: v })}
                              mono
                            />
                          </div>
                        </EditorSection>
                      )}

                      {studioSections?.isCarousel && (
                        <EditorSection
                          label="C"
                          title="Carrusel"
                          subtitle="Secuencia de slides editables."
                          accentColor={channelConfig.accent}
                        >
                          <div className="space-y-3">
                            {draft.carousel_slides.length === 0 ? (
                              <EmptyBox text="Genera el bundle para obtener la secuencia." />
                            ) : (
                              draft.carousel_slides.map((slide, index) => (
                                <div key={`slide-${index}`} className="relative">
                                  <div
                                    className="absolute left-0 top-6 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0d1522] text-[8px] font-bold text-white/40"
                                  >
                                    {index + 1}
                                  </div>
                                  <div className="ml-3">
                                    <EditableArea
                                      label={`Slide ${index + 1}`}
                                      value={slide}
                                      rows={3}
                                      accentColor={channelConfig.accent}
                                      onChange={(v) =>
                                        setDraft({
                                          ...draft,
                                          carousel_slides: draft.carousel_slides.map((e, i) =>
                                            i === index ? v : e,
                                          ),
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </EditorSection>
                      )}

                      {studioSections?.showImagePrompts ? (
                        <EditorSection
                          label="P"
                          title="Prompts de imagen"
                          subtitle={
                            draft.image_count > 1
                              ? `${draft.image_count} prompts para el carrusel.`
                              : "Prompt para pieza única."
                          }
                          accentColor={channelConfig.accent}
                        >
                          <div className="space-y-3">
                            {draft.image_prompts.length === 0 ? (
                              <EmptyBox text="Genera el bundle para obtener los prompts de imagen." />
                            ) : (
                              draft.image_prompts.map((prompt, index) => (
                                <EditableArea
                                  key={`prompt-${index}`}
                                  label={
                                    draft.image_count > 1
                                      ? `Prompt slide ${index + 1}`
                                      : "Prompt final"
                                  }
                                  value={prompt}
                                  rows={5}
                                  accentColor={channelConfig.accent}
                                  mono
                                  onChange={(v) =>
                                    setDraft({
                                      ...draft,
                                      image_prompts: draft.image_prompts.map((e, i) =>
                                        i === index ? v : e,
                                      ),
                                    })
                                  }
                                />
                              ))
                            )}
                          </div>
                        </EditorSection>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.015] p-6">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
                            Assets visuales
                          </p>
                          <p className="mt-2 text-sm leading-6 text-white/38">
                            Este ítem no requiere prompts visuales adicionales.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[400px] flex-col items-center justify-center">
                    <div
                      className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl text-2xl"
                      style={{ background: channelConfig.gradient }}
                    >
                      ⚡
                    </div>
                    <p className="text-base font-medium text-white/50">
                      Genera el bundle con IA para empezar a editar
                    </p>
                    <p className="mt-2 text-sm text-white/25">
                      El contenido aparecerá aquí listo para revisar y ajustar.
                    </p>
                    <button
                      type="button"
                      onClick={generateBundle}
                      disabled={loading}
                      className="mt-8 flex items-center gap-2 rounded-2xl px-7 py-3 text-sm font-semibold text-white transition-all disabled:opacity-40"
                      style={{ background: channelConfig.gradient }}
                    >
                      {loading ? <><SpinnerIcon /> Generando…</> : "Generar ahora"}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-white/30">No hay ítems en el calendario.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className="rounded-xl px-3.5 py-2.5"
      style={{
        background: accent ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.03)",
        border: accent ? "1px solid rgba(52,211,153,0.18)" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/28">{label}</p>
      <p
        className="mt-0.5 text-xl font-semibold tabular-nums"
        style={{ color: accent ? "#6ee7b7" : "rgba(255,255,255,0.85)" }}
      >
        {value}
      </p>
    </div>
  );
}

function MetaTag({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/25">
        {label}
      </span>
      <span className="text-[9px] text-white/10">·</span>
      {ready !== undefined && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: ready ? "#34d399" : "rgba(255,255,255,0.15)",
            boxShadow: ready ? "0 0 6px rgba(52,211,153,0.5)" : "none",
          }}
        />
      )}
      <span className="text-xs font-medium text-white/60">{value}</span>
    </div>
  );
}

function EditorSection({
  label,
  title,
  subtitle,
  accentColor,
  children,
}: {
  label: string;
  title: string;
  subtitle: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
      {/* Section header */}
      <div className="flex items-center gap-4 border-b border-white/[0.06] px-5 py-4">
        <span
          className="flex h-7 w-7 flex-none items-center justify-center rounded-xl text-[11px] font-bold text-white"
          style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}30` }}
        >
          {label}
        </span>
        <div>
          <p className="text-sm font-semibold text-white/80">{title}</p>
          <p className="text-[11px] text-white/30">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/8 bg-black/10 p-5 text-xs text-white/28">
      {text}
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  accentColor,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accentColor: string;
  mono?: boolean;
}) {
  return (
    <div className="group space-y-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28 transition-colors group-focus-within:text-white/50">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/85 outline-none transition-all placeholder:text-white/15 hover:border-white/14 focus:bg-white/[0.05]"
        style={{
          fontFamily: mono ? "'JetBrains Mono', 'Fira Code', monospace" : "inherit",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = `${accentColor}50`)}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
      />
    </div>
  );
}

function EditableArea({
  label,
  value,
  rows,
  onChange,
  accentColor,
  mono,
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (value: string) => void;
  accentColor: string;
  mono?: boolean;
}) {
  return (
    <div className="group space-y-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28 transition-colors group-focus-within:text-white/50">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-7 text-white/85 outline-none transition-all placeholder:text-white/15 hover:border-white/14 focus:bg-white/[0.05]"
        style={{
          fontFamily: mono ? "'JetBrains Mono', 'Fira Code', monospace" : "inherit",
          fontSize: mono ? "12px" : undefined,
          lineHeight: mono ? "1.8" : undefined,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = `${accentColor}50`)}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
      />
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}