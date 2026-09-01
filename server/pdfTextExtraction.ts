import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";

const MAX_PDF_PAGES = 16;
const MAX_PDF_TEXT_LENGTH = 12000;
const require = createRequire(import.meta.url);

function getStandardFontDataPath() {
  const pdfBuildPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontsPath = join(dirname(pdfBuildPath), "..", "..", "standard_fonts") + sep;
  // The Node factory inside PDF.js calls fs.readFile directly, so it needs a
  // filesystem path rather than a file:// URL.
  return standardFontsPath;
}

/**
 * Reads the native text layer of a printable PDF. It deliberately does not run OCR:
 * callers can distinguish a PDF with no selectable text from one whose visible text
 * has actually been supplied to the payroll extractor.
 */
export async function extractPdfPlainText(binary: Buffer): Promise<string> {
  if (binary.byteLength === 0 || !binary.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    return "";
  }

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: new Uint8Array(binary),
      standardFontDataUrl: getStandardFontDataPath(),
    });
    const document = await task.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, MAX_PDF_PAGES); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map(item => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      if (pageText) pages.push(pageText);
      if (pages.join(" ").length >= MAX_PDF_TEXT_LENGTH) break;
    }

    await document.destroy();
    return pages.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_PDF_TEXT_LENGTH);
  } catch {
    return "";
  }
}
