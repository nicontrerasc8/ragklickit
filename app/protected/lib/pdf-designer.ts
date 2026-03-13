"use client";

import jsPDF from "jspdf";

export type PdfMeta = {
  label: string;
  value: string;
};

export type PdfSection = {
  title: string;
  lines: string[];
};

export type PdfTheme = {
  name: string;
  primary: [number, number, number];
  soft: [number, number, number];
};

export function formatKey(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\s+/g, " ").trim();
}

export function toLines(value: unknown, indent = ""): string[] {
  if (value == null) return [`${indent}-`];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [`${indent}${String(value)}`];
  }
  if (Array.isArray(value)) {
    if (!value.length) return [`${indent}(sin datos)`];
    return value.flatMap((item) => {
      if (item && typeof item === "object") return [`${indent}-`, ...toLines(item, `${indent}  `)];
      return [`${indent}- ${String(item)}`];
    });
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return [`${indent}(sin datos)`];
  return entries.flatMap(([k, v]) => [`${indent}${formatKey(k)}:`, ...toLines(v, `${indent}  `)]);
}

type ExportSpec = {
  filename: string;
  title: string;
  subtitle: string;
  meta: PdfMeta[];
  sections: PdfSection[];
  theme: PdfTheme;
};

export function exportStyledPdf(spec: ExportSpec) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const { primary, soft, name } = spec.theme;
  const generatedAt = new Date().toLocaleString("es-PE");

  let page = 1;
  let y = 190;

  const drawHeader = (continued = false) => {
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, 0, pageWidth, 136, "F");

    doc.setFillColor(soft[0], soft[1], soft[2]);
    doc.rect(0, 136, pageWidth, 16, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(spec.title, margin, 52);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(spec.subtitle, margin, 72);
    doc.text(`Plantilla: ${name}`, margin, 88);
    doc.text(`Generado: ${generatedAt}`, margin, 102);
    if (continued) {
      doc.text("Continuacion", pageWidth - margin, 102, { align: "right" });
    }

    let chipX = margin;
    let chipY = 154;
    doc.setFontSize(9);
    for (const item of spec.meta) {
      const text = `${item.label}: ${item.value}`;
      const w = Math.min(220, doc.getTextWidth(text) + 16);
      if (chipX + w > pageWidth - margin) {
        chipX = margin;
        chipY += 18;
      }
      doc.setFillColor(247, 250, 252);
      doc.roundedRect(chipX, chipY, w, 14, 4, 4, "F");
      doc.setTextColor(15, 23, 42);
      doc.text(text, chipX + 8, chipY + 10.5);
      chipX += w + 8;
    }

    y = chipY + 24;
  };

  const drawFooter = () => {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Pagina ${page}`, pageWidth - margin, pageHeight - 16, { align: "right" });
  };

  const ensureSpace = (required: number) => {
    if (y + required < pageHeight - 34) return;
    drawFooter();
    doc.addPage();
    page += 1;
    drawHeader(true);
  };

  drawHeader(false);

  for (const section of spec.sections) {
    ensureSpace(64);

    const cardX = margin;
    const cardY = y;
    const cardW = contentWidth;
    let cursorY = cardY + 26;

    const lineMetrics = section.lines.map((raw) => {
      const trimmedLeft = raw.replace(/^\s+/, "");
      const leading = raw.length - trimmedLeft.length;
      const level = Math.floor(leading / 2);
      const bullet = trimmedLeft.startsWith("- ");
      const text = bullet ? trimmedLeft.slice(2) : trimmedLeft;
      const lines = doc.splitTextToSize(text || " ", cardW - 28 - level * 12);
      return { level, bullet, lines };
    });

    const textHeight = lineMetrics.reduce((acc, item) => acc + item.lines.length * 13 + 2, 0);
    const cardH = Math.max(50, 36 + textHeight + 8);
    ensureSpace(cardH + 12);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, y, cardW, cardH, 10, 10, "FD");

    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(section.title, cardX + 12, y + 18);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);

    for (const item of lineMetrics) {
      const lineXBase = cardX + 12 + item.level * 12;
      if (item.bullet) {
        doc.text("•", lineXBase, cursorY);
      }
      item.lines.forEach((line: string, idx: number) => {
        doc.text(line, lineXBase + (item.bullet ? 8 : 0), cursorY + idx * 13);
      });
      cursorY += item.lines.length * 13 + 2;
    }

    y += cardH + 12;
  }

  drawFooter();
  doc.save(spec.filename);
}
