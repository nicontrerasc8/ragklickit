type ResearchCompany = {
  nombre?: string | null;
  marca?: string | null;
  industria?: string | null;
  pais?: string | null;
  metadata_json?: unknown;
};

type OpenAITextContent = {
  type?: string;
  text?: string;
  annotations?: Array<{
    type?: string;
    url?: string;
    title?: string;
  }>;
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAITextContent[];
  action?: {
    sources?: Array<{
      url?: string;
      title?: string;
    }>;
  };
};

type OpenAIWebResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function extractUrlsFromText(value: string) {
  const matches = value.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  return Array.from(
    new Set(
      matches
        .map((url) => url.replace(/[.,;:!?]+$/, ""))
        .filter((url) => {
          try {
            const parsed = new URL(url);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
          } catch {
            return false;
          }
        }),
    ),
  );
}

function countryCodeFromPais(pais: string) {
  const normalized = pais
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized.includes("peru")) return "PE";
  if (normalized.includes("mexico")) return "MX";
  if (normalized.includes("colombia")) return "CO";
  if (normalized.includes("chile")) return "CL";
  if (normalized.includes("argentina")) return "AR";
  if (normalized.includes("panama")) return "PA";
  if (normalized.includes("ecuador")) return "EC";
  if (normalized.includes("espana") || normalized.includes("spain")) return "ES";
  if (normalized.includes("united states") || normalized.includes("estados unidos")) return "US";

  return undefined;
}

function openAIWebSearchConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model =
    process.env.OPENAI_WEB_SEARCH_MODEL?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    "gpt-4.1-mini";

  return { apiKey, baseUrl, model };
}

function extractOutputText(data: OpenAIWebResponse) {
  const textFromOutput =
    data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .join("\n")
      .trim() ?? "";

  return data.output_text?.trim() || textFromOutput;
}

function extractSources(data: OpenAIWebResponse) {
  const sources = new Map<string, string>();

  for (const item of data.output ?? []) {
    for (const source of item.action?.sources ?? []) {
      if (source.url) {
        sources.set(source.url, source.title || source.url);
      }
    }

    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation" && annotation.url) {
          sources.set(annotation.url, annotation.title || annotation.url);
        }
      }
    }
  }

  return Array.from(sources.entries())
    .slice(0, 10)
    .map(([url, title]) => `- ${title}: ${url}`)
    .join("\n");
}

async function requestOpenAIWebSearch(params: {
  prompt: string;
  country?: string;
}) {
  const { apiKey, baseUrl, model } = openAIWebSearchConfig();
  if (!apiKey) {
    return {
      ok: false as const,
      error: "falta OPENAI_API_KEY.",
    };
  }

  const userCountry = params.country ? countryCodeFromPais(params.country) : undefined;

  async function requestWithTool(toolType: "web_search" | "web_search_preview") {
    return fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        tools: [
          {
            type: toolType,
            ...(userCountry
              ? {
                  user_location: {
                    type: "approximate",
                    country: userCountry,
                    timezone: "America/Lima",
                  },
                }
              : {}),
          },
        ],
        tool_choice: "auto",
        include: ["web_search_call.action.sources"],
        input: params.prompt,
        temperature: 0.15,
      }),
      cache: "no-store",
    });
  }

  let response = await requestWithTool("web_search");
  let errorBody = "";

  if (!response.ok) {
    errorBody = await response.text();
    if (response.status === 400 && errorBody.includes("web_search")) {
      response = await requestWithTool("web_search_preview");
      errorBody = response.ok ? "" : await response.text();
    }
  }

  if (!response.ok) {
    return {
      ok: false as const,
      error: `OpenAI web_search fallo (${response.status}). ${errorBody.slice(0, 220)}`,
    };
  }

  const data = (await response.json()) as OpenAIWebResponse;
  return {
    ok: true as const,
    text: extractOutputText(data),
    sources: extractSources(data),
  };
}

