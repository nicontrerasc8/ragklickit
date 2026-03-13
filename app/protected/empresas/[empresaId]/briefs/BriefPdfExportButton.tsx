"use client";

import { pdf, Document, Page, Text, View, StyleSheet, Canvas } from "@react-pdf/renderer";

import { BRIEF_OBJECTIVE_GROUPS, BRIEF_TEXT_FIELDS, loadBriefForm } from "@/lib/brief/schema";

type Props = {
  empresaNombre: string;
  periodo: string;
  estado: string;
  version: number;
  data: unknown;
  className?: string;
};

// ── Palette (mirrors the app's CSS) ──────────────────────────────────────────
const C = {
  ink:         "#0c0c0f",
  forest:      "#0a261c",
  forestMid:   "#0e3a2a",
  emerald:     "#059660",   // emerald-600
  emeraldSoft: "#10b981",   // emerald-500
  teal:        "#14b8a6",
  amber:       "#f59e0b",
  white:       "#ffffff",
  offwhite:    "#dcf5eb",
  muted:       "#6ba082",
  mutedDark:   "#375040",
  divider:     "#122d20",
  cardBg:      "#0c1c16",
  cardBorder:  "#163244",
  text:        "#e8f5ee",
  textDim:     "#8eaF9a",
  textFaint:   "#4d7060",
};

