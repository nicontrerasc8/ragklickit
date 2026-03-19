import { NextResponse } from "next/server";

import { checkAIConnection, getAIConfig } from "@/lib/ollama/client";

export async function GET() {
  try {
    const models = await checkAIConnection();
    const config = getAIConfig();
    return NextResponse.json({
      ok: true,
      provider: config.provider,
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
