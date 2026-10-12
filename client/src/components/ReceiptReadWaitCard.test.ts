import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RECEIPT_READ_WAIT_ARIA_LIVE,
  RECEIPT_READ_WAIT_COPY,
  ReceiptReadWaitCard,
  receiptReadElapsed,
  receiptReadWaitMessage,
} from "./ReceiptReadWaitCard";

describe("aviso de espera al leer el recibo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cambia los cuatro textos con el reloj y anuncia en voz baja", () => {
    vi.useFakeTimers();
    const started = new Date("2026-10-12T12:00:00.000Z").getTime();
    vi.setSystemTime(started);

    const seen = new Set<string>();
    for (let elapsed = 1_000; elapsed <= 40_000; elapsed += 1_000) {
      seen.add(receiptReadWaitMessage(elapsed));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);

    const phases = [
      { at: 1_000, message: RECEIPT_READ_WAIT_COPY.start, retry: false },
      { at: 8_000, message: RECEIPT_READ_WAIT_COPY.middle, retry: false },
      { at: 20_000, message: RECEIPT_READ_WAIT_COPY.photo, retry: false },
      { at: 45_000, message: RECEIPT_READ_WAIT_COPY.photo, retry: false },
      { at: 45_500, message: RECEIPT_READ_WAIT_COPY.late, retry: true },
    ];

    for (const phase of phases) {
      vi.setSystemTime(started + phase.at);
      expect(receiptReadElapsed(started)).toBe(phase.at);
      expect(receiptReadWaitMessage(receiptReadElapsed(started))).toBe(phase.message);

      const html = renderToStaticMarkup(
        createElement(ReceiptReadWaitCard, {
          startedAt: started,
          onTryAnother: () => undefined,
        }),
      );
      expect(html).toContain(`aria-live="${RECEIPT_READ_WAIT_ARIA_LIVE}"`);
      expect(html).toContain(phase.message);
      expect(html).toContain("Subido ✓ · Leyendo · Resultado");
      expect(html).toContain("font-size:17px");
      expect(html).toContain("#111111");
      expect(html).toContain("#fffdf6");
      expect(html.includes("Probar con otra foto")).toBe(phase.retry);
      expect(html).not.toMatch(/\bcumple\b/);
    }
  });
});