function formatPeriodo(periodo: string): string {
  if (!periodo) return "-";
  const [year, month] = periodo.split("-");
  const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${months[parseInt(month, 10) - 1] ?? month} ${year}`;
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "brief";
}

function normalizeText(value: string): string {
  return value.replace(/[ \t\u00A0]+/g, " ").trim();
}

function statusColor(estado: string): string {
  switch (estado.toLowerCase()) {
    case "aprobado": return C.teal;
    case "plan":     return "#67e8f9";  // cyan-300
    case "borrador": return C.amber;
    case "revision": return "#7dd3fc";  // sky-300
    default:         return C.muted;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    backgroundColor: C.ink,
    paddingTop: 0,
    paddingBottom: 32,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.text,
  },

  // ── Cover band at top ──
  coverBand: {
    backgroundColor: C.forest,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 32,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.forestMid,
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 4,
    height: "100%",
    backgroundColor: C.emerald,
  },
  eyebrow: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.emeraldSoft,
    letterSpacing: 2,
    marginBottom: 8,
  },
  companyName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  metaPill: {
    backgroundColor: C.forestMid,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaPillLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.emeraldSoft,
    letterSpacing: 1,
  },
  metaPillValue: {
    fontSize: 7,
    color: C.offwhite,
  },
  statusPill: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
  },

  // ── Body ──
  body: {
    paddingHorizontal: 32,
  },

  // ── Section ──
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    gap: 8,
  },
  sectionBadge: {
    backgroundColor: C.emerald,
    borderRadius: 3,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.offwhite,
    letterSpacing: 1,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: C.forestMid,
    marginBottom: 12,
    marginTop: 4,
  },

  // ── Objective group ──
  groupBlock: {
    marginBottom: 14,
    backgroundColor: C.cardBg,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: C.divider,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.forestMid,
    borderBottomWidth: 0.5,
    borderBottomColor: C.divider,
  },
  groupTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
  },
  groupBadge: {
    backgroundColor: C.forest,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  groupBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.emeraldSoft,
  },
  groupBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listSubLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.textFaint,
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
    gap: 6,
  },
  itemDot: {
    width: 10,
    height: 10,
    backgroundColor: C.forestMid,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  itemDotText: {
    fontSize: 5,
    fontFamily: "Helvetica-Bold",
    color: C.emeraldSoft,
  },
  itemText: {
    flex: 1,
    fontSize: 9,
    color: C.text,
    lineHeight: 1.4,
  },
  itemTextMuted: {
    flex: 1,
    fontSize: 9,
    color: C.textFaint,
    lineHeight: 1.4,
  },
  itemDotMuted: {
    width: 10,
    height: 10,
    borderWidth: 0.5,
    borderColor: C.divider,
    borderRadius: 2,
    marginTop: 1,
  },

  // ── Field block ──
  fieldBlock: {
    backgroundColor: C.cardBg,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: C.divider,
    marginBottom: 8,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.divider,
  },
  fieldIndexBadge: {
    backgroundColor: C.forestMid,
    borderRadius: 3,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldIndexText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.emeraldSoft,
  },
  fieldLabel: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    lineHeight: 1.3,
  },
  fieldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.emerald,
  },
  fieldBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldAnswer: {
    fontSize: 9,
    color: C.text,
    lineHeight: 1.5,
  },
  fieldAnswerEmpty: {
    fontSize: 9,
    color: C.textFaint,
    fontFamily: "Helvetica-Oblique",
  },

  // ── Strategic changes ──
  strategicBlock: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 0.5,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 2,
  },
  strategicLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  strategicAnswer: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  strategicEmpty: {
    fontSize: 10,
    color: C.textFaint,
    fontFamily: "Helvetica-Oblique",
  },

  // ── Footer ──
  footer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    fontSize: 7,
    color: C.textFaint,
  },
});

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ num, title }: { num: string; title: string }) {
  return (
    <View style={{ marginBottom: 2 }}>
      <View style={s.sectionHeader}>
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{num}</Text>
        </View>
        <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
      </View>
      <View style={s.sectionDivider} />
    </View>
  );
}

function ObjectiveGroup({ group, form }: {
  group: typeof BRIEF_OBJECTIVE_GROUPS[number];
  form: ReturnType<typeof loadBriefForm>;
}) {
  const selected = group.options.filter((o) => form.objectives[group.id]?.[o]);
  const notSelected = group.options.filter((o) => !form.objectives[group.id]?.[o]);

  return (
    <View style={s.groupBlock}>
      <View style={s.groupHeader}>
        <Text style={s.groupTitle}>{group.title}</Text>
        <View style={s.groupBadge}>
          <Text style={s.groupBadgeText}>{selected.length} seleccionados</Text>
        </View>
      </View>
      <View style={s.groupBody}>
        {selected.length > 0 && (
          <View>
            <Text style={s.listSubLabel}>MARCADOS</Text>
            {selected.map((item) => (
              <View key={item} style={s.itemRow}>
                <View style={s.itemDot}>
                  <Text style={s.itemDotText}>✓</Text>
                </View>
                <Text style={s.itemText}>{normalizeText(item)}</Text>
              </View>
            ))}
          </View>
        )}
        {notSelected.length > 0 && (
          <View style={{ marginTop: selected.length > 0 ? 6 : 0 }}>
            <Text style={s.listSubLabel}>NO MARCADOS</Text>
            {notSelected.map((item) => (
              <View key={item} style={s.itemRow}>
                <View style={s.itemDotMuted} />
                <Text style={s.itemTextMuted}>{normalizeText(item)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function FieldBlock({ field, value, index }: { field: string; value: string; index: number }) {
  const isEmpty = !value?.trim();
  const displayValue = isEmpty ? "Sin respuesta" : normalizeText(value);

  return (
    <View style={s.fieldBlock}>
      <View style={s.fieldHeader}>
        <View style={s.fieldIndexBadge}>
          <Text style={s.fieldIndexText}>{String(index + 1).padStart(2, "0")}</Text>
        </View>
        {/* field is already a full human-readable question — used as-is */}
        <Text style={s.fieldLabel}>{field}</Text>
        {!isEmpty && <View style={s.fieldDot} />}
      </View>
      <View style={s.fieldBody}>
        <Text style={isEmpty ? s.fieldAnswerEmpty : s.fieldAnswer}>{displayValue}</Text>
      </View>
    </View>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────

function BriefDocument({
  empresaNombre, periodo, estado, version, form,
}: {
  empresaNombre: string;
  periodo: string;
  estado: string;
  version: number;
  form: ReturnType<typeof loadBriefForm>;
}) {
  const periodoLabel = formatPeriodo(periodo);
  const stColor = statusColor(estado);
  const isYes = form.strategicChanges === "si";
  const hasAnswer = !!form.strategicChanges;

  const strategicBg = isYes ? "#1e1400" : "#081c1c";
  const strategicBorder = isYes ? C.amber : C.teal;

  const sectionNum =
    Object.keys(form.objectives).length > 0
      ? Object.keys(form.fields).length > 0 ? "03" : "02"
      : "01";

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Cover band ── */}
        <View style={s.coverBand}>
          <View style={s.accentBar} />
          <Text style={s.eyebrow}>BRIEF  MENSUAL</Text>
          <Text style={s.companyName}>{empresaNombre}</Text>

          <View style={s.metaRow}>
            <View style={s.metaPill}>
              <Text style={s.metaPillLabel}>PERIODO  </Text>
              <Text style={s.metaPillValue}>{periodoLabel}</Text>
            </View>
            <View style={[s.statusPill, { borderColor: stColor, backgroundColor: `${stColor}18` }]}>
              <Text style={[s.metaPillLabel, { color: stColor }]}>{estado.toUpperCase()}</Text>
            </View>
            <View style={s.metaPill}>
              <Text style={s.metaPillLabel}>VERSION  </Text>
              <Text style={s.metaPillValue}>v{version}</Text>
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={s.body}>

          {/* 01 Objetivos */}
          <View style={s.sectionBlock}>
            <SectionHeading num="01" title="Objetivos del Mes" />
            {BRIEF_OBJECTIVE_GROUPS.map((group) => (
              <ObjectiveGroup key={group.id} group={group} form={form} />
            ))}
          </View>

          {/* 02 Preguntas */}
          <View style={s.sectionBlock}>
            <SectionHeading num="02" title="Preguntas Estratégicas" />
            {BRIEF_TEXT_FIELDS.map((field, i) => (
              <FieldBlock
                key={field}
                field={field}
                value={form.fields[field] ?? ""}
                index={i}
              />
            ))}
          </View>

          {/* 03 Cambios estratégicos */}
          <View style={s.sectionBlock}>
            <SectionHeading num={sectionNum} title="Cambios Estratégicos" />
            <View style={[
              s.strategicBlock,
              { backgroundColor: strategicBg, borderColor: strategicBorder, borderLeftColor: strategicBorder },
            ]}>
              <Text style={[s.strategicLabel, { color: strategicBorder }]}>
                ¿HUBO CAMBIOS ESTRATÉGICOS?
              </Text>
              {hasAnswer ? (
                <Text style={[s.strategicAnswer, { color: strategicBorder }]}>
                  {isYes ? "SI — Requiere actualizar BEC" : "NO — BEC vigente"}
                </Text>
              ) : (
                <Text style={s.strategicEmpty}>Sin respuesta</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{empresaNombre}  |  Brief {periodoLabel}</Text>
          <Text style={[s.footerText, { color: C.emeraldSoft }]}>·</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}

// ── Export button ─────────────────────────────────────────────────────────────

export default function BriefPdfExportButton(props: Props) {
  async function exportPdf() {
    const form = loadBriefForm(props.data);

    const blob = await pdf(
      <BriefDocument
        empresaNombre={props.empresaNombre}
        periodo={props.periodo}
        estado={props.estado}
        version={props.version}
        form={form}
      />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Brief-${sanitizeFilePart(props.empresaNombre)}-${props.periodo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={exportPdf} className={props.className}>
      Exportar PDF
    </button>
  );
}