export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

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

export function buildManusLoginUrl({
  origin,
  hostname,
  oauthPortalUrl,
  appId,
  returnPath,
}: BuildManusLoginUrlInput) {
  if (!isHostedManusDomain(hostname) || !oauthPortalUrl || !appId) {
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
  url.searchParams.set("type", "signIn");

  return url.toString();
}

export const canUseManusLogin = () => {
  if (typeof window === "undefined") return true;
  return isHostedManusDomain(window.location.hostname);
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

export const getGoogleLoginUrl = (returnPath = getCurrentReturnPath()) => {
  if (typeof window === "undefined") return "/api/auth/google/start";

  const safeReturnPath = normalizeReturnPath(returnPath);
  const url = new URL("/api/auth/google/start", window.location.origin);

  if (safeReturnPath !== "/") {
    url.searchParams.set("returnTo", safeReturnPath);
  }

  return `${url.pathname}${url.search}`;
};

export const getLoginUrl = (returnPath = getCurrentReturnPath()) => getAccessUrl(returnPath);
