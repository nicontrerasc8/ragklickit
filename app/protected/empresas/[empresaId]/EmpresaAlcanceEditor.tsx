"use client";

import { useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

import { updateEmpresa } from "./actions";

type Empresa = {
  id: string;
  nombre: string;
  industria: string | null;
  pais: string | null;
  metadata_json?: unknown;
};

type Props = {
  empresa: Empresa;
};

const ALCANCE_CHANNELS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "Marketing Email",
  "Blog",
  "WhatsApp",
] as const;

function clampCount(value: unknown) {
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(10, Math.trunc(numeric)));
}

function normalizeChannelName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildDefaultAlcance() {
  return Object.fromEntries(ALCANCE_CHANNELS.map((channel) => [channel, 0])) as Record<string, number>;
}

function extractAlcance(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return buildDefaultAlcance();

  const metadataRecord = metadata as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(metadataRecord, "alcance_calendario")) {
    return buildDefaultAlcance();
  }

  const raw = metadataRecord.alcance_calendario;
  if (!raw || typeof raw !== "object") return {};

  const alcance: Record<string, number> = {};

  for (const [channelRaw, value] of Object.entries(raw as Record<string, unknown>)) {
    const channel = normalizeChannelName(channelRaw);
    if (!channel) continue;
    alcance[channel] = clampCount(value);
  }

  return alcance;
}

function buildAlcanceJson(alcance: Record<string, number>) {
  const payload = Object.fromEntries(Object.entries(alcance).filter(([, count]) => count > 0));
  return JSON.stringify({ alcance_calendario: payload }, null, 2);
}

export default function EmpresaAlcanceEditor({ empresa }: Props) {
  const initialAlcance = useMemo(() => extractAlcance(empresa.metadata_json), [empresa.metadata_json]);
  const [alcanceByChannel, setAlcanceByChannel] = useState<Record<string, number>>(initialAlcance);
  const [alcanceJsonText, setAlcanceJsonText] = useState(() =>
    buildAlcanceJson(initialAlcance),
  );
  const [newChannel, setNewChannel] = useState("");
  const totalAlcance = useMemo(
    () => Object.values(alcanceByChannel).reduce((acc, value) => acc + value, 0),
    [alcanceByChannel],
  );
  const sortedChannels = useMemo(() => {
    const preferred = new Set(ALCANCE_CHANNELS);
    return Object.keys(alcanceByChannel).sort((a, b) => {
      const aPreferred = preferred.has(a as (typeof ALCANCE_CHANNELS)[number]);
      const bPreferred = preferred.has(b as (typeof ALCANCE_CHANNELS)[number]);
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      return a.localeCompare(b, "es");
    });
  }, [alcanceByChannel]);

  const syncAlcance = (next: Record<string, number>) => {
    setAlcanceByChannel(next);
    setAlcanceJsonText(buildAlcanceJson(next));
  };

  const addChannel = () => {
    const normalized = normalizeChannelName(newChannel);
    if (!normalized || alcanceByChannel[normalized] !== undefined) {
      return;
    }

    syncAlcance({
      ...alcanceByChannel,
      [normalized]: 0,
    });
    setNewChannel("");
  };

  const removeChannel = (channel: string) => {
    const next = { ...alcanceByChannel };
    delete next[channel];
    syncAlcance(next);
  };

  return (
    <section className="rounded-lg border p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Alcance de calendario</h2>
        <p className="text-sm text-muted-foreground">
          Define cuantas piezas por canal necesita esta empresa. Se guarda en JSON.
        </p>
      </div>

      <form action={updateEmpresa} className="space-y-4">
        <input type="hidden" name="empresa_id" value={empresa.id} />
        <input type="hidden" name="nombre" value={empresa.nombre} />
        <input type="hidden" name="industria" value={empresa.industria ?? ""} />
        <input type="hidden" name="pais" value={empresa.pais ?? ""} />
        <input type="hidden" name="alcance_calendario_json" value={alcanceJsonText} />

        <div className="rounded-xl border border-indigo-400/20 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-indigo-200/90">
              Alcance del calendario
            </label>
            <span className="text-[11px] text-muted-foreground">{totalAlcance} piezas totales</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ajusta piezas por canal (maximo 10 por canal).
          </p>
          <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:flex-row">
            <input
              value={newChannel}
              onChange={(event) => setNewChannel(event.target.value)}
              placeholder="Nuevo canal, por ejemplo Pinterest"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none transition focus:border-indigo-400/40"
            />
            <button
              type="button"
              onClick={addChannel}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/20"
            >
              <Plus size={14} />
              Agregar canal
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sortedChannels.map((channel) => {
              const value = alcanceByChannel[channel] ?? 0;
              return (
                <div key={channel} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-foreground/80">{channel}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-200">{value}</span>
                      <button
                        type="button"
                        onClick={() => removeChannel(channel)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-red-300"
                        aria-label={`Quitar ${channel}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={value}
                    onChange={(e) => {
                      const next = {
                        ...alcanceByChannel,
                        [channel]: clampCount(e.target.value),
                      };
                      syncAlcance(next);
                    }}
                    className="w-full accent-indigo-400"
                  />
                </div>
              );
            })}
          </div>

         
        </div>

        <div className="flex justify-end border-t pt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            <Save size={13} />
            Guardar alcance
          </button>
        </div>
      </form>
    </section>
  );
}
