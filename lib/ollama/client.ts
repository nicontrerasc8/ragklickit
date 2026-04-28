export type AIProvider = "openai" | "ollama" | "gemini";

export type AIChatParams = {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function resolveAIProvider(): AIProvider {
  const explicit = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "openai" || explicit === "ollama" || explicit === "gemini") {
    return explicit;
  }

  return process.env.NODE_ENV === "production" ? "gemini" : "ollama";
}

function geminiModelPath(model: string) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

export function getAIConfig() {
  const provider = resolveAIProvider();

  if (provider === "openai") {
    const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const chatModel = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";

    return {
      provider,
      baseUrl,
      chatModel,
      embedModel: process.env.OPENAI_EMBED_MODEL ?? null,
      modelLabel: `openai:${chatModel}`,
    };
  }

  if (provider === "gemini") {
    const baseUrl = (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(
      /\/$/,
      "",
    );
    const chatModel = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";

    return {
      provider,
      baseUrl,
      chatModel,
      embedModel: process.env.GEMINI_EMBED_MODEL ?? null,
      modelLabel: `gemini:${chatModel}`,
    };
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const chatModel = process.env.OLLAMA_CHAT_MODEL ?? "gpt-oss:120b-cloud";
  const embedModel = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

  return {
    provider,
    baseUrl,
    chatModel,
    embedModel,
    modelLabel: `ollama:${chatModel}`,
  };
}

async function checkOpenAIConnection() {
  const { baseUrl, chatModel } = getAIConfig();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY para usar OpenAI.");
  }

  const response = await fetch(`${baseUrl}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI no responde (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };
  const models = (data.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => Boolean(id));

  if (models.length > 0 && !models.includes(chatModel)) {
    throw new Error(`El modelo configurado no aparece disponible en OpenAI: ${chatModel}`);
  }

  return models;
}

async function checkGeminiConnection() {
  const { baseUrl, chatModel } = getAIConfig();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY para usar Gemini.");
  }

  const response = await fetch(`${baseUrl}/models`, {
    method: "GET",
    headers: {
      "x-goog-api-key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini no responde (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    models?: Array<{ name?: string }>;
  };
  const models = (data.models ?? [])
    .map((model) => model.name?.replace(/^models\//, ""))
    .filter((name): name is string => Boolean(name));

  if (models.length > 0 && !models.includes(chatModel)) {
    throw new Error(`El modelo configurado no aparece disponible en Gemini: ${chatModel}`);
  }

  return models;
}

export async function checkOllamaConnection() {
  const { baseUrl } = getAIConfig();
  const response = await fetch(`${baseUrl}/api/tags`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Ollama no responde: ${response.status}`);
  }

  const data = (await response.json()) as { models?: Array<{ name?: string }> };
  return (data.models ?? [])
    .map((model) => model.name)
    .filter((name): name is string => Boolean(name));
}

export async function checkAIConnection() {
  const config = getAIConfig();
  if (config.provider === "openai") {
    return checkOpenAIConnection();
  }
  if (config.provider === "gemini") {
    return checkGeminiConnection();
  }

  return checkOllamaConnection();
}

async function openAIChat(params: AIChatParams) {
  const { baseUrl, chatModel } = getAIConfig();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY para usar OpenAI.");
  }

  console.info("[ai:chat] generando con OpenAI", {
    provider: "openai",
    model: chatModel,
    baseUrl,
  });

  const input = [
    params.systemPrompt
      ? {
          role: "system",
          content: [{ type: "input_text", text: params.systemPrompt }],
        }
      : undefined,
    {
      role: "user",
      content: [{ type: "input_text", text: params.userPrompt }],
    },
  ].filter(Boolean);

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: chatModel,
      input,
      temperature: params.temperature ?? 0.2,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error en OpenAI (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const outputText =
    data.output_text?.trim() ??
    data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .join("\n")
      .trim() ??
    "";

  return outputText;
}

async function geminiChat(params: AIChatParams) {
  const { baseUrl, chatModel } = getAIConfig();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY para usar Gemini.");
  }

  console.info("[ai:chat] generando con Gemini", {
    provider: "gemini",
    model: chatModel,
    baseUrl,
  });

  const response = await fetch(`${baseUrl}/${geminiModelPath(chatModel)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      ...(params.systemPrompt
        ? {
            systemInstruction: {
              parts: [{ text: params.systemPrompt }],
            },
          }
        : {}),
      contents: [
        {
          role: "user",
          parts: [{ text: params.userPrompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 0.2,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error en Gemini (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as GeminiResponse;
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n")
      .trim() ?? ""
  );
}

export async function aiChat(params: AIChatParams) {
  const config = getAIConfig();

  if (config.provider === "openai") {
    return openAIChat(params);
  }
  if (config.provider === "gemini") {
    return geminiChat(params);
  }

  const messages = [
    params.systemPrompt
      ? { role: "system", content: params.systemPrompt }
      : undefined,
    { role: "user", content: params.userPrompt },
  ].filter(Boolean);

  console.info("[ai:chat] generando con Ollama", {
    provider: "ollama",
    model: config.chatModel,
    baseUrl: config.baseUrl,
  });

  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.chatModel,
      stream: false,
      messages,
      options: {
        temperature: params.temperature ?? 0.2,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error en Ollama (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  return data.message?.content?.trim() ?? "";
}

export const ollamaChat = aiChat;
