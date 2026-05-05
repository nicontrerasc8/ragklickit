import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarioContent } from "@/lib/calendario/schema";
import {
  generateCalendarioItemBundle,
} from "@/lib/calendario/content-studio";
import {
  extractUrlsFromText,
  getCompanyWebResearch,
  getContentStudioWebResearch,
  getReferenceLinksWebResearch,
} from "@/lib/company-web-research";

type Params = {
  params: Promise<{ empresaId: string; calendarioId: string }>;
};

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseReferenceLinks(...values: unknown[]) {
  const raw = values.filter((value): value is string => typeof value === "string").join("\n");
  if (!raw) return [] as string[];

  const extracted = extractUrlsFromText(raw);
  if (extracted.length > 0) return extracted.slice(0, 12);

  const value = raw;
  if (typeof value !== "string") return [] as string[];

  const links = value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(links))
    .map((entry) => {
      try {
        const url = new URL(entry);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.toString();
      } catch {
        return null;
      }
    })
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 12);
}

export async function POST(request: Request, { params }: Params) {
  const { empresaId, calendarioId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    itemId?: string;
    generationInstructions?: string;
    referenceLinks?: string;
    referenceInfo?: string;
  };
  const itemId = String(body.itemId ?? "").trim();
  const generationInstructions = sanitizeText(body.generationInstructions, 5000);
  const referenceInfo = sanitizeText(body.referenceInfo, 8000);
  const referenceLinks = parseReferenceLinks(body.referenceLinks, generationInstructions, referenceInfo);

  if (!itemId) {
    return NextResponse.json({ error: "Falta itemId." }, { status: 400 });
  }

  const { data: appUser } = await supabase
    .from("app_user")
    .select("agencia_id")
    .eq("id", user.id)
    .maybeSingle();
  const agenciaId = appUser?.agencia_id ?? null;

  const [{ data: empresa }, { data: calendario }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre, industria, pais, metadata_json")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase
      .from("rag_artifacts")
      .select("id, title, content_json")
      .eq("id", calendarioId)
      .eq("artifact_type", "calendario")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
  ]);

  if (!empresa || !calendario) {
    return NextResponse.json({ error: "Calendario o empresa no encontrados." }, { status: 404 });
  }

  const normalized = normalizeCalendarioContent(calendario.content_json);
  const item = normalized.calendario.items.find((entry) => entry.id === itemId);

  if (!item) {
    return NextResponse.json({ error: "Item no encontrado." }, { status: 404 });
  }

  try {
    let webResearchContext = "";
    let referenceLinkContext = "";
    let contentStudioWebResearch = "";
    try {
      [webResearchContext, referenceLinkContext] = await Promise.all([
        getCompanyWebResearch(empresa),
        getReferenceLinksWebResearch({
          links: referenceLinks,
          purpose: "generar un bundle de contenido para un item de calendario editorial",
          userContext: [generationInstructions, referenceInfo].filter(Boolean).join("\n\n"),
          country: empresa.pais ?? undefined,
          maxLinks: 12,
        }),
      ]);
      contentStudioWebResearch = await getContentStudioWebResearch({
        company: empresa,
        item,
        calendarioTitulo: calendario.title || "Calendario editorial",
        periodo: normalized.periodo,
        generationInstructions,
        referenceInfo,
        referenceLinks,
        referenceLinkContext,
      });
    } catch (error) {
      console.error("[generation:content-studio-web-research] failed", {
        empresaId,
        calendarioId,
        itemId,
        error: error instanceof Error ? error.message : String(error),
      });
      webResearchContext = "Investigacion web no disponible: fallo inesperado durante la busqueda.";
    }
    const primaryReferenceLinksContext =
      referenceLinks.length > 0
        ? [
            "FUENTE PRIMARIA DEL POST - LINKS PEGADOS POR EL USUARIO:",
            referenceLinks.join("\n"),
            "",
            "La pieza final debe tomar la informacion, lenguaje, beneficios, restricciones, pruebas y angulos de estos links antes que la investigacion general de empresa.",
            "Si hay conflicto entre estos links y otra fuente web, prioriza estos links. Si un link no pudo leerse, no inventes su contenido.",
            referenceLinkContext ? `\nLECTURA / INVESTIGACION DE ESOS LINKS:\n${referenceLinkContext}` : "",
          ].join("\n")
        : "";

    const combinedWebResearchContext = [
      primaryReferenceLinksContext,
      contentStudioWebResearch,
      webResearchContext,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 30000);

    const bundle = await generateCalendarioItemBundle({
      empresaNombre: empresa.nombre,
      calendarioTitulo: calendario.title || "Calendario editorial",
      periodo: normalized.periodo,
      item,
      webResearchContext: combinedWebResearchContext,
      userGenerationContext: {
        instructions: generationInstructions,
        referenceLinks,
        referenceInfo,
        referenceLinkContext,
      },
      existingBundle: item.asset_bundle,
    });

    return NextResponse.json({
      bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el bundle." },
      { status: 200 },
    );
  }
}
