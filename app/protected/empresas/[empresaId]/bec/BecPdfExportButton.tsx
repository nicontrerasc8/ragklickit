"use client";

import { useEffect, useState } from "react";
import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type Props = {
  empresaNombre: string;
  becVersion: number;
  updatedLabel: string | null;
  becData: unknown;
  companyData: unknown;
  className?: string;
};

type TreeLine = { text: string; depth: number; isTitle: boolean };

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "bec";
}

function normalizeText(value: string): string {
  return value.replace(/[ \t\u00A0]+/g, " ").trim();
}

function formatKey(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTechnicalKey(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[\s_-]/g, "");
  return [
    "field",
    "fields",
    "item",
    "items",
    "data",
    "values",
    "value",
    "list",
    "lista",
    "content",
    "contenido",
    "properties",
    "props",
    "attributes",
  ].includes(normalized);
}

function toTreeLines(value: unknown, depth = 0): TreeLine[] {
  if (value == null) return [{ text: "-", depth, isTitle: false }];

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [{ text: normalizeText(String(value)), depth, isTitle: false }];
  }

  if (Array.isArray(value)) {
    if (!value.length) return [{ text: "(sin datos)", depth, isTitle: false }];
    return value.flatMap((item) => {
      if (item && typeof item === "object") {
        return toTreeLines(item, depth);
      }
      return [{ text: `- ${normalizeText(String(item))}`, depth, isTitle: false }];
    });
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return [{ text: "(sin datos)", depth, isTitle: false }];

  return entries.flatMap(([k, v]) => {
    if (isTechnicalKey(k)) {
      return toTreeLines(v, depth);
    }

    return [
      { text: formatKey(k), depth, isTitle: true },
      ...toTreeLines(v, depth + 1),
    ];
  });
}

const C = {
  ink: "#0b0d10",
  surface: "#0f1418",
  forest: "#0b223f",
  forestMid: "#1e3a8a",
  emerald: "#38bdf8",
  emeraldSoft: "#7dd3fc",
  teal: "#0ea5a4",
  white: "#ffffff",
  offwhite: "#dbeafe",
  muted: "#93c5fd",
  divider: "#1e3a8a",
  cardBg: "#0b1423",
  cardBorder: "#23477d",
  text: "#eaf2ff",
  textFaint: "#7aa3da",
};

const s = StyleSheet.create({
  page: {
    backgroundColor: C.ink,
    color: C.text,
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingBottom: 30,
  },
  top: {
    backgroundColor: C.forest,
    borderBottomWidth: 1,
    borderBottomColor: C.forestMid,
    paddingVertical: 22,
    paddingHorizontal: 28,
  },
  eye: {
    fontSize: 8,
    color: C.emeraldSoft,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 20,
    color: C.white,
    fontFamily: "Helvetica-Bold",
  },
  sub: {
    fontSize: 10,
    color: C.offwhite,
    marginTop: 4,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 6,
  },
  chip: {
    backgroundColor: C.forestMid,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipT: {
    fontSize: 8,
    color: C.offwhite,
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  sec: {
    marginBottom: 14,
  },
  secHead: {
    flexDirection: "row",
    marginBottom: 8,
  },
  secBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: C.emerald,
    textAlign: "center",
    color: C.white,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingTop: 4,
    marginRight: 8,
  },
  secTitle: {
    fontSize: 11,
    color: C.offwhite,
    fontFamily: "Helvetica-Bold",
    paddingTop: 2,
  },
  card: {
    borderWidth: 0.6,
    borderColor: C.cardBorder,
    borderRadius: 8,
    backgroundColor: C.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  rowTitle: {
    fontSize: 9,
    color: C.muted,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  rowText: {
    fontSize: 9,
    color: C.text,
    lineHeight: 1.35,
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 7,
    color: C.textFaint,
  },
});

function Section({
  num,
  title,
  lines,
}: {
  num: string;
  title: string;
  lines: TreeLine[];
}) {
  return (
    <View style={s.sec}>
      <View style={s.secHead}>
        <Text style={s.secBadge}>{num}</Text>
        <Text style={s.secTitle}>{title}</Text>
      </View>
      <View style={s.card}>
        {lines.map((line, idx) => (
          <Text key={`${idx}-${line.text}`} style={line.isTitle ? s.rowTitle : s.rowText}>
            {" ".repeat(line.depth * 2)}
            {line.isTitle ? `${line.text}:` : line.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BecDocument({ props }: { props: Props }) {
  const becLines = toTreeLines(props.becData);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <Text style={s.eye}>BASE ESTRATÉGICA DE CLIENTE</Text>
          <Text style={s.title}>{props.empresaNombre}</Text>
          <Text style={s.sub}>Documento BEC</Text>

          <View style={s.chips}>
            <View style={s.chip}>
              <Text style={s.chipT}>Versión v{props.becVersion}</Text>
            </View>
            <View style={s.chip}>
              <Text style={s.chipT}>Actualizado: {props.updatedLabel ?? "-"}</Text>
            </View>
          </View>
        </View>

        <View style={s.body}>
          
          <Section num="01" title="Contenido BEC" lines={becLines} />
        </View>

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${props.empresaNombre} · BEC · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function PdfIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 16h8M8 12h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-current/25 border-t-current animate-spin" />
  );
}

export default function BecPdfExportButton(props: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [didExport, setDidExport] = useState(false);

  useEffect(() => {
    if (!didExport) return;
    const t = window.setTimeout(() => setDidExport(false), 2200);
    return () => window.clearTimeout(t);
  }, [didExport]);

  async function exportPdf() {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const blob = await pdf(<BecDocument props={props} />).toBlob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `BEC-${sanitizeFilePart(props.empresaNombre)}-v${props.becVersion}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      setDidExport(true);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }

  const defaultClassName = cn(
    "group relative inline-flex items-center gap-2 overflow-hidden",
    "rounded-xl border border-sky-400/15",
    "bg-gradient-to-b from-sky-500/16 to-sky-500/8",
    "px-4 py-2.5",
    "text-[12px] font-semibold text-sky-50",
    "shadow-[0_8px_30px_rgba(56,189,248,0.12)]",
    "transition-all duration-200",
    "hover:-translate-y-[1px] hover:border-sky-300/25 hover:from-sky-500/22 hover:to-sky-500/12",
    "active:translate-y-0",
    "disabled:cursor-not-allowed disabled:opacity-70"
  );

  return (
    <button
      type="button"
      onClick={exportPdf}
      disabled={isExporting}
      className={cn(defaultClassName, props.className)}
      aria-label="Exportar PDF del BEC"
    >
      <span className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="absolute -left-10 top-0 h-full w-10 rotate-12 bg-white/10 blur-md transition-all duration-700 group-hover:left-[110%]" />
      </span>

      <span
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200",
          didExport
            ? "border-sky-300/30 bg-sky-300/15 text-sky-100"
            : "border-white/10 bg-white/8 text-sky-100 group-hover:bg-white/10"
        )}
      >
        {isExporting ? <SpinnerIcon /> : didExport ? <CheckIcon /> : <PdfIcon />}
      </span>

      <span className="relative flex flex-col items-start leading-none">
        <span className="text-[12px] font-semibold">
          {isExporting ? "Exportando PDF..." : didExport ? "PDF exportado" : "Exportar PDF"}
        </span>
        <span className="mt-1 text-[10px] font-medium text-sky-100/55">
          {isExporting
            ? "Generando documento"
            : didExport
            ? "Descarga iniciada"
            : `v${props.becVersion}`}
        </span>
      </span>
    </button>
  );
}
