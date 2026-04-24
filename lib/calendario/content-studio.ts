import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { aiChat } from "@/lib/ollama/client";
import { buildCalendarioStudioPrompt } from "@/lib/calendario/prompts";
import {
  type CalendarioContent,
  type CalendarioGeneratedImage,
  type CalendarioItem,
  type CalendarioItemAssetBundle,
  normalizeCalendarioContent,
} from "@/lib/calendario/schema";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getContentKind(item: CalendarioItem): CalendarioItemAssetBundle["content_kind"] {
  const format = item.formato.toLowerCase();
  const channel = item.canal.toLowerCase();

  if (format.includes("carrusel")) return "carousel";
  if (format.includes("video") || format.includes("reel") || channel.includes("youtube") || channel.includes("tiktok")) {
    return "video";
  }
  if (format.includes("art") || channel.includes("blog")) return "blog";
  if (format.includes("email") || format.includes("newsletter") || channel.includes("email")) return "email";
  return "social";
}

function isLongformItem(item: CalendarioItem) {
  const format = item.formato.toLowerCase();
  const channel = item.canal.toLowerCase();
  return format.includes("art") || channel.includes("blog");
}

function getImageCount(item: CalendarioItem) {
  const format = item.formato.toLowerCase();
  if (format.includes("carrusel")) return 4;
  return 1;
}

function buildImagePrompts(params: {
  item: CalendarioItem;
  imageCount: number;
  basePrompt: string;
}) {
  const { item, imageCount, basePrompt } = params;

  if (imageCount <= 1) {
    return [
      [
        basePrompt,
        `Formato final: ${item.formato}.`,
        "Entregar una sola imagen lista para publicacion.",
        "Sin texto incrustado, sin logos inventados, sin marcas de agua.",
      ].join(" "),
    ];
  }

  return Array.from({ length: imageCount }, (_, index) =>
    [
      basePrompt,
      `Carrusel slide ${index + 1} de ${imageCount}.`,
      index === 0
        ? "Esta primera pieza debe funcionar como portada potente y detener el scroll."
        : "Mantener continuidad visual exacta con la portada y el resto del carrusel.",
      "Definir una sola idea visual clara por slide.",
      "Sin texto incrustado, sin logos inventados, sin marcas de agua.",
    ].join(" "),
  );
}

