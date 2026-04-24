import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarioContent } from "@/lib/calendario/schema";
import {
  generateCalendarioItemBundle,
} from "@/lib/calendario/content-studio";
import { getCompanyWebResearch } from "@/lib/company-web-research";

type Params = {
  params: Promise<{ empresaId: string; calendarioId: string }>;
};

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseReferenceLinks(value: unknown) {
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
    .slice(0, 5);
}

function htmlToPromptText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchReferenceLinkContext(links: string[]) {
  const results = await Promise.all(
    links.map(async (url) => {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) return `URL: ${url}\nNo se pudo leer (${response.status}).`;

        const contentType = response.headers.get("content-type") ?? "";
        const raw = (await response.text()).slice(0, 80_000);
        const text = contentType.includes("text/html") ? htmlToPromptText(raw) : raw.replace(/\s+/g, " ").trim();

        return `URL: ${url}\nExtracto: ${text.slice(0, 3500) || "Sin texto util."}`;
      } catch {
        return `URL: ${url}\nNo se pudo leer el contenido. Usa solo el enlace como referencia indicada por el usuario.`;
      }
    }),
  );

  return results.join("\n\n");
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
  const referenceLinks = parseReferenceLinks(body.referenceLinks);

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
    const [webResearchContext, referenceLinkContext] = await Promise.all([
      getCompanyWebResearch(empresa),
      fetchReferenceLinkContext(referenceLinks),
    ]);
    const bundle = await generateCalendarioItemBundle({
      empresaNombre: empresa.nombre,
      calendarioTitulo: calendario.title || "Calendario editorial",
      periodo: normalized.periodo,
      item,
      webResearchContext,
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
      { status: 500 },
    );
  }
}
