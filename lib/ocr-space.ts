type OcrSpaceParsedResult = {
  FileParseExitCode?: number | string;
  ParsedText?: string | null;
  ErrorMessage?: string | string[] | null;
  ErrorDetails?: string | string[] | null;
};

type OcrSpaceResponse = {
  ParsedResults?: OcrSpaceParsedResult[] | null;
  OCRExitCode?: number | string;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[] | null;
  ErrorDetails?: string | string[] | null;
};

function formatOcrSpaceError(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  return value?.trim() ?? "";
}

function getOcrSpaceLanguage(engine: string) {
  const configured = process.env.OCR_SPACE_LANGUAGE?.trim();
  if (configured) return configured;
  return engine === "3" ? "auto" : "spa";
}

export async function transcribePdfWithOcrSpace(fileName: string, bytes: Uint8Array) {
  const apiKey = process.env.OCR_SPACE_API_KEY?.trim();
  if (!apiKey) {
    return "";
  }

  const endpoint = process.env.OCR_SPACE_ENDPOINT?.trim() || "https://api.ocr.space/parse/image";
  const engine = process.env.OCR_SPACE_ENGINE?.trim() || "2";
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const fileBlob = new Blob([arrayBuffer], { type: "application/pdf" });
  const formData = new FormData();

  formData.append("file", fileBlob, fileName);
  formData.append("language", getOcrSpaceLanguage(engine));
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("isTable", "true");
  formData.append("OCREngine", engine);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: apiKey,
    },
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error en OCR.space (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as OcrSpaceResponse;
  const parsedResults = data.ParsedResults ?? [];
  const parsedText = parsedResults
    .map((result) => result.ParsedText?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (parsedText) {
    return parsedText;
  }

  const responseError =
    formatOcrSpaceError(data.ErrorMessage) ||
    formatOcrSpaceError(data.ErrorDetails) ||
    parsedResults
      .map((result) => formatOcrSpaceError(result.ErrorMessage) || formatOcrSpaceError(result.ErrorDetails))
      .filter(Boolean)
      .join(" ");

  if (responseError) {
    throw new Error(`OCR.space no pudo leer el PDF: ${responseError}`);
  }

  return "";
}
