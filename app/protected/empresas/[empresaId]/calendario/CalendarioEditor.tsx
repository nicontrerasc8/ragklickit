"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { updateCalendarioArtifact } from "@/app/protected/actions";
import {
  type CalendarioItem,
  makeDefaultCalendarioContent,
  normalizeCalendarioContent,
} from "@/lib/calendario/schema";

type Props = {
  empresaId: string;
  calendarioId: string;
  initialTitle: string;
  initialStatus: string;
  initialContent: unknown;
};

const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function parseYearMonth(periodo: string) {
  const match = periodo.match(/^(\d{4})-(\d{2})/);
  if (!match) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  return { year: Number.parseInt(match[1], 10), month: Number.parseInt(match[2], 10) };
}

function formatPeriodLabel(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatDayLabel(date: string) {
  const d = new Date(date + "T00:00:00Z");
  return d.toLocaleString("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function monthDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function monthGridDates(year: number, month: number) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayIndex = (firstDay.getUTCDay() + 6) % 7;
  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push({ date: null, day: null });
  for (let day = 1; day <= lastDay; day++) cells.push({ date: monthDate(year, month, day), day });
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}

function weekFromDate(date: string) {
  const day = Number.parseInt(date.slice(8, 10), 10);
  if (day >= 22) return 4; if (day >= 15) return 3; if (day >= 8) return 2; return 1;
}

// ─── Channel + status styles ──────────────────────────────────────────────────

const CHANNEL_STYLES: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  Instagram:         { dot: "#f472b6", bg: "rgba(244,114,182,0.12)", text: "rgba(253,207,232,0.92)", border: "rgba(244,114,182,0.2)"  },
  Facebook:          { dot: "#60a5fa", bg: "rgba(96,165,250,0.12)",  text: "rgba(207,227,253,0.92)", border: "rgba(96,165,250,0.2)"   },
  LinkedIn:          { dot: "#38bdf8", bg: "rgba(56,189,248,0.12)",  text: "rgba(207,239,253,0.92)", border: "rgba(56,189,248,0.2)"   },
  TikTok:            { dot: "#e879f9", bg: "rgba(232,121,249,0.12)", text: "rgba(250,207,254,0.92)", border: "rgba(232,121,249,0.2)"  },
  YouTube:           { dot: "#f87171", bg: "rgba(248,113,113,0.12)", text: "rgba(254,207,207,0.92)", border: "rgba(248,113,113,0.2)"  },
  WhatsApp:          { dot: "#34d399", bg: "rgba(52,211,153,0.12)",  text: "rgba(209,250,229,0.92)", border: "rgba(52,211,153,0.2)"   },
  Blog:              { dot: "#fbbf24", bg: "rgba(251,191,36,0.12)",  text: "rgba(254,240,207,0.92)", border: "rgba(251,191,36,0.2)"   },
  "Marketing Email": { dot: "#a78bfa", bg: "rgba(167,139,250,0.12)", text: "rgba(237,233,254,0.92)", border: "rgba(167,139,250,0.2)"  },
};

function getStyle(canal: string) {
  return CHANNEL_STYLES[canal] ?? {
    dot: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)",
    text: "rgba(255,255,255,0.75)", border: "rgba(255,255,255,0.12)",
  };
}

const CANALES  = ["Instagram","Facebook","LinkedIn","TikTok","YouTube","WhatsApp","Blog","Marketing Email"];
const FORMATOS = ["Post","Reel","Story","Carrusel","Video","Artículo","Email","Newsletter"];
const ESTADOS: Array<CalendarioItem["estado"]> = ["planificado","en_proceso","listo","publicado"];

const ESTADO_STYLES: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  planificado: { color: "rgba(148,163,184,0.85)", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.18)", dot: "#64748b" },
  en_proceso:  { color: "rgba(251,191,36,0.9)",   bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.22)",  dot: "#f59e0b" },
  listo:       { color: "rgba(52,211,153,0.9)",   bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.22)",  dot: "#10b981" },
  publicado:   { color: "rgba(167,139,250,0.9)",  bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.22)", dot: "#8b5cf6" },
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.82)",
  fontSize: 12,
  padding: "8px 11px",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: 6 }}>
      {children}
    </p>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      borderRadius: 999, padding: "9px 22px", fontSize: 13, fontWeight: 600,
      background: pending ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)",
      color: pending ? "rgba(255,255,255,0.4)" : "#080c12",
      border: "none", cursor: pending ? "not-allowed" : "pointer", transition: "all 0.15s",
    }}>
      {pending ? (
        <>
          <span style={{ display: "inline-block", width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.6)", animation: "spin 0.7s linear infinite" }} />
          Guardando…
        </>
      ) : "Guardar cambios"}
    </button>
  );
}

