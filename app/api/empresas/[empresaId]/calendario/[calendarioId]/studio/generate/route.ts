import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarioContent } from "@/lib/calendario/schema";
import {
  generateCalendarioItemBundle,
} from "@/lib/calendario/content-studio";

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

  const body = (await request.json().catch(() => ({}))) as { itemId?: string };
  const itemId = String(body.itemId ?? "").trim();

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
      .select("id, nombre")
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
    const bundle = await generateCalendarioItemBundle({
      empresaNombre: empresa.nombre,
      calendarioTitulo: calendario.title || "Calendario editorial",
      periodo: normalized.periodo,
      item,
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
