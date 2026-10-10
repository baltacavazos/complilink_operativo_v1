import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RECEIPT_READ_WAIT_ARIA_LIVE,
  RECEIPT_READ_WAIT_COPY,
  receiptReadWaitMessage,
} from "./ReceiptReadWaitCard";

const source = readFileSync(new URL("./ReceiptReadWaitCard.tsx", import.meta.url), "utf8");

describe("aviso de espera al leer el recibo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cambia los cuatro textos con el reloj y anuncia en voz baja", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00.000Z"));
    const started = Date.now();
    let elapsedMs = 0;
    const timer = setInterval(() => {
      elapsedMs = Date.now() - started;
    }, 500);

    const read = () => ({
      message: receiptReadWaitMessage(elapsedMs),
      ariaLive: RECEIPT_READ_WAIT_ARIA_LIVE,
    });

    expect(read()).toEqual({
      message: RECEIPT_READ_WAIT_COPY.start,
      ariaLive: "polite",
    });

    vi.advanceTimersByTime(8_000);
    expect(read().message).toBe(RECEIPT_READ_WAIT_COPY.middle);
    expect(read().ariaLive).toBe("polite");

    vi.advanceTimersByTime(12_000);
    expect(read().message).toBe(RECEIPT_READ_WAIT_COPY.photo);

    vi.advanceTimersByTime(25_000);
    expect(read().message).toBe(RECEIPT_READ_WAIT_COPY.photo);

    vi.advanceTimersByTime(500);
    expect(read().message).toBe(RECEIPT_READ_WAIT_COPY.late);
    expect(source).toContain('aria-live={RECEIPT_READ_WAIT_ARIA_LIVE}');
    expect(source).toContain("text-base");
    expect(source).toContain("Subido ✓ · Leyendo · Resultado");
    expect(source).toContain("Probar con otra foto");
    expect(source).not.toMatch(/\bcumple\b/);

    clearInterval(timer);
  });
});
