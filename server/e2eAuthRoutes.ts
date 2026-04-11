import type { Express, Request, Response } from "express";
import { createAppSessionForUser } from "./authService";
import { upsertUser } from "./db";

function isE2EAuthEnabled() {
  return process.env.NODE_ENV === "development";
}

function isAuthorized(req: Request) {
  const expectedToken = process.env.JWT_SECRET;
  const providedToken = req.header("x-complilink-e2e-token");

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
}

export function registerE2EAuthRoutes(app: Express) {
  if (!isE2EAuthEnabled()) {
    return;
  }

  app.post("/api/testing/login-owner", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) {
      res.status(403).json({ success: false, message: "E2E auth token missing or invalid" });
      return;
    }

    const ownerOpenId = process.env.OWNER_OPEN_ID;
    const ownerName = process.env.OWNER_NAME || "CompliLink Owner";

    if (!ownerOpenId) {
      res.status(500).json({ success: false, message: "OWNER_OPEN_ID is not configured" });
      return;
    }

    try {
      await upsertUser({
        openId: ownerOpenId,
        name: ownerName,
        loginMethod: "manus",
        role: "admin",
        lastSignedIn: new Date(),
      });

      await createAppSessionForUser(req, res, {
        openId: ownerOpenId,
        name: ownerName,
      });

      res.json({
        success: true,
        user: {
          openId: ownerOpenId,
          name: ownerName,
          roleHint: "admin",
        },
      });
    } catch (error) {
      console.error("Failed to create E2E owner session", error);
      res.status(500).json({ success: false, message: "Could not create E2E owner session" });
    }
  });
}
