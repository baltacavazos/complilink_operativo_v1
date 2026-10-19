export const SHARE_SITE = "https://auditapatron.com";

export const SHARE_REWARD_COPY = "Por cada compa que revise su recibo, te ganas 1 revisión extra.";

export function buildShareText(code: string): string {
  const ref = code.trim();
  return `Revisé mi recibo gratis en AuditaPatrón: en un minuto me explicó mis descuentos y me dijo qué contestó el SAT. Revisa el tuyo, es gratis y tu patrón no se entera 👉 ${SHARE_SITE}/?ref=${ref}`;
}

export function shareWhatsappHref(code: string): string {
  return `https://wa.me/?text=${encodeURIComponent(buildShareText(code))}`;
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createReferralCode(random: () => number = Math.random): string {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)] ?? "A";
  }
  return code;
}

export function isReferralCode(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Z2-9]{6}$/.test(value.trim());
}

/** El texto compartido no puede llevar datos del recibo. El código de referido sí puede tener dígitos. */
export function shareTextLeaksPrivateFacts(text: string, code: string): boolean {
  const withoutRef = text.replaceAll(code, "").replace(/ref=[A-Z2-9]{6}/g, "");
  if (withoutRef.includes("$")) return true;
  if (/\d{4,}/.test(withoutRef)) return true;
  if (/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/.test(withoutRef)) return true;
  if (/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/.test(withoutRef)) return true;
  return false;
}
