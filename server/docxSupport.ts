import mammoth from "mammoth";

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const GENERIC_BINARY_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);

const EXTENSION_TO_MIME = new Map<string, string>([
  [".pdf", "application/pdf"],
  [".xml", "application/xml"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".docx", DOCX_MIME_TYPE],
]);

function inferMimeTypeFromFileName(fileName: string) {
  const lowerName = fileName.trim().toLowerCase();

  for (const [extension, mimeType] of Array.from(EXTENSION_TO_MIME.entries())) {
    if (lowerName.endsWith(extension)) {
      return mimeType;
    }
  }

  return null;
}

export function normalizeAuditarMimeType(fileName: string, mimeType: string) {
  const normalizedMimeType = mimeType.trim().toLowerCase();

  if (!GENERIC_BINARY_MIME_TYPES.has(normalizedMimeType)) {
    return normalizedMimeType;
  }

  return inferMimeTypeFromFileName(fileName) ?? normalizedMimeType;
}

export function isDocxMimeType(mimeType: string) {
  return mimeType.trim().toLowerCase() === DOCX_MIME_TYPE;
}

export function looksLikeZipContainer(binary: Buffer) {
  if (binary.byteLength < 4) {
    return false;
  }

  const signature = binary.subarray(0, 4);
  return (
    signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
    signature.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
    signature.equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
  );
}

export async function extractDocxPlainText(binary: Buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: binary });
    return result.value.replace(/\s+/g, " ").trim().slice(0, 12000);
  } catch (error) {
    throw new Error(
      "No pudimos leer este contrato en DOCX. Vuelve a exportarlo desde Word o súbelo como PDF para continuar."
    );
  }
}
