"use client";

import { useState } from "react";

export type CalendarioPdfProps = {
  empresaNombre: string;
  title: string;
  estado: string;
  version: number;
  updatedLabel: string;
  data: unknown;
  className?: string;
};

export default function CalendarioPdfExportButton(props: CalendarioPdfProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function onExport() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const { exportCalendarioPdf } = await import("./exportCalendarioPdf");
      await exportCalendarioPdf(props);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button type="button" onClick={onExport} className={props.className} disabled={isExporting}>
      {isExporting ? "Generando PDF..." : "Exportar PDF"}
    </button>
  );
}
