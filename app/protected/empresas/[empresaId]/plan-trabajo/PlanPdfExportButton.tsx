"use client";

import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type Props = {
  empresaNombre: string;
  title: string;
  estado: string;
  version: number;
  updatedLabel: string;
  data: unknown;
  className?: string;
};

function sanitizeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "plan";
}

function normalizeText(value: string): string {
  return value.replace(/[ \t\u00A0]+/g, " ").trim();
}

function formatKey(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\s+/g, " ").trim();
}

function toLines(value: unknown, indent = ""): string[] {
  if (value == null) return [`${indent}-`];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [`${indent}${normalizeText(String(value))}`];
  }
  if (Array.isArray(value)) {
    if (!value.length) return [`${indent}(sin datos)`];
    return value.flatMap((item) => {
      if (item && typeof item === "object") return [`${indent}-`, ...toLines(item, `${indent}  `)];
      return [`${indent}- ${normalizeText(String(item))}`];
    });
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return [`${indent}(sin datos)`];
  return entries.flatMap(([k, v]) => [`${indent}${formatKey(k)}:`, ...toLines(v, `${indent}  `)]);
}

const s = StyleSheet.create({
  page: { backgroundColor: "#0d0b12", color: "#f8f7ff", fontFamily: "Helvetica", fontSize: 10, paddingBottom: 26 },
  top: { backgroundColor: "#3b0764", borderBottomWidth: 1, borderBottomColor: "#6d28d9", paddingVertical: 20, paddingHorizontal: 28 },
  eye: { fontSize: 8, color: "#c4b5fd", fontFamily: "Helvetica-Bold", marginBottom: 6, letterSpacing: 1.5 },
  title: { fontSize: 20, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 10, color: "#ddd6fe", marginTop: 3 },
  chips: { flexDirection: "row", marginTop: 10 },
  chip: { backgroundColor: "#4c1d95", borderRadius: 4, marginRight: 6, paddingHorizontal: 7, paddingVertical: 3 },
  chipT: { fontSize: 8, color: "#ede9fe" },
  body: { paddingHorizontal: 28, paddingTop: 16 },
  h: { fontSize: 11, color: "#ddd6fe", fontFamily: "Helvetica-Bold", marginBottom: 8 },
  card: { borderWidth: 0.6, borderColor: "#3b2a57", borderRadius: 6, backgroundColor: "#161022", paddingHorizontal: 10, paddingVertical: 9 },
  line: { fontSize: 9, lineHeight: 1.35, color: "#e9e4ff", marginBottom: 2 },
  footer: { position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center", fontSize: 7, color: "#9f93b9" },
});

function PlanDocument({ props }: { props: Props }) {
  const lines = toLines(props.data);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <Text style={s.eye}>PLAN DE TRABAJO</Text>
          <Text style={s.title}>{props.title || "Plan de trabajo"}</Text>
          <Text style={s.sub}>{props.empresaNombre}</Text>
          <View style={s.chips}>
            <View style={s.chip}><Text style={s.chipT}>Estado: {props.estado}</Text></View>
            <View style={s.chip}><Text style={s.chipT}>Version: v{props.version}</Text></View>
            <View style={s.chip}><Text style={s.chipT}>Actualizado: {props.updatedLabel}</Text></View>
          </View>
        </View>
        <View style={s.body}>
          <Text style={s.h}>Contenido del plan</Text>
          <View style={s.card}>
            {lines.map((line, i) => (
              <Text key={`${i}-${line}`} style={s.line}>{line}</Text>
            ))}
          </View>
        </View>
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `${props.empresaNombre} | ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export default function PlanPdfExportButton(props: Props) {
  async function exportPdf() {
    const blob = await pdf(<PlanDocument props={props} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Plan-${sanitizeFilePart(props.empresaNombre)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={exportPdf} className={props.className}>
      Exportar PDF
    </button>
  );
}
