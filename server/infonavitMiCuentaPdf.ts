import { readInfonavitMiCuentaText, type InfonavitDocumentReading } from "@shared/infonavitMiCuentaDocument";
import { extractPdfPlainText } from "./pdfTextExtraction";

function looksLikePdf(binary: Buffer): boolean {
  return binary.byteLength >= 5 && binary.subarray(0, 5).equals(Buffer.from("%PDF-"));
}

/** Lee el texto nativo del PDF de Mi Cuenta. No guarda el archivo ni pide credenciales. */
export async function readInfonavitMiCuentaPdfBinary(binary: Buffer): Promise<InfonavitDocumentReading> {
  if (!looksLikePdf(binary)) return readInfonavitMiCuentaText("");
  const text = await extractPdfPlainText(binary);
  return readInfonavitMiCuentaText(text);
}
