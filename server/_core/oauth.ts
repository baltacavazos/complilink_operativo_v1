import type { Express, Request, Response } from "express";
import {
  buildGoogleAuthorizationUrl,
  completeGoogleLogin,
  createAppSessionForUser,
  syncManusUser,
  verifyGoogleStateToken,
} from "../authService";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getSafeReturnTo(req: Request) {
  const returnTo = getQueryParam(req, "returnTo") || "/";
  return returnTo.startsWith("/") ? returnTo : "/";
}

function isTruthyFlag(value: string | undefined) {
  return value === "1" || value === "true";
}

function buildAccessErrorPath(errorCode: string, returnTo = "/") {
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
  const url = new URL("/acceso", "https://auditapatron.com");
  url.searchParams.set("error", errorCode);

  if (safeReturnTo !== "/") {
    url.searchParams.set("returnTo", safeReturnTo);
  }

  return `${url.pathname}${url.search}`;
}

function buildPostAuthRedirect(targetPath: string, nativeApp = false) {
  const safeTargetPath = targetPath.startsWith("/") ? targetPath : "/";
  return nativeApp ? `auditapatron://${safeTargetPath}` : safeTargetPath;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const returnTo = getSafeReturnTo(req);

    if (!code || !state) {
      res.redirect(302, `/acceso?error=manus_callback_failed&returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.redirect(302, `/acceso?error=manus_callback_failed&returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      const user = await syncManusUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
      });

      await createAppSessionForUser(req, res, {
        openId: user.openId,
        name: user.name || userInfo.name || userInfo.email || "CompliLink",
      });

      res.redirect(302, returnTo);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.redirect(302, `/acceso?error=manus_callback_failed&returnTo=${encodeURIComponent(returnTo)}`);
    }
  });

  app.get("/api/auth/google/start", async (req: Request, res: Response) => {
    const returnTo = getQueryParam(req, "returnTo") || "/";
    const nativeApp = isTruthyFlag(getQueryParam(req, "native"));

    try {
      const authorizationUrl = await buildGoogleAuthorizationUrl(req, returnTo, { nativeApp });
      res.redirect(302, authorizationUrl);
    } catch (error) {
      console.error("[OAuth] Google start failed", error);
      const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
      res.redirect(302, buildPostAuthRedirect(buildAccessErrorPath("google_not_available", safeReturnTo), nativeApp));
    }
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.redirect(302, buildAccessErrorPath("google_callback_failed"));
      return;
    }

    try {
      const { returnTo, nativeApp } = await completeGoogleLogin({ req, res, code, state });
      res.redirect(302, buildPostAuthRedirect(returnTo || "/", nativeApp));
    } catch (error) {
      console.error("[OAuth] Google callback failed", error);

      let returnTo = "/";
      let nativeApp = false;

      try {
        const parsedState = await verifyGoogleStateToken(state);
        returnTo = parsedState.returnTo;
        nativeApp = parsedState.nativeApp;
      } catch {
        // noop: fallback to the generic access route
      }

      res.redirect(302, buildPostAuthRedirect(buildAccessErrorPath("google_callback_failed", returnTo), nativeApp));
    }
  });
}
