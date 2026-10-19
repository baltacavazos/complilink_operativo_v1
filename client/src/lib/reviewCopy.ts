export function reviewCopyWithoutIdentity(text: string) {
  return text
    .replace(/\bse ve el NSS\s+[A-Z0-9-]{6,}/gi, "se ve tu número del IMSS")
    .replace(/\bNSS\s+[A-Z0-9-]{6,}/gi, "tu número del IMSS")
    .replace(/\bCURP:\s*[^.]+\.?/gi, "")
    .replace(/\bRFC de la persona trabajadora:\s*[^.]+\.?/gi, "")
    .replace(/\bRFC del patrón:\s*[^.]+\.?/gi, "")
    .replace(/\bRFC:\s*[A-ZÑ&0-9]{10,13}\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Línea visible de “IMSS según este documento”: sin el número y sin “el tu”. */
export function plainReceiptImssLine(imss: string) {
  const redacted = reviewCopyWithoutIdentity(imss);
  if (/se ve tu número del IMSS/i.test(redacted)) {
    return "En tu recibo aparece tu número del IMSS. Esto sale de tu recibo, no de una respuesta del IMSS.";
  }
  return redacted;
}
