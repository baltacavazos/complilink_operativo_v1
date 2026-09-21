import { isSmokeAuthCode, isSmokeAuthEmail } from "@shared/smokeAuth";

export { isSmokeAuthCode, isSmokeAuthEmail, normalizeSmokeEmail, SMOKE_AUTH_CODE } from "@shared/smokeAuth";

export function isSmokeAuthEnabled() {
  const flag = (process.env.SMOKE_AUTH ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function canUseSmokeAuth(email: string) {
  return isSmokeAuthEnabled() && isSmokeAuthEmail(email);
}

export function shouldOpenSmokeTestSession(email: string, secret: string) {
  return canUseSmokeAuth(email) && isSmokeAuthCode(secret);
}