// ─── Item card inside DayModal ────────────────────────────────────────────────

function ItemCard({ empresaId, calendarioId, item, onUpdate, onRemove }: {
  empresaId: string;
  calendarioId: string;
  item: CalendarioItem;
  onUpdate: (id: string, patch: Partial<CalendarioItem>) => void;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const s  = getStyle(item.canal);
  const es = ESTADO_STYLES[item.estado] ?? ESTADO_STYLES.planificado;
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)", overflow: "hidden" }}>
      {/* channel bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${s.dot}cc 0%, ${s.dot}20 100%)` }} />

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Badges row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, border: `1px solid ${s.border}`, background: s.bg, color: s.text, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block", flexShrink: 0 }} />
            {item.canal}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 8, border: `1px solid ${es.border}`, background: es.bg, color: es.color, padding: "4px 10px", fontSize: 11, fontWeight: 500 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: es.dot, display: "inline-block" }} />
            {item.estado.replace("_", " ")}
          </span>
        </div>

        {/* Title */}
        <div>
          <FieldLabel>Título</FieldLabel>
          <input value={item.titulo_base} onChange={(e) => onUpdate(item.id, { titulo_base: e.target.value })} placeholder="Título del contenido" style={inputBase} />
        </div>

        {/* Canal + Formato */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <FieldLabel>Canal</FieldLabel>
            <select value={item.canal} onChange={(e) => onUpdate(item.id, { canal: e.target.value })} style={{ ...inputBase, appearance: "none" as const, cursor: "pointer" }}>
              {CANALES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Formato</FieldLabel>
            <select value={item.formato} onChange={(e) => onUpdate(item.id, { formato: e.target.value })} style={{ ...inputBase, appearance: "none" as const, cursor: "pointer" }}>
              {FORMATOS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Objetivo */}
        <div>
          <FieldLabel>Objetivo</FieldLabel>
          <input value={item.objetivo_contenido} onChange={(e) => onUpdate(item.id, { objetivo_contenido: e.target.value })} placeholder="Objetivo del contenido" style={inputBase} />
        </div>

        {/* CTA */}
        <div>
          <FieldLabel>CTA</FieldLabel>
          <input value={item.CTA} onChange={(e) => onUpdate(item.id, { CTA: e.target.value })} placeholder="Call to action" style={inputBase} />
        </div>

        <button
          type="button"
          onClick={() => router.push(`/protected/empresas/${empresaId}/calendario/${calendarioId}/studio?item=${encodeURIComponent(item.id)}`)}
          style={{
            borderRadius: 12,
            border: "1px solid rgba(56,189,248,0.22)",
            background: "rgba(56,189,248,0.08)",
            color: "rgba(125,211,252,0.92)",
            padding: "9px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "center",
          }}
        >
          Crear contenido con IA
        </button>

        {/* Expandable extra fields */}
        <button type="button" onClick={() => setExpanded((x) => !x)} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.28)", fontSize: 11, fontWeight: 500,
          textAlign: "left", padding: 0,
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "inherit",
        }}>
          <span style={{ fontSize: 9, display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
          {expanded ? "Ocultar campos adicionales" : "Ver campos adicionales"}
        </button>

        {expanded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Pilar", key: "pilar" as const, ph: "Pilar de contenido" },
              { label: "Tema", key: "tema" as const, ph: "Tema" },
              { label: "Mensaje clave", key: "mensaje_clave" as const, ph: "Mensaje principal" },
              { label: "Buyer Persona", key: "buyer_persona" as const, ph: "Buyer persona" },
            ].map(({ label, key, ph }) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <input value={item[key] as string} onChange={(e) => onUpdate(item.id, { [key]: e.target.value })} placeholder={ph} style={inputBase} />
              </div>
            ))}
          </div>
        )}

        {/* Footer: estado select + delete */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 2 }}>
          <div>
            <FieldLabel>Estado</FieldLabel>
            <select value={item.estado} onChange={(e) => onUpdate(item.id, { estado: e.target.value as CalendarioItem["estado"] })}
              style={{ ...inputBase, width: "auto", appearance: "none" as const, cursor: "pointer", fontSize: 11, padding: "6px 10px" }}>
              {ESTADOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => onRemove(item.id)} style={{
            borderRadius: 10, border: "1px solid rgba(239,68,68,0.18)", background: "rgba(239,68,68,0.05)",
            color: "rgba(239,68,68,0.55)", padding: "6px 12px", fontSize: 11, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
          }}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Day popup modal ──────────────────────────────────────────────────────────

