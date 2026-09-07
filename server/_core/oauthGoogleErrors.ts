/** Google OAuth token-exchange error helpers (invalid_client clarity). */
export type GoogleTokenError = Error & { googleError?: string; redirectErrorCode?: string };

export function buildGoogleTokenExchangeError(
  status: number,
  errorText: string,
): GoogleTokenError {
  let googleError = "";
  let googleErrorDescription = "";
  try {
    const parsed = JSON.parse(errorText) as { error?: string; error_description?: string };
    googleError = typeof parsed.error === "string" ? parsed.error : "";
    googleErrorDescription =
      typeof parsed.error_description === "string" ? parsed.error_description : "";
  } catch {
    // keep raw text below when body is not JSON
  }

  const detailParts = [
    googleError ? `error=${googleError}` : "",
    googleErrorDescription ? `error_description=${googleErrorDescription}` : "",
  ].filter(Boolean);
  const detail = detailParts.length > 0 ? detailParts.join("; ") : errorText.slice(0, 300);

  const message = `Google token exchange failed: ${status} ${detail}`;
  const err = new Error(message) as GoogleTokenError;
  err.googleError = googleError || undefined;
  if (googleError === "invalid_client") {
    err.redirectErrorCode = "google_invalid_client";
    err.message =
      "Google token exchange failed: 401 error=invalid_client; " +
      "revisa GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (sin espacios) en Railway";
  }
  return err;
}