function getImageProvider() {
  const explicit = (process.env.IMAGE_PROVIDER ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  if ((process.env.STABLE_DIFFUSION_API_URL ?? "").trim()) return "stable-diffusion";
  return "openai";
}

function getEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function generateCalendarioItemBundle(params: {
  empresaNombre: string;
  calendarioTitulo: string;
  periodo: string;
  item: CalendarioItem;
  webResearchContext?: string;
  userGenerationContext?: {
    instructions?: string;
    referenceLinks?: string[];
    referenceInfo?: string;
    referenceLinkContext?: string;
  };
  existingBundle?: CalendarioItemAssetBundle | null;
}) {
  const {
    empresaNombre,
    calendarioTitulo,
    periodo,
    item,
    webResearchContext,
    userGenerationContext,
    existingBundle,
  } = params;
  const imageCount = getImageCount(item);
  const isLongform = isLongformItem(item);
  const contentKind = getContentKind(item);

  const contentDraft = await aiChat({
    systemPrompt:
      "Eres un content strategist senior para marketing. Devuelves SOLO JSON valido, especifico, publicable y sin markdown fuera de los campos permitidos.",
    userPrompt: buildCalendarioStudioPrompt({
      empresaNombre,
      calendarioTitulo,
      periodo,
      item,
      contentKind,
      isLongform,
      webResearchContext,
      userGenerationContext,
      existingBundle,
    }),
    temperature: 0.45,
  });

  const parsed = safeJsonParse(
    contentDraft,
    {
      content_kind: contentKind,
      headline: item.titulo_base || item.tema,
      caption: "",
      short_copy: "",
      blog_title: "",
      blog_body_markdown: "",
      email_subject: "",
      email_preheader: "",
      email_body_markdown: "",
      video_hook: "",
      video_script: "",
      carousel_slides: [],
      cta: item.CTA,
      hashtags: [],
      visual_direction: "",
      image_prompt_base: "",
    },
  );

  const basePrompt =
    typeof parsed.image_prompt_base === "string" && parsed.image_prompt_base.trim()
      ? parsed.image_prompt_base.trim()
      : [
          `Crear una pieza visual para ${empresaNombre}.`,
          `Canal: ${item.canal}. Formato: ${item.formato}.`,
          `Tema: ${item.tema || item.titulo_base || "Sin tema"}.`,
          `Direccion visual: ${parsed.visual_direction || "Editorial, moderna y profesional"}.`,
          "Sin texto incrustado en la imagen.",
        ].join(" ");

  return {
    generated_at: new Date().toISOString(),
    content_kind: contentKind,
    headline: typeof parsed.headline === "string" ? parsed.headline : item.titulo_base || item.tema,
    caption: typeof parsed.caption === "string" ? parsed.caption : "",
    short_copy: typeof parsed.short_copy === "string" ? parsed.short_copy : "",
    blog_title: isLongform && typeof parsed.blog_title === "string" ? parsed.blog_title : "",
    blog_body_markdown:
      isLongform && typeof parsed.blog_body_markdown === "string" ? parsed.blog_body_markdown : "",
    email_subject: contentKind === "email" && typeof parsed.email_subject === "string" ? parsed.email_subject : "",
    email_preheader:
      contentKind === "email" && typeof parsed.email_preheader === "string" ? parsed.email_preheader : "",
    email_body_markdown:
      contentKind === "email" && typeof parsed.email_body_markdown === "string"
        ? parsed.email_body_markdown
        : "",
    video_hook: contentKind === "video" && typeof parsed.video_hook === "string" ? parsed.video_hook : "",
    video_script: contentKind === "video" && typeof parsed.video_script === "string" ? parsed.video_script : "",
    carousel_slides:
      contentKind === "carousel" && Array.isArray(parsed.carousel_slides)
        ? (parsed.carousel_slides.filter((entry) => typeof entry === "string") as string[])
        : [],
    cta: typeof parsed.cta === "string" && parsed.cta.trim() ? parsed.cta : item.CTA,
    hashtags: Array.isArray(parsed.hashtags)
      ? (parsed.hashtags.filter((tag) => typeof tag === "string") as string[])
      : [],
    visual_direction: typeof parsed.visual_direction === "string" ? parsed.visual_direction : "",
    image_prompt_base: basePrompt,
    image_count: imageCount,
    image_prompts: buildImagePrompts({
      item,
      imageCount,
      basePrompt,
    }),
    images: [] as CalendarioGeneratedImage[],
  } satisfies CalendarioItemAssetBundle;
}

async function generateImageWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY para generar imagenes.");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "high",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`No se pudo generar imagen OpenAI (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("La API de imagen no devolvio contenido util.");
  }

  return Buffer.from(b64, "base64");
}