function DayModal({ empresaId, calendarioId, date, items, onClose, onAdd, onUpdate, onRemove }: {
  empresaId: string;
  calendarioId: string;
  date: string;
  items: CalendarioItem[];
  onClose: () => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<CalendarioItem>) => void;
  onRemove: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(4,6,12,0.88)", backdropFilter: "blur(10px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: "relative", width: "100%", maxWidth: 900, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        borderRadius: 24, border: "1px solid rgba(255,255,255,0.09)",
        background: "linear-gradient(160deg, rgba(12,15,24,0.99) 0%, rgba(8,10,18,0.99) 100%)",
        overflow: "hidden",
      }}>
        {/* Accent line */}
        <div style={{ position: "absolute", left: 0, top: 0, height: 2, width: "100%", background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.8) 25%, rgba(139,92,246,0.55) 70%, transparent)" }} />
        {/* Ambient glow */}
        <div style={{ position: "absolute", right: -80, top: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />

        {/* Header */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "22px 28px 18px" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(56,189,248,0.55)", marginBottom: 6 }}>Actividades del día</p>
            <h3 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.95)", textTransform: "capitalize", margin: 0 }}>{formatDayLabel(date)}</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>{items.length} evento{items.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4, flexShrink: 0 }}>
            <button type="button" onClick={onAdd} style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              borderRadius: 999, border: "1px solid rgba(139,92,246,0.28)", background: "rgba(139,92,246,0.08)", color: "rgba(196,181,253,0.9)",
              padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nuevo evento
            </button>
            <button type="button" onClick={onClose} aria-label="Cerrar" style={{
              width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, fontFamily: "inherit",
            }}>✕</button>
          </div>
        </div>

        {/* Channel legend strip */}
        <div style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", gap: "6px 18px", padding: "10px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
          {Object.entries(CHANNEL_STYLES).map(([canal, st]) => (
            <span key={canal} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, display: "inline-block", flexShrink: 0 }} />{canal}
            </span>
          ))}
        </div>

        {/* Scrollable items grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>
          {items.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, borderRadius: 18, border: "1px dashed rgba(255,255,255,0.07)", padding: "64px 24px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)" }} />
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.28)", margin: 0 }}>Sin eventos para este día</p>
              <button type="button" onClick={onAdd} style={{ background: "none", border: "none", color: "rgba(56,189,248,0.65)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                + Agregar el primero
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  empresaId={empresaId}
                  calendarioId={calendarioId}
                  item={item}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.055)", padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0 }}>
            Clic fuera del modal o{" "}
            <kbd style={{ borderRadius: 5, border: "1px solid rgba(255,255,255,0.1)", padding: "2px 6px", fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Esc</kbd>{" "}
            para cerrar
          </p>
          <button type="button" onClick={onClose} style={{
            borderRadius: 999, border: "1px solid rgba(255,255,255,0.09)", background: "transparent",
            color: "rgba(255,255,255,0.35)", padding: "6px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}>Cerrar</button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CalendarioEditor(props: Props) {
  const router = useRouter();
  const [title, setTitle]   = useState(props.initialTitle || "Calendario editorial");
  const [status, setStatus] = useState(props.initialStatus || "plan");

  const [content, setContent] = useState(() => {
    const seed = makeDefaultCalendarioContent();
    return normalizeCalendarioContent(props.initialContent, seed);
  });

  const { year, month } = useMemo(() => parseYearMonth(content.periodo), [content.periodo]);
  const [popupDate, setPopupDate] = useState<string | null>(null);

  const gridCells = useMemo(() => monthGridDates(year, month), [year, month]);
  const items = content.calendario.items;

  const today    = new Date();
  const todayStr = monthDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarioItem[]>();
    items.forEach((item) => {
      if (!item.fecha) return;
      const arr = map.get(item.fecha) ?? [];
      arr.push(item);
      map.set(item.fecha, arr);
    });
    return map;
  }, [items]);

  const popupItems = popupDate ? (itemsByDate.get(popupDate) ?? []) : [];
  const serialized = useMemo(() => JSON.stringify(normalizeCalendarioContent(content, content)), [content]);

  const updateItem = (id: string, patch: Partial<CalendarioItem>) => {
    setContent((prev) => {
      const nextItems = prev.calendario.items.map((item) => item.id === id ? { ...item, ...patch } : item);
      return normalizeCalendarioContent({ ...prev, calendario: { ...prev.calendario, items: nextItems } }, prev);
    });
  };

  const removeItem = (id: string) => {
    setContent((prev) =>
      normalizeCalendarioContent(
        { ...prev, calendario: { ...prev.calendario, items: prev.calendario.items.filter((i) => i.id !== id) } },
        prev,
      ),
    );
  };

  const addItemForDate = (date: string) => {
    const newItem: CalendarioItem = {
      id: `EV-${Date.now()}`,
      canal: "Instagram",
      semana: weekFromDate(date),
      orden_semana: (itemsByDate.get(date)?.length ?? 0) + 1,
      fecha: date,
      pilar: "General",
      tema: "", subtema: "",
      buyer_persona: "Buyer Persona General",
      objetivo_contenido: "",
      formato: "Post",
      titulo_base: "",
      CTA: "", mensaje_clave: "",
      hashtags: [],
      restricciones_aplicadas: { frases_prohibidas: [], disclaimers: [] },
      estado: "planificado",
    };
    setContent((prev) =>
      normalizeCalendarioContent(
        { ...prev, calendario: { ...prev.calendario, items: [...prev.calendario.items, newItem] } },
        prev,
      ),
    );
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .fc-input:focus { border-color: rgba(56,189,248,0.38) !important; background: rgba(255,255,255,0.06) !important; }
        .fc-input::placeholder { color: rgba(255,255,255,0.18); }
        .fc-select option { background: #0c0f18; color: #fff; }
        .day-cell:hover { background: rgba(255,255,255,0.02) !important; }
        .add-hover { opacity: 0; transition: opacity 0.15s; }
        .day-cell:hover .add-hover { opacity: 1; }
        .ev-pill { transition: transform 0.1s, filter 0.1s; }
        .ev-pill:hover { transform: translateY(-1px); filter: brightness(1.12); }
      `}</style>

      {popupDate && (
        <DayModal
          empresaId={props.empresaId}
          calendarioId={props.calendarioId}
          date={popupDate}
          items={popupItems}
          onClose={() => setPopupDate(null)}
          onAdd={() => addItemForDate(popupDate)}
          onUpdate={updateItem}
          onRemove={removeItem}
        />
      )}

      <form
        action={async (fd) => { await updateCalendarioArtifact(fd); router.refresh(); }}
        style={{ display: "flex", flexDirection: "column", gap: 24 }}
      >
        <input type="hidden" name="empresa_id"    value={props.empresaId} />
        <input type="hidden" name="calendario_id" value={props.calendarioId} />
        <input type="hidden" name="content"       value={serialized} />

        {/* Meta strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {([
            { label: "Título",   el: <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="fc-input" style={{ ...inputBase, fontSize: 13, padding: "10px 14px", borderRadius: 12 }} /> },
            { label: "Estado",   el: <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} required className="fc-select" style={{ ...inputBase, fontSize: 13, padding: "10px 14px", borderRadius: 12, appearance: "none" as const, cursor: "pointer" }}><option value="plan">Plan</option><option value="revision">Revisión</option><option value="aprobado">Aprobado</option></select> },
            { label: "Periodo",  el: <input value={content.periodo} onChange={(e) => setContent((p) => normalizeCalendarioContent({ ...p, periodo: e.target.value }, p))} placeholder="YYYY-MM-01" className="fc-input" style={{ ...inputBase, fontSize: 13, padding: "10px 14px", borderRadius: 12 }} /> },
          ] as { label: string; el: React.ReactNode }[]).map(({ label, el }) => (
            <div key={label}>
              <FieldLabel>{label}</FieldLabel>
              {el}
            </div>
          ))}
        </div>

        {/* Calendar board */}
        <div style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden", background: "rgba(8,10,16,0.9)", width: "100%" }}>

          {/* Month header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.055)", padding: "16px 22px", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.025em", color: "rgba(255,255,255,0.92)", textTransform: "capitalize", margin: 0 }}>
                {formatPeriodLabel(year, month)}
              </h2>
              <span style={{ borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 500, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "rgba(56,189,248,0.7)" }}>
                {items.length} evento{items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px 16px" }}>
              {["Instagram","Facebook","LinkedIn","TikTok","YouTube","Blog","WhatsApp","Marketing Email"].map((c) => (
                <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: getStyle(c).dot, display: "inline-block", flexShrink: 0 }} />{c}
                </span>
              ))}
            </div>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {WEEK_DAYS.map((d) => (
              <div key={d} style={{ padding: "12px 0", textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {gridCells.map((cell, idx) => {
              const isToday  = cell.date === todayStr;
              const dayItems = cell.date ? (itemsByDate.get(cell.date) ?? []) : [];
              const isPast   = cell.date ? new Date(cell.date) < new Date(todayStr) : false;

              return (
                <div
                  key={`${cell.date ?? "empty"}-${idx}`}
                  onClick={() => { if (cell.date) setPopupDate(cell.date); }}
                  className={cell.date ? "day-cell" : ""}
                  style={{
                    boxSizing: "border-box",
                    position: "relative",
                    minHeight: 160,
                    borderRight: "1px solid rgba(255,255,255,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: cell.date ? "pointer" : "default",
                    background: !cell.date ? "rgba(0,0,0,0.1)" : isToday ? "rgba(56,189,248,0.03)" : "transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "10px 8px 8px",
                    transition: "background 0.12s",
                    userSelect: "none",
                    overflow: "hidden",
                  }}
                >
                  {cell.day !== null && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: "50%",
                          fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                          background: isToday ? "rgba(56,189,248,0.85)" : "transparent",
                          color: isToday ? "#080c12" : isPast ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.65)",
                          transition: "color 0.12s",
                        }}>
                          {cell.day}
                        </span>
                        <button
                          type="button"
                          className="add-hover"
                          onClick={(e) => { e.stopPropagation(); if (cell.date) { addItemForDate(cell.date); setPopupDate(cell.date); } }}
                          style={{ width: 22, height: 22, borderRadius: 7, border: "1px solid rgba(56,189,248,0.22)", background: "rgba(56,189,248,0.1)", color: "rgba(56,189,248,0.7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}
                        >+</button>
                      </div>

                      {/* Evento pills */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {dayItems.slice(0, 4).map((item) => {
                          const s = getStyle(item.canal);
                          return (
                            <div key={item.id} className="ev-pill" style={{
                              display: "flex", alignItems: "center", gap: 6,
                              borderRadius: 7, padding: "5px 8px",
                              fontSize: 11, fontWeight: 500,
                              background: s.bg, color: s.text, border: `1px solid ${s.border}`,
                              overflow: "hidden", cursor: "pointer",
                            }} title={`${item.canal}: ${item.titulo_base || item.tema || "Sin título"}`}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.titulo_base || item.tema || item.canal}
                              </span>
                            </div>
                          );
                        })}
                        {dayItems.length > 4 && (
                          <p style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.28)", paddingLeft: 8, margin: 0 }}>
                            +{dayItems.length - 4} más
                          </p>
                        )}
                      </div>

                      {dayItems.length > 0 && (
                        <button type="button" className="add-hover" onClick={(e) => { e.stopPropagation(); if (cell.date) { addItemForDate(cell.date); setPopupDate(cell.date); } }}
                          style={{ marginTop: "auto", width: "100%", borderRadius: 7, border: "1px dashed rgba(255,255,255,0.07)", background: "transparent", color: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 500, padding: "4px 0", cursor: "pointer", fontFamily: "inherit" }}>
                          + añadir
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Save bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 20, gap: 12, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", margin: 0 }}>
            {items.length} evento{items.length !== 1 ? "s" : ""} en total · haz clic en un día para editar
          </p>
          <SaveButton />
        </div>
      </form>
    </>
  );
}
