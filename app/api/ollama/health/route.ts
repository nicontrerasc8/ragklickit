import { NextResponse } from "next/server";

import { checkOllamaConnection, getOllamaConfig } from "@/lib/ollama/client";

export async function GET() {
  try {
    const models = await checkOllamaConnection();
    const config = getOllamaConfig();
    return NextResponse.json({
      ok: true,
      baseUrl: config.baseUrl,
      chatModel: config.chatModel,
      embedModel: config.embedModel,
      models,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
