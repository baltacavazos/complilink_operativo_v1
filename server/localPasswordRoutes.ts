import type { Express, Request, Response } from "express";

import {
  ensureLocalAuthTables,
  isLocalPasswordAuthEnabled,
  loginLocalPasswordAccount,
  registerLocalPasswordAccount,
} from "./localPasswordAuth";

function normalizeReturnPath(returnPath?: unknown) {
  if (typeof returnPath !== "string" || !returnPath.startsWith("/") || returnPath.startsWith("//")) {
    return "/";
  }
  return returnPath;
}

function readBody(req: Request) {
  const body = req.body as { email?: unknown; password?: unknown; name?: unknown; returnPath?: unknown };
  return {
    email: typeof body?.email === "string" ? body.email : "",
    password: typeof body?.password === "string" ? body.password : "",
    name: typeof body?.name === "string" ? body.name : undefined,
    returnPath: normalizeReturnPath(body?.returnPath),
  };
}

function sendAuthError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo completar el acceso.";
  const status = message.includes("ya tiene una cuenta")
    ? 409
    : message.includes("incorrectos")
      ? 401
      : message.includes("no está activo")
        ? 403
        : 400;
  res.status(status).json({ error: message });
}

export function registerLocalPasswordRoutes(app: Express) {
  app.get("/api/auth/local/status", (_req: Request, res: Response) => {
    res.json({
      enabled: isLocalPasswordAuthEnabled(),
      mode: "password",
    });
  });

  app.post("/api/auth/local/register", async (req: Request, res: Response) => {
    try {
      const input = readBody(req);
      const user = await registerLocalPasswordAccount({
        req,
        res,
        email: input.email,
        password: input.password,
        name: input.name,
      });
      res.json({
        ok: true,
        returnPath: input.returnPath,
        user: { openId: user.openId, email: user.email, name: user.name },
      });
    } catch (error) {
      console.error("[LocalAuth] Register failed", error);
      sendAuthError(res, error);
    }
  });

  app.post("/api/auth/local/login", async (req: Request, res: Response) => {
    try {
      const input = readBody(req);
      const user = await loginLocalPasswordAccount({
        req,
        res,
        email: input.email,
        password: input.password,
      });
      res.json({
        ok: true,
        returnPath: input.returnPath,
        user: { openId: user.openId, email: user.email, name: user.name },
      });
    } catch (error) {
      console.error("[LocalAuth] Login failed", error);
      sendAuthError(res, error);
    }
  });
}

export async function bootstrapLocalPasswordAuthOnBoot() {
  if (!isLocalPasswordAuthEnabled()) return;
  try {
    await ensureLocalAuthTables();
  } catch (error) {
    console.error("[LocalAuth] No se pudieron crear tablas al arrancar", error);
  }
}
