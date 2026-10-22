import { TRPCError } from "@trpc/server";
import type { AuthFlowError } from "./authService";

type AuthFlowCode = AuthFlowError["code"];

/**
 * Expected login rejections stay client errors.
 * The message keeps `text||retry_after=N||code=CODE` so the access screen
 * can show the same copy it already shows.
 */
const AUTH_FLOW_CLIENT_CODE = {
  EMAIL_CODE_EXPIRED: "BAD_REQUEST",
  INVALID_EMAIL_CODE: "UNAUTHORIZED",
  EMAIL_CODE_COOLDOWN_ACTIVE: "TOO_MANY_REQUESTS",
  EMAIL_CODE_RATE_LIMITED: "TOO_MANY_REQUESTS",
} as const satisfies Record<AuthFlowCode, "BAD_REQUEST" | "UNAUTHORIZED" | "TOO_MANY_REQUESTS">;

export function toAuthFlowTrpcError(error: AuthFlowError) {
  const message = error.retryAfterSeconds
    ? `${error.message}||retry_after=${error.retryAfterSeconds}||code=${error.code}`
    : `${error.message}||code=${error.code}`;

  return new TRPCError({
    code: AUTH_FLOW_CLIENT_CODE[error.code],
    message,
    cause: error,
  });
}
