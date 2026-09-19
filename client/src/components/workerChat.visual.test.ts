import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function read(...segments: string[]) {
  return readFileSync(resolve(currentDir, ...segments), "utf8");
}

describe("worker chat visual polish", () => {
  it("deja burbujas, chips y compositor Apple-quiet sin rediseñar la estructura", () => {
    const sheet = read("HeliosCopilotSheet.tsx");
    const chat = read("AIChatBox.tsx");
    const css = read("../index.css");

    expect(sheet).toContain('data-testid="ap-worker-chat"');
    expect(sheet).toContain("ap-worker-chat");
    expect(sheet).toContain("ap-chat-chip");
    expect(sheet).toContain("ap-chat-prompt");
    expect(sheet).toContain('variant="calm"');
    expect(sheet).toContain("sanitizeMultiline");
    expect(sheet).toContain("WORKER_CHAT_SHEET_COPY");
    expect(sheet).not.toContain("uppercase tracking-[0.14em]");
    expect(sheet).not.toMatch(/["'`][^"'`]*\bHelios\b[^"'`]*["'`]/);
    expect(sheet).not.toMatch(/["'`][^"'`]*CompliLink[^"'`]*["'`]/);

    expect(chat).toContain("CalmAssistantAnswer");
    expect(chat).toContain("parseWorkerStructuredAnswer");
    expect(chat).toContain("sanitizeVisibleChatHistoryContent");
    expect(chat).toContain("ap-chat-section-next");
    expect(chat).toContain('ap-chat-next-step');
    expect(css).toContain(".ap-worker-chat .ap-chat-section-next");
    expect(sheet).toContain("sanitizeVisibleChatHistoryContent");
    expect(chat).toContain('variant?: "default" | "calm"');
    expect(chat).toContain("ap-chat-bubble-user");
    expect(chat).toContain("ap-chat-bubble-assistant");
    expect(chat).toContain("ap-chat-composer");
    expect(chat).toContain("!isCalm &&");
    expect(chat).toContain('aria-label={isCalm ? "Enviar" : undefined}');
    expect(chat).toContain('aria-label={isCalm ? "Escribiendo" : undefined}');

    expect(css).toContain(".ap-worker-chat .ap-chat-composer");
    expect(css).toContain(".ap-worker-chat .ap-chat-bubble-user");
    expect(css).toContain(".ap-worker-chat .ap-chat-bubble-assistant");
    expect(css).toContain(".ap-worker-chat .ap-chat-chip");
    expect(css).toContain(".ap-worker-chat .ap-chat-section-label");
    expect(css).toContain("letter-spacing: -0.018em");
    expect(css).toContain("color-scheme: light");
    expect(sheet).not.toMatch(/dark:bg-slate-950/);
    const auditar = read("../pages/Auditar.tsx");
    expect(auditar).toContain('chatHarness") === "1"');
    expect(auditar).toContain('chatHistoryHarness") === "1"');
    expect(auditar).toContain(
      "||required_plan=essential||current_plan=free",
    );
    expect(auditar).toContain("¿Me descontaron IMSS, impuestos o Infonavit?");
    expect(auditar).toContain("Cruza el descuento IMSS $120.50");
    expect(auditar).toContain("no confirma el alta oficial");
    expect(auditar).toContain("retención ISR $310.00");
    expect(auditar).toContain("descuento Infonavit $80.00");
    expect(auditar).toContain("aviso de retención o estado de crédito");
    expect(auditar).toContain("acreditación de pagos y deducciones");
  });
});
