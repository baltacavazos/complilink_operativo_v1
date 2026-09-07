import type { Request, Response } from "express";
import { SignJWT, decodeJwt, importPKCS8, jwtVerify } from "jose";
import * as db from "./db";
import { ENV } from "./_core/env";
import { createAppSessionForUser } from "./authService";

const APPLE_CALLBACK_PATH = "/api/auth/apple/callback";
const APPLE_START_PATH = "/api/auth/apple/start";
const APPLE_STATE_TTL_MS = 1000 * 60 * 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeReturnToPath(returnTo?: string | null) {
  if (!returnTo || !returnTo.startsWith("/")) {
    return "/";
  }
  return returnTo;
}

function getBaseUrl(req: Request) {
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol || "https";
  const host = req.get("host");
  if (!host) {
    throw new Error("Missing request host");
  }
  return `${protocol}://${host}`;
}

function normalizeApplePrivateKey(raw: string) {
  const trimmed = raw.trim().replace(/\\n/g, "\n");
  if (trimmed.includes("BEGIN PRIVATE KEY")) {
    return trimmed;
  }
  const body = trimmed.replace(/\s+/g, "");
  if (!body) return "";
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
}

export async function ensureTenantMembershipForSignedInUser(user: {
  id: number;
  name: string | null;
  email: string | null;
}) {
  await db.ensureTenantForUser({
    userId: user.id,
    userName: user.name ?? user.email ?? "CompliLink",
    userEmail: user.email,
  });
}

async function resolveOrCreateAppleUser(params: {
  providerUserId: string;
  email?: string | null;
  name?: string | null;
}) {
  const normalizedEmail = params.email ? normalizeEmail(params.email) : null;
  const providerScopedOpenId = `apple:${params.providerUserId}`;
  const existingProviderUser = await db.getUserByOpenId(providerScopedOpenId);
  const existingUserByEmail = normalizedEmail ? await db.getUserByEmail(normalizedEmail) : undefined;
  const existingUser = existingProviderUser ?? existingUserByEmail;
  const openId = existingUser?.openId ?? providerScopedOpenId;
  const name = params.name?.trim() || existingUser?.name || normalizedEmail || params.providerUserId;

  await db.upsertUser({
    openId,
    name,
    email: normalizedEmail ?? existingUser?.email ?? null,
    loginMethod: "apple",
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(openId);
  if (!user) {
    throw new Error("Could not resolve user after Apple sign-in");
  }
  return user;
}

export function getAppleStartPath() {
  return APPLE_START_PATH;
}

export function isAppleOAuthConfigured() {
  return Boolean(
    ENV.appleClientId.trim() &&
      ENV.appleTeamId.trim() &&
      ENV.appleKeyId.trim() &&
      ENV.applePrivateKey.trim(),
  );
}

export function getAppleCallbackUrl(req: Request) {
  return `${getBaseUrl(req)}${APPLE_CALLBACK_PATH}`;
}

async function signAppleStateToken(payload: { returnTo: string; nativeApp?: boolean }) {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const expirationSeconds = Math.floor((Date.now() + APPLE_STATE_TTL_MS) / 1000);

  return new SignJWT({
    purpose: "apple_oauth",
    returnTo: normalizeReturnToPath(payload.returnTo),
    nativeApp: payload.nativeApp === true,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

export async function verifyAppleStateToken(token: string) {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
  if (payload.purpose !== "apple_oauth") {
    throw new Error("Invalid Apple OAuth state");
  }

  return {
    returnTo: normalizeReturnToPath(typeof payload.returnTo === "string" ? payload.returnTo : "/"),
    nativeApp: payload.nativeApp === true,
  };
}

async function generateAppleClientSecret() {
  if (!isAppleOAuthConfigured()) {
    throw new Error("Apple OAuth is not configured");
  }

  const privateKeyPem = normalizeApplePrivateKey(ENV.applePrivateKey);
  const key = await importPKCS8(privateKeyPem, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: ENV.appleKeyId })
    .setIssuer(ENV.appleTeamId)
    .setSubject(ENV.appleClientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 30)
    .sign(key);
}

export async function buildAppleAuthorizationUrl(
  req: Request,
  returnTo: string = "/",
  options?: { nativeApp?: boolean },
) {
  if (!isAppleOAuthConfigured()) {
    throw new Error("Apple OAuth is not configured");
  }

  const state = await signAppleStateToken({
    returnTo: normalizeReturnToPath(returnTo),
    nativeApp: options?.nativeApp === true,
  });
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("client_id", ENV.appleClientId);
  url.searchParams.set("redirect_uri", getAppleCallbackUrl(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", state);
  return url.toString();
}

function parseAppleFormUserName(rawUser: unknown): string | null {
  if (typeof rawUser !== "string" || !rawUser.trim()) return null;
  try {
    const parsed = JSON.parse(rawUser) as {
      name?: { firstName?: string; lastName?: string };
    };
    const first = parsed?.name?.firstName?.trim() || "";
    const last = parsed?.name?.lastName?.trim() || "";
    const full = `${first} ${last}`.trim();
    return full || null;
  } catch {
    return null;
  }
}

export async function completeAppleLogin(params: {
  req: Request;
  res: Response;
  code: string;
  state: string;
  rawUser?: unknown;
}) {
  if (!isAppleOAuthConfigured()) {
    throw new Error("Apple OAuth is not configured");
  }

  const { returnTo, nativeApp } = await verifyAppleStateToken(params.state);
  const redirectUri = getAppleCallbackUrl(params.req);
  const clientSecret = await generateAppleClientSecret();

  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: ENV.appleClientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Apple token exchange failed: ${tokenResponse.status} ${errorText}`);
  }

  const tokenJson = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenJson.id_token) {
    throw new Error("Apple token exchange returned no id_token");
  }

  const claims = decodeJwt(tokenJson.id_token) as {
    sub?: string;
    email?: string;
  };
  if (!claims.sub) {
    throw new Error("Apple id_token is missing required identity fields");
  }

  const formName = parseAppleFormUserName(params.rawUser);
  const email = typeof claims.email === "string" ? claims.email : null;
  const name = formName || email || claims.sub;

  const user = await resolveOrCreateAppleUser({
    providerUserId: claims.sub,
    email,
    name,
  });

  await createAppSessionForUser(params.req, params.res, {
    openId: user.openId,
    name: user.name ?? name,
  });
  await ensureTenantMembershipForSignedInUser(user);

  return { returnTo, nativeApp, user };
}
