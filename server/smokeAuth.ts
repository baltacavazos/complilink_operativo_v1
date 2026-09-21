/**
 * Bypass de humo: solo correos de prueba y solo si SMOKE_AUTH=1.
 * Nunca abre el OTP de clientes reales.
 */

export const SMOKE_AUTH_CODE = "000000";
const SMOKE_AUTH_DOMAIN = "@auditapatron-smoke.test";
const SMOKE_AUTH_PLUS = "+smoke@";

export function normalizeSmokeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isSmokeAuthEnabled() {
  const flag = (process.env.SMOKE_AUTH ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function isSmokeAuthEmail(email: string) {
  const normalized = normalizeSmokeEmail(email);
  if (!normalized.includes("@") || normalized.startsWith("@")) return false;
  return normalized.endsWith(SMOKE_AUTH_DOMAIN) || normalized.includes(SMOKE_AUTH_PLUS);
}

export function canUseSmokeAuth(email: string) {
  return isSmokeAuthEnabled() && isSmokeAuthEmail(email);
}

export function isSmokeAuthCode(code: string) {
  return code.trim() === SMOKE_AUTH_CODE;
}
