/**
 * Allowlist de correos de humo. El flag SMOKE_AUTH y el secreto SMOKE_CODE
 * viven solo en el servidor. Este módulo no conoce el código.
 * Nunca usar esto para clientes reales.
 */

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
