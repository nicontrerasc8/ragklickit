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

export default function CalendarioContentStudio({
  empresaId,
  calendarioId,
  initialItems,
  initialSelectedId,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(
    initialItems.find((item) => item.id === initialSelectedId)?.id ?? initialItems[0]?.id ?? "",
  );
  const [draft, setDraft] = useState<CalendarioItemAssetBundle | null>(
    initialItems.find((item) => item.id === initialSelectedId)?.asset_bundle ?? initialItems[0]?.asset_bundle ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

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
      const data = (await response.json()) as { error?: string; bundle?: CalendarioItemAssetBundle };
      if (!response.ok || !data.bundle) {
        throw new Error(data.error || "No se pudo generar el bundle.");
      }
      setDraft(data.bundle);
      setMessage("Bundle generado. Revisa textos y prompts visuales antes de guardar.");
    } catch (error) {
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
      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar.");
      }

      setItems((current) =>
        current.map((item) => (item.id === selectedItem.id ? { ...item, asset_bundle: draft } : item)),
      );
      setMessage("Bundle guardado en el calendario.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error guardando bundle.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
          Items del calendario
        </p>
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                selectedId === item.id
                  ? "border-sky-400/30 bg-sky-400/10"
                  : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <p className="text-xs text-white/35">{item.canal} · {item.formato}</p>
              <p className="mt-1 text-sm font-medium text-white/85">
                {item.titulo_base || item.tema || "Sin titulo"}
              </p>
              <p className="mt-1 text-xs text-white/30">{item.fecha || "Sin fecha"}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        {selectedItem ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 border-b border-white/8 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Studio de contenido
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-white/95">
                  {selectedItem.titulo_base || selectedItem.tema || selectedItem.canal}
                </h1>
                <p className="mt-1 text-sm text-white/40">
                  {selectedItem.canal} · {selectedItem.formato} · {selectedItem.fecha || "Sin fecha"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateBundle}
                  disabled={loading}
                  className="rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-sky-400 disabled:opacity-50"
                >
                  {loading ? "Generando..." : "Generar con IA"}
                </button>
                <button
                  type="button"
                  onClick={saveBundle}
                  disabled={saving || !draft}
                  className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar bundle"}
                </button>
              </div>
            </div>

            {message ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/70">
                {message}
              </div>
            ) : null}

            {draft ? (
              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <EditableField label="Headline" value={draft.headline} onChange={(value) => setDraft({ ...draft, headline: value })} />
                  <EditableArea label="Caption" value={draft.caption} rows={5} onChange={(value) => setDraft({ ...draft, caption: value })} />
                  <EditableArea label="Copy corto" value={draft.short_copy} rows={4} onChange={(value) => setDraft({ ...draft, short_copy: value })} />
                  <EditableField label="CTA" value={draft.cta} onChange={(value) => setDraft({ ...draft, cta: value })} />
                  <EditableField
                    label="Hashtags"
                    value={hashtagsToText(draft.hashtags)}
                    onChange={(value) => setDraft({ ...draft, hashtags: textToHashtags(value) })}
                  />
                  <EditableArea
                    label="Direccion visual"
                    value={draft.visual_direction}
                    rows={4}
                    onChange={(value) => setDraft({ ...draft, visual_direction: value })}
                  />
                  <EditableArea
                    label="Prompt base de imagen"
                    value={draft.image_prompt_base}
                    rows={6}
                    onChange={(value) => setDraft({ ...draft, image_prompt_base: value })}
                  />
                </div>

                <div className="space-y-4">
                  <EditableField
                    label="Titulo blog"
                    value={draft.blog_title}
                    onChange={(value) => setDraft({ ...draft, blog_title: value })}
                  />
                  <EditableArea
                    label="Cuerpo blog markdown"
                    value={draft.blog_body_markdown}
                    rows={14}
                    onChange={(value) => setDraft({ ...draft, blog_body_markdown: value })}
                  />

                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
                      Prompts para generar imagenes
                    </p>
                    <p className="mt-2 text-sm text-white/45">
                      {draft.image_count > 1
                        ? `${draft.image_count} prompts listos para un carrusel.`
                        : "1 prompt listo para una pieza unica."}
                    </p>
                    <div className="mt-4 space-y-3">
                      {draft.image_prompts.map((prompt, index) => (
                        <EditableArea
                          key={`prompt-${index}`}
                          label={draft.image_count > 1 ? `Prompt slide ${index + 1}` : "Prompt final"}
                          value={prompt}
                          rows={6}
                          onChange={(value) =>
                            setDraft({
                              ...draft,
                              image_prompts: draft.image_prompts.map((entry, entryIndex) =>
                                entryIndex === index ? value : entry,
                              ),
                            })
                          }
                        />
                      ))}
                      {!draft.image_prompts.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/35">
                          Genera el bundle para obtener los prompts de imagen.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-white/40">
                Selecciona un item y genera el contenido para previsualizarlo.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-white/40">
            No hay items en el calendario.
          </div>
        )}
      </section>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/85 outline-none transition focus:border-sky-400/35"
      />
    </div>
  );
}

function EditableArea({
  label,
  value,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/85 outline-none transition focus:border-sky-400/35"
      />
    </div>
  );
}
