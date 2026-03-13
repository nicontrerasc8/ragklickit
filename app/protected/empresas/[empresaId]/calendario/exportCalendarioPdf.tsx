"use client";

import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import type { CalendarioPdfProps } from "./CalendarioPdfExportButton";

function sanitizeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "calendario";
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
      if (item && typeof item === "object") {
        return [`${indent}-`, ...toLines(item, `${indent}  `)];
      }
      return [`${indent}- ${normalizeText(String(item))}`];
    });
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return [`${indent}(sin datos)`];

  return entries.flatMap(([key, entryValue]) => [
    `${indent}${formatKey(key)}:`,
    ...toLines(entryValue, `${indent}  `),
  ]);
}

const s = StyleSheet.create({
  page: {
    backgroundColor: "#070b12",
    color: "#e5efff",
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingBottom: 26,
  },
  top: {
    backgroundColor: "#0b223f",
    borderBottomWidth: 1,
    borderBottomColor: "#1e40af",
    paddingVertical: 20,
    paddingHorizontal: 28,
  },
  eye: {
    fontSize: 8,
    color: "#93c5fd",
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 20,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
  },
  sub: {
    fontSize: 10,
    color: "#dbeafe",
    marginTop: 3,
  },
  chips: {
    flexDirection: "row",
    marginTop: 10,
  },
  chip: {
    backgroundColor: "#1d4ed8",
    borderRadius: 4,
    marginRight: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 8,
    color: "#eff6ff",
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  heading: {
    fontSize: 11,
    color: "#dbeafe",
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  card: {
    borderWidth: 0.6,
    borderColor: "#23477d",
    borderRadius: 6,
    backgroundColor: "#0b1423",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  line: {
    fontSize: 9,
    lineHeight: 1.35,
    color: "#dbeafe",
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 7,
    color: "#7aa3da",
  },
});

function CalendarioDocument({ props }: { props: CalendarioPdfProps }) {
  const lines = toLines(props.data);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <Text style={s.eye}>CALENDARIO EDITORIAL</Text>
          <Text style={s.title}>{props.title || "Calendario editorial"}</Text>
          <Text style={s.sub}>{props.empresaNombre}</Text>
          <View style={s.chips}>
            <View style={s.chip}>
              <Text style={s.chipText}>Estado: {props.estado}</Text>
            </View>
            <View style={s.chip}>
              <Text style={s.chipText}>Version: v{props.version}</Text>
            </View>
            <View style={s.chip}>
              <Text style={s.chipText}>Actualizado: {props.updatedLabel}</Text>
            </View>
          </View>
        </View>

        <View style={s.body}>
          <Text style={s.heading}>Contenido del calendario</Text>
          <View style={s.card}>
            {lines.map((line, idx) => (
              <Text key={`${idx}-${line}`} style={s.line}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `${props.empresaNombre} | ${pageNumber}/${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function exportCalendarioPdf(props: CalendarioPdfProps) {
  const blob = await pdf(<CalendarioDocument props={props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Calendario-${sanitizeFilePart(props.empresaNombre)}-v${props.version}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
