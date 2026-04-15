import { NextResponse } from "next/server";

import { regenerateCalendarioItem } from "@/lib/calendario/regeneration";
import { normalizeCalendarioContent } from "@/lib/calendario/schema";
import { getCompanyWebResearch } from "@/lib/company-web-research";
import { createClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ empresaId: string; calendarioId: string }>;
};

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
    prompt?: string;
  };
  const itemId = String(body.itemId ?? "").trim();
  const prompt = String(body.prompt ?? "").trim();

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
    const webResearchContext = await getCompanyWebResearch(empresa);
    const enrichedPrompt = [
      prompt,
      "Investigacion web de empresa:",
      webResearchContext || "Sin investigacion web disponible",
      "Usa esta informacion solo para enriquecer mercado, competencia, SEO, tono, objeciones y oportunidades. No inventes fechas, precios, promociones ni claims duros.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const nextItem = await regenerateCalendarioItem({
      empresaNombre: empresa.nombre,
      calendarioTitulo: calendario.title || "Calendario editorial",
      periodo: normalized.periodo,
      item,
      customPrompt: enrichedPrompt,
    });

    return NextResponse.json({ item: nextItem });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo regenerar el item." },
      { status: 500 },
    );
  }
}
