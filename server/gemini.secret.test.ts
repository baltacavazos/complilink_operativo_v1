import { describe, expect, it } from "vitest";

describe("GEMINI_API_KEY secret", () => {
  it("autentica correctamente contra un endpoint ligero de Gemini", async () => {
    const apiKey = process.env.GEMINI_API_KEY;

    expect(apiKey, "GEMINI_API_KEY debe estar presente").toBeTruthy();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey!)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

    const bodyText = await response.text();

    expect(response.status, `Respuesta inesperada de Gemini: ${bodyText}`).toBe(200);
  }, 30000);
});
