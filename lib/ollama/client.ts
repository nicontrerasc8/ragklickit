export type AIProvider = "openai" | "ollama";

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

function resolveAIProvider(): AIProvider {
  const explicit = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "openai" || explicit === "ollama") {
    return explicit;
  }

  return process.env.NODE_ENV === "production" ? "openai" : "ollama";
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

  return checkOllamaConnection();
}

async function openAIChat(params: AIChatParams) {
  const { baseUrl, chatModel } = getAIConfig();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY para usar OpenAI.");
  }

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

export async function aiChat(params: AIChatParams) {
  const config = getAIConfig();

  if (config.provider === "openai") {
    return openAIChat(params);
  }

  const messages = [
    params.systemPrompt
      ? { role: "system", content: params.systemPrompt }
      : undefined,
    { role: "user", content: params.userPrompt },
  ].filter(Boolean);

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
