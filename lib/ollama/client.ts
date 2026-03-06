export type OllamaChatParams = {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

export function getOllamaConfig() {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    chatModel: process.env.OLLAMA_CHAT_MODEL ?? "gpt-oss:120b-cloud",
    embedModel: process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text",
  };
}

export async function checkOllamaConnection() {
  const { baseUrl } = getOllamaConfig();
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

export async function ollamaChat(params: OllamaChatParams) {
  const { baseUrl, chatModel } = getOllamaConfig();
  const messages = [
    params.systemPrompt
      ? { role: "system", content: params.systemPrompt }
      : undefined,
    { role: "user", content: params.userPrompt },
  ].filter(Boolean);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chatModel,
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
    throw new Error(
      `Error en Ollama (${response.status}): ${errorBody.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as OllamaChatResponse;
  return data.message?.content?.trim() ?? "";
}