async function generateImageWithStableDiffusion(prompt: string) {
  const apiUrl = (process.env.STABLE_DIFFUSION_API_URL ?? "http://127.0.0.1:7860").replace(/\/$/, "");
  const endpoint = `${apiUrl}/sdapi/v1/txt2img`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt:
        process.env.STABLE_DIFFUSION_NEGATIVE_PROMPT ??
        "blurry, low quality, distorted, deformed, bad anatomy, watermark, text, logo, duplicate",
      steps: getEnvNumber("STABLE_DIFFUSION_STEPS", 30),
      cfg_scale: getEnvNumber("STABLE_DIFFUSION_CFG_SCALE", 7),
      width: getEnvNumber("STABLE_DIFFUSION_WIDTH", 1024),
      height: getEnvNumber("STABLE_DIFFUSION_HEIGHT", 1024),
      sampler_name: process.env.STABLE_DIFFUSION_SAMPLER ?? "DPM++ 2M Karras",
      override_settings: process.env.STABLE_DIFFUSION_MODEL
        ? { sd_model_checkpoint: process.env.STABLE_DIFFUSION_MODEL }
        : undefined,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `No se pudo generar imagen con Stable Diffusion (${response.status}): ${errorBody.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    images?: string[];
  };

  const b64 = data.images?.[0];
  if (!b64) {
    throw new Error("Stable Diffusion no devolvio ninguna imagen.");
  }

  const cleaned = b64.includes(",") ? b64.split(",").pop() ?? "" : b64;
  return Buffer.from(cleaned, "base64");
}

async function generateImageBinary(prompt: string) {
  const provider = getImageProvider();

  if (provider === "stable-diffusion" || provider === "stable_diffusion" || provider === "sd") {
    return generateImageWithStableDiffusion(prompt);
  }

  return generateImageWithOpenAI(prompt);
}

async function saveBufferToPublic(params: {
  calendarioId: string;
  itemId: string;
  imageId: string;
  image: Buffer;
}) {
  const { calendarioId, itemId, imageId, image } = params;
  const relDir = path.join("generated", "calendario", slugify(calendarioId), slugify(itemId));
  const absDir = path.join(PUBLIC_ROOT, relDir);
  await mkdir(absDir, { recursive: true });

  const fileName = `${slugify(imageId)}.png`;
  const absFile = path.join(absDir, fileName);
  await writeFile(absFile, image);

  return `/${path.posix.join(relDir.replace(/\\/g, "/"), fileName)}`;
}

export async function generateCalendarioItemImages(params: {
  calendarioId: string;
  item: CalendarioItem;
  bundle: CalendarioItemAssetBundle;
}) {
  const { calendarioId, item, bundle } = params;
  const images: CalendarioGeneratedImage[] = [];

  for (let index = 0; index < bundle.image_count; index++) {
    const isCarousel = bundle.image_count > 1;
    const prompt = isCarousel
      ? `${bundle.image_prompt_base}\nPanel ${index + 1} de ${bundle.image_count}. Mantener coherencia visual con una serie de carrusel.`
      : bundle.image_prompt_base;

    const binary = await generateImageBinary(prompt);
    const imageId = `${item.id}-${index + 1}`;
    const publicPath = await saveBufferToPublic({
      calendarioId,
      itemId: item.id,
      imageId,
      image: binary,
    });

    images.push({
      id: imageId,
      path: publicPath,
      prompt,
      alt: `${bundle.headline || item.titulo_base || item.tema || item.canal} ${index + 1}`,
    });
  }

  return images;
}

export async function saveCalendarioItemBundle(params: {
  supabase: SupabaseClient;
  agenciaId: string;
  empresaId: string;
  calendarioId: string;
  itemId: string;
  bundle: CalendarioItemAssetBundle;
}) {
  const { supabase, agenciaId, empresaId, calendarioId, itemId, bundle } = params;

  const { data: artifact, error } = await supabase
    .from("rag_artifacts")
    .select("id, title, status, version, content_json")
    .eq("id", calendarioId)
    .eq("artifact_type", "calendario")
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer calendario: ${error.message}`);
  }

  if (!artifact?.id) {
    throw new Error("Calendario no encontrado o sin acceso.");
  }

  const normalized = normalizeCalendarioContent(artifact.content_json);
  const nextItems = normalized.calendario.items.map((item) =>
    item.id === itemId ? { ...item, asset_bundle: bundle } : item,
  );

  const nextContent: CalendarioContent = normalizeCalendarioContent({
    ...normalized,
    calendario: {
      ...normalized.calendario,
      items: nextItems,
    },
  });

  const { error: updateError } = await supabase
    .from("rag_artifacts")
    .update({
      content_json: nextContent,
      updated_at: new Date().toISOString(),
      version: (artifact.version ?? 1) + 1,
    })
    .eq("id", artifact.id);

  if (updateError) {
    throw new Error(`No se pudo guardar assets del calendario: ${updateError.message}`);
  }

  return nextContent;
}
