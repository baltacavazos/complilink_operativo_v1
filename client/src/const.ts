export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getPublicWebOrigin, isNativeApp } from "@/lib/nativeRuntime";

function getCurrentReturnPath() {
  if (typeof window === "undefined") return "/";

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return currentPath.startsWith("/acceso") ? "/" : currentPath || "/";
}

function normalizeReturnPath(returnPath?: string) {
  if (!returnPath || !returnPath.startsWith("/")) return "/";
  return returnPath;
}

function toBase64Url(value: string) {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window
      .btoa(value)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  return Buffer.from(value, "utf-8").toString("base64url");
}

export function isHostedManusDomain(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".manus.space") ||
    hostname.endsWith(".manus.computer")
  );
}

export type BuildManusLoginUrlInput = {
  origin: string;
  hostname: string;
  oauthPortalUrl: string | undefined;
  appId: string | undefined;
  returnPath?: string;
};

type ManusAuthType = "signIn" | "signUp";

function buildManusAuthUrl({
  origin,
  oauthPortalUrl,
  appId,
  returnPath,
}: BuildManusLoginUrlInput, type: ManusAuthType) {
  if (!oauthPortalUrl || !appId) {
    return null;
  }

  const safeReturnPath = normalizeReturnPath(returnPath);
  const redirectUri = new URL("/api/oauth/callback", origin);

  if (safeReturnPath !== "/") {
    redirectUri.searchParams.set("returnTo", safeReturnPath);
  }

  const state = toBase64Url(redirectUri.toString());
  const url = new URL(`${oauthPortalUrl}/app-auth`);

  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri.toString());
  url.searchParams.set("redirect_uri", redirectUri.toString());
  url.searchParams.set("state", state);
  url.searchParams.set("type", type);
  url.searchParams.set("locale", "es");

  return url.toString();
}

export function buildManusLoginUrl(input: BuildManusLoginUrlInput) {
  return buildManusAuthUrl(input, "signIn");
}

export function buildManusSignupUrl(input: BuildManusLoginUrlInput) {
  return buildManusAuthUrl(input, "signUp");
}

export const canUseManusLogin = () => {
  return Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);
};

export const getAccessUrl = (returnPath = getCurrentReturnPath()) => {
  if (typeof window === "undefined") return "/acceso";

  const safeReturnPath = normalizeReturnPath(returnPath);
  const url = new URL("/acceso", window.location.origin);

  if (safeReturnPath !== "/") {
    url.searchParams.set("returnTo", safeReturnPath);
  }

  return `${url.pathname}${url.search}`;
};

export const getManusLoginUrl = (returnPath = getCurrentReturnPath()) => {
  if (typeof window === "undefined") return null;

  return buildManusLoginUrl({
    origin: window.location.origin,
    hostname: window.location.hostname,
    oauthPortalUrl: import.meta.env.VITE_OAUTH_PORTAL_URL,
    appId: import.meta.env.VITE_APP_ID,
    returnPath,
  });
};

export const getSignupUrl = (returnPath = getCurrentReturnPath()) => {
  if (typeof window === "undefined") return null;

  return buildManusSignupUrl({
    origin: window.location.origin,
    hostname: window.location.hostname,
    oauthPortalUrl: import.meta.env.VITE_OAUTH_PORTAL_URL,
    appId: import.meta.env.VITE_APP_ID,
    returnPath,
  });
};

export const getGoogleLoginUrl = (returnPath = getCurrentReturnPath()) => {
  const safeReturnPath = normalizeReturnPath(returnPath);
  const nativeApp = isNativeApp();
  const url = new URL("/api/auth/google/start", getPublicWebOrigin());

  if (safeReturnPath !== "/") {
    url.searchParams.set("returnTo", safeReturnPath);
  }

  if (nativeApp) {
    url.searchParams.set("native", "1");
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
};

export const getLoginUrl = (returnPath = getCurrentReturnPath()) => getAccessUrl(returnPath);
