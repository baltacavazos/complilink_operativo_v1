/**
 * Allowlist de correos de humo. El flag SMOKE_AUTH vive solo en el servidor.
 * Nunca usar esto para clientes reales.
 */

export const SMOKE_AUTH_CODE = "000000";
const SMOKE_AUTH_DOMAIN = "@auditapatron-smoke.test";
const SMOKE_AUTH_PLUS = "+smoke@";

export function normalizeSmokeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isSmokeAuthEmail(email: string) {
  const normalized = normalizeSmokeEmail(email);
  if (!normalized.includes("@") || normalized.startsWith("@")) return false;
  return normalized.endsWith(SMOKE_AUTH_DOMAIN) || normalized.includes(SMOKE_AUTH_PLUS);
}

export function isSmokeAuthCode(code: string) {
  return code.trim() === SMOKE_AUTH_CODE;
}
