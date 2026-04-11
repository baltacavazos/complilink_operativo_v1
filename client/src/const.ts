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
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const safeReturnPath = normalizeReturnPath(returnPath);
  const redirectUri = new URL("/api/oauth/callback", window.location.origin);

  if (safeReturnPath !== "/") {
    redirectUri.searchParams.set("returnTo", safeReturnPath);
  }

  const state = btoa(redirectUri.toString());
  const url = new URL(`${oauthPortalUrl}/app-auth`);

  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri.toString());
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
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
