import { describe, expect, it } from "vitest";

describe("OPENAI_API_KEY secret", () => {
  it("autentica correctamente contra un endpoint ligero de OpenAI", async () => {
    const apiKey = process.env.OPENAI_API_KEY;

    expect(apiKey, "OPENAI_API_KEY debe estar presente").toBeTruthy();

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const bodyText = await response.text();

    expect(response.status, `Respuesta inesperada de OpenAI: ${bodyText}`).toBe(200);
  }, 30000);
});
