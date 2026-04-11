import type { Express, Request, Response } from "express";
import {
  buildGoogleAuthorizationUrl,
  completeGoogleLogin,
  createAppSessionForUser,
  syncManusUser,
} from "../authService";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
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

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/auth/google/start", async (req: Request, res: Response) => {
    const returnTo = getQueryParam(req, "returnTo") || "/";

    try {
      const authorizationUrl = await buildGoogleAuthorizationUrl(req, returnTo);
      res.redirect(302, authorizationUrl);
    } catch (error) {
      console.error("[OAuth] Google start failed", error);
      const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
      res.redirect(302, `/acceso?error=google_not_available&returnTo=${encodeURIComponent(safeReturnTo)}`);
    }
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.redirect(302, "/acceso?error=google_callback_failed");
      return;
    }

    try {
      const { returnTo } = await completeGoogleLogin({ req, res, code, state });
      res.redirect(302, returnTo || "/");
    } catch (error) {
      console.error("[OAuth] Google callback failed", error);
      res.redirect(302, "/acceso?error=google_callback_failed");
    }
  });
}
