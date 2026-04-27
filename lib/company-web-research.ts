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

type DirectLinkResearch = {
  url: string;
  ok: boolean;
  title?: string;
  description?: string;
  excerpt?: string;
  error?: string;
};

const DIRECT_LINK_FETCH_TIMEOUT_MS = 12000;
const DIRECT_LINK_MAX_CHARS = 4500;

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

function normalizeReferenceUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    })
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    });
}

function extractHtmlMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanupExtractedText(match[1], 500);
  }

  return "";
}

function cleanupExtractedText(value: string, maxChars = DIRECT_LINK_MAX_CHARS) {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim()
    .slice(0, maxChars);
}

function extractReadableHtml(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1] ? cleanupExtractedText(titleMatch[1], 220) : "";
  const description =
    extractHtmlMeta(html, "description") ||
    extractHtmlMeta(html, "og:description") ||
    extractHtmlMeta(html, "twitter:description");

  const mainMatch =
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = mainMatch?.[1] ?? html;
  const text = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return {
    title,
    description,
    excerpt: cleanupExtractedText(text),
  };
}

async function fetchDirectReferenceLink(url: string): Promise<DirectLinkResearch> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "User-Agent":
          "Mozilla/5.0 (compatible; RagKlickitContentStudio/1.0; +https://ragklickit.local)",
      },
      signal: AbortSignal.timeout(DIRECT_LINK_FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return { url, ok: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const raw = await response.text();

    if (!raw.trim()) {
      return { url, ok: false, error: "respuesta vacia" };
    }

    if (contentType.includes("text/html") || raw.includes("<html") || raw.includes("<body")) {
      const extracted = extractReadableHtml(raw);
      if (!extracted.excerpt && !extracted.title && !extracted.description) {
        return { url, ok: false, error: "HTML sin texto util extraible" };
      }

      return { url, ok: true, ...extracted };
    }

    if (contentType.includes("text/") || contentType.includes("application/json")) {
      return { url, ok: true, excerpt: cleanupExtractedText(raw) };
    }

    return { url, ok: false, error: `tipo de contenido no legible: ${contentType || "desconocido"}` };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchDirectReferenceLinks(links: string[]) {
  const normalizedLinks = Array.from(new Set(links.map(normalizeReferenceUrl).filter(Boolean)));
  if (normalizedLinks.length === 0) return [] as DirectLinkResearch[];

  return Promise.all(normalizedLinks.map((link) => fetchDirectReferenceLink(link)));
}

function formatDirectLinkResearch(results: DirectLinkResearch[]) {
  if (results.length === 0) return "";

  return [
    "LECTURA DIRECTA DE LINKS DEL USUARIO:",
    ...results.map((result, index) => {
      if (!result.ok) {
        return [
          `Fuente ${index + 1}: ${result.url}`,
          `Estado: no se pudo leer directamente (${result.error || "sin detalle"}).`,
        ].join("\n");
      }

      return [
        `Fuente ${index + 1}: ${result.url}`,
        result.title ? `Titulo: ${result.title}` : "",
        result.description ? `Descripcion: ${result.description}` : "",
        result.excerpt ? `Extracto verificable: ${result.excerpt}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  ].join("\n\n");
}

export function assertWebResearchAvailable(webResearchContext: string, artifactLabel = "contenido") {
  const normalized = webResearchContext.trim().toLowerCase();
  if (
    !normalized ||
    normalized.startsWith("investigacion web no disponible") ||
    normalized.startsWith("investigación web no disponible") ||
    normalized.includes("sin investigacion web disponible") ||
    normalized.includes("sin investigación web disponible")
  ) {
    throw new Error(
      `No se pudo generar ${artifactLabel} porque la investigacion web es obligatoria. Revisa OPENAI_API_KEY, OPENAI_BASE_URL y el acceso a web_search.`,
    );
  }
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
  const links = Array.from(new Set(params.links.map(normalizeReferenceUrl).filter(Boolean))).slice(
    0,
    params.maxLinks ?? 8,
  );
  if (links.length === 0) return "";

  const directResults = await fetchDirectReferenceLinks(links);
  const directContext = formatDirectLinkResearch(directResults);
  const hasDirectContext = directResults.some((result) => result.ok);

  const prompt = [
    "Investiga estos links para usarlos como fuente en una generacion de marketing.",
    `Uso previsto: ${params.purpose}`,
    params.country ? `Mercado/pais: ${params.country}` : "",
    params.userContext?.trim() ? `Contexto del usuario:\n${params.userContext.trim().slice(0, 5000)}` : "",
    directContext
      ? `Ya se hizo una lectura directa de los links. Usala como fuente primaria y complementala solo si hace falta:\n${directContext.slice(0, 10000)}`
      : "",
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
      return hasDirectContext
        ? directContext
        : `INVESTIGACION DE LINKS NO DISPONIBLE: ${result.error}`;
    }

    if (!result.text.trim()) {
      return hasDirectContext
        ? directContext
        : "INVESTIGACION DE LINKS NO DISPONIBLE: web_search no devolvio contenido util.";
    }

    return [
      directContext,
      "INVESTIGACION WEB DE LINKS DEL USUARIO:",
      result.text.trim().slice(0, 10000),
      result.sources ? "\nFUENTES RECUPERADAS:\n" + result.sources : "",
    ]
      .join("\n")
      .slice(0, 12000);
  } catch (error) {
    return hasDirectContext
      ? directContext
      : `INVESTIGACION DE LINKS NO DISPONIBLE: ${error instanceof Error ? error.message : String(error)}`;
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