export async function getReferenceLinksWebResearch(params: {
  links: string[];
  purpose: string;
  userContext?: string;
  country?: string;
  maxLinks?: number;
}) {
  const links = Array.from(new Set(params.links)).slice(0, params.maxLinks ?? 8);
  if (links.length === 0) return "";

  const prompt = [
    "Investiga estos links con web search para usarlos como fuente en una generacion de marketing.",
    `Uso previsto: ${params.purpose}`,
    params.country ? `Mercado/pais: ${params.country}` : "",
    params.userContext?.trim() ? `Contexto del usuario:\n${params.userContext.trim().slice(0, 5000)}` : "",
    "",
    "LINKS A REVISAR:",
    links.map((link, index) => `${index + 1}. ${link}`).join("\n"),
    "",
    "Reglas:",
    "1) Prioriza abrir o buscar esos dominios/URLs concretos.",
    "2) No inventes datos si una pagina no se puede leer.",
    "3) Extrae solo informacion util y verificable para estrategia, copy, oferta, tono, audiencia, restricciones, promociones, claims, SEO, referencias o calendario.",
    "4) Incluye URLs en el memo cuando uses una fuente.",
    "",
    "Devuelve un memo compacto en espanol con: fuentes revisadas, datos verificables, insights utiles, restricciones/riesgos y como aplicar esta informacion.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await requestOpenAIWebSearch({ prompt, country: params.country });
    if (!result.ok) {
      return `INVESTIGACION DE LINKS NO DISPONIBLE: ${result.error}`;
    }

    if (!result.text.trim()) {
      return "INVESTIGACION DE LINKS NO DISPONIBLE: web_search no devolvio contenido util.";
    }

    return [
      "INVESTIGACION WEB DE LINKS DEL USUARIO:",
      result.text.trim().slice(0, 10000),
      result.sources ? "\nFUENTES RECUPERADAS:\n" + result.sources : "",
    ]
      .join("\n")
      .slice(0, 12000);
  } catch (error) {
    return `INVESTIGACION DE LINKS NO DISPONIBLE: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getCompanyWebResearch(company: ResearchCompany) {
  const { apiKey } = openAIWebSearchConfig();
  if (!apiKey) {
    return "Investigacion web no disponible: falta OPENAI_API_KEY.";
  }

  const metadata = asRecord(company.metadata_json);
  const brand = firstString(metadata.marca, company.marca, company.nombre);
  const name = firstString(company.nombre, brand);
  const industry = firstString(company.industria, metadata.industria, metadata.rubro);
  const country = firstString(company.pais, metadata.pais);
  const website = firstString(metadata.website, metadata.web, metadata.url, metadata.sitio_web);
  const instagram = firstString(metadata.instagram, metadata.instagram_url);
  const linkedin = firstString(metadata.linkedin, metadata.linkedin_url);

  if (!name && !brand) {
    return "Investigacion web no disponible: no hay nombre de empresa o marca para buscar.";
  }

  const prompt = [
    "Investiga en internet a esta empresa/marca para enriquecer estrategia de marketing.",
    "",
    `Empresa: ${name || "No especificado"}`,
    `Marca: ${brand || "No especificada"}`,
    `Industria/rubro: ${industry || "No especificado"}`,
    `Pais/mercado: ${country || "No especificado"}`,
    website ? `Sitio web sugerido: ${website}` : "",
    instagram ? `Instagram sugerido: ${instagram}` : "",
    linkedin ? `LinkedIn sugerido: ${linkedin}` : "",
    "",
    "Busca primero fuentes oficiales de la empresa, luego perfiles sociales, directorios confiables, prensa, reseñas, marketplaces y competidores/benchmarks del mismo mercado si aparecen.",
    "No inventes datos. Si algo no queda verificado, marcalo como pendiente o inferencia.",
    "Incluye URLs dentro del texto cuando uses una fuente. Prioriza senal util para BEC, brief, plan de trabajo y calendario.",
    "",
    "Devuelve un memo compacto en espanol con estas secciones:",
    "1) Fuentes consultadas y confiabilidad.",
    "2) Datos verificables de oferta, ubicacion, canales, propuesta, categorias, precios o servicios.",
    "3) Lectura de posicionamiento, tono, promesas y diferenciales observables.",
    "4) Audiencias, dolores, objeciones y disparadores de compra que se pueden inferir con cuidado.",
    "5) Competencia, benchmarks, SEO, hashtags, temas culturales o estacionales relevantes.",
    "6) Riesgos, restricciones, vacios de informacion y datos que deben validarse con cliente.",
    "7) Recomendaciones concretas para usar esta investigacion en estrategia y contenido.",
  ].filter(Boolean).join("\n");

  try {
    const result = await requestOpenAIWebSearch({ prompt, country });
    if (!result.ok) {
      return `Investigacion web no disponible: ${result.error}`;
    }

    const memo = result.text.slice(0, 9000);
    const sources = result.sources;

    if (!memo) {
      return "Investigacion web no disponible: la busqueda no devolvio contenido util.";
    }

    return [
      "INVESTIGACION WEB DE EMPRESA:",
      memo,
      sources ? "\nFUENTES RECUPERADAS:\n" + sources : "",
    ].join("\n").slice(0, 11000);
  } catch (error) {
    return `Investigacion web no disponible: ${error instanceof Error ? error.message : String(error)}`;
  }
}
