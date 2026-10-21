import { createHash, timingSafeEqual } from "node:crypto";

import { isSmokeAuthEmail } from "@shared/smokeAuth";

export { isSmokeAuthEmail, normalizeSmokeEmail } from "@shared/smokeAuth";

/** Un código más corto no abre el atajo, aunque SMOKE_AUTH esté encendido. */
export const SMOKE_CODE_MIN_LENGTH = 12;

export function readConfiguredSmokeCode(): string | null {
  const value = (process.env.SMOKE_CODE ?? "").trim();
  if (value.length < SMOKE_CODE_MIN_LENGTH) return null;
  return value;
}

function timingSafeEqualText(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function isSmokeAuthCode(code: string) {
  const expected = readConfiguredSmokeCode();
  if (!expected) return false;
  return timingSafeEqualText(code.trim(), expected);
}

export function isSmokeAuthEnabled() {
  const flag = (process.env.SMOKE_AUTH ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function canUseSmokeAuth(email: string) {
  return isSmokeAuthEnabled() && readConfiguredSmokeCode() !== null && isSmokeAuthEmail(email);
}

export function shouldOpenSmokeTestSession(email: string, secret: string) {
  return canUseSmokeAuth(email) && isSmokeAuthCode(secret);
}
