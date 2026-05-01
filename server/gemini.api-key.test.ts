import { describe, expect, it } from 'vitest';

describe('GEMINI_API_KEY', () => {
  it('permite consultar modelos disponibles en Gemini', async () => {
    const apiKey = process.env.GEMINI_API_KEY;

    expect(apiKey, 'GEMINI_API_KEY debe estar definida').toBeTruthy();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const body = await response.json();

    expect(response.ok, JSON.stringify(body)).toBe(true);
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.models.length).toBeGreaterThan(0);
  }, 30000);
});
