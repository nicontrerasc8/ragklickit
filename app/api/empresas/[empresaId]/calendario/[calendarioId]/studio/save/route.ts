import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { CalendarioItemAssetBundle } from "@/lib/calendario/schema";
import { saveCalendarioItemBundle } from "@/lib/calendario/content-studio";

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
    bundle?: CalendarioItemAssetBundle;
  };

  const itemId = String(body.itemId ?? "").trim();
  if (!itemId || !body.bundle) {
    return NextResponse.json({ error: "Faltan itemId o bundle." }, { status: 400 });
  }

  const { data: appUser } = await supabase
    .from("app_user")
    .select("agencia_id")
    .eq("id", user.id)
    .maybeSingle();
  const agenciaId = appUser?.agencia_id ?? null;

  if (!agenciaId) {
    return NextResponse.json({ error: "Sin agencia asignada." }, { status: 403 });
  }

  try {
    await saveCalendarioItemBundle({
      supabase,
      agenciaId,
      empresaId,
      calendarioId,
      itemId,
      bundle: body.bundle,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el bundle." },
      { status: 500 },
    );
  }
}
