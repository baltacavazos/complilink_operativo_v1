import { afterEach, describe, expect, it } from "vitest";

import { resolveLlmTransport } from "./llm";

const KEYS = ["OPENAI_API_KEY", "GEMINI_API_KEY", "BUILT_IN_FORGE_API_KEY", "BUILT_IN_FORGE_API_URL"] as const;

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    const next = values[key];
    if (next === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = next;
    }
  }
  return () => {
    for (const key of KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

describe("resolveLlmTransport", () => {
  afterEach(() => {
    withEnv({})();
  });

  it("prefiere OPENAI_API_KEY sobre Forge", () => {
    const restore = withEnv({
      OPENAI_API_KEY: "sk-test",
      GEMINI_API_KEY: "gemini-test",
      BUILT_IN_FORGE_API_KEY: "forge-test",
    });
    try {
      const transport = resolveLlmTransport({
        OPENAI_API_KEY: "sk-test",
        GEMINI_API_KEY: "gemini-test",
        BUILT_IN_FORGE_API_KEY: "forge-test",
      });
      expect(transport?.provider).toBe("openai");
      expect(transport?.url).toContain("api.openai.com");
      expect(transport?.model).toBe("gpt-4o-mini");
      expect(JSON.stringify(transport)).not.toMatch(/forge-test/);
    } finally {
      restore();
    }
  });

  it("usa GEMINI_API_KEY si no hay OpenAI", () => {
    const transport = resolveLlmTransport({
      GEMINI_API_KEY: "gemini-test",
      BUILT_IN_FORGE_API_KEY: "forge-test",
    });
    expect(transport?.provider).toBe("gemini");
    expect(transport?.url).toContain("generativelanguage.googleapis.com");
  });

  it("cae a Forge solo si no hay OPENAI ni GEMINI", () => {
    const transport = resolveLlmTransport({
      BUILT_IN_FORGE_API_KEY: "forge-test",
      BUILT_IN_FORGE_API_URL: "https://forge.example",
    });
    expect(transport?.provider).toBe("forge");
    expect(transport?.url).toBe("https://forge.example/v1/chat/completions");
  });

  it("devuelve null y no inventa secretos si no hay llaves", () => {
    expect(resolveLlmTransport({})).toBeNull();
  });
});
