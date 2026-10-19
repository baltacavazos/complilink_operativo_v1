import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { contrastRatio, LIGHT_WORKER_BUTTONS } from "./contrast";

describe("contraste de botones visibles", () => {
  it("el tema de arranque es claro", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(app).toContain('defaultTheme="light"');
    expect(app).not.toContain('defaultTheme="dark"');
  });

  it("los botones de la revisión cumplen 4.5:1 en tema claro", () => {
    for (const button of LIGHT_WORKER_BUTTONS) {
      expect(contrastRatio(button.foreground, button.background), button.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("el par oscuro que se veía hoy no alcanza el mínimo", () => {
    const darkOnDark = contrastRatio("#161616", "rgba(15, 23, 42, 0.82)");
    expect(darkOnDark).toBeLessThan(4.5);
  });
});
