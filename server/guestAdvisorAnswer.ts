import type { OfficialCheckSummary } from "@shared/officialCheckCopy";
import { citeableOfficialHechos } from "@shared/officialCheckCopy";
import { reconcilePayrollDeductions } from "@shared/payrollAmounts";
import type { LaborFiscalStructuredFacts } from "./laborFiscalSignals";
import { buildWorkerChatGrounding } from "./workerChatUx";
import { buildLaborFiscalChatGuidance } from "./workerChatLaborGuidance";

export type GuestAdvisorFacts = Partial<LaborFiscalStructuredFacts>;

function clean(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function deductionTotal(facts: GuestAdvisorFacts): string | null {
  return reconcilePayrollDeductions({
    perceptions: facts.perceptions,
    netAmount: facts.netAmount,
    deductions: facts.deductions,
    listed: [facts.isrWithheld, facts.imssWithheld, facts.infonavitWithheld],
  }).deductions;
}

function imssRegistrationSentence(summary?: OfficialCheckSummary | null): string {
  const check = summary?.checks?.find((item) => item.source === "imss");
  if (check && (check.status === "vivo" || check.honesty === "live")) {
    const facts = citeableOfficialHechos("imss", check.hechos ?? []).slice(0, 2);
    if (facts.length > 0) {
      return `El IMSS ya contestó. ${facts.join(" ")} Eso no dice que tu patrón cumpla.`;
    }
    return "El IMSS ya contestó, pero esta consulta no trajo un dato de tu registro.";
  }
  if (!check || check.status === "pendiente" || check.honesty === "pending") {
    return "El IMSS todavía no contesta, así que no puedo decirte si te tiene registrado.";
  }
  return "El IMSS no contestó en esta consulta. No puedo decirte si te tiene registrado.";
}

function discountSentence(facts: GuestAdvisorFacts): string | null {
  const total = deductionTotal(facts);
  const isr = clean(facts.isrWithheld);
  const imss = clean(facts.imssWithheld);
  if (total && isr && imss) {
    return `Tus ${total} son ISR ${isr} (impuesto) e IMSS ${imss} (tu cuota del seguro). Los dos los marca la ley. Lo que sí conviene revisar es que tu sueldo registrado en el IMSS sea el real.`;
  }
  if (total) {
    return `En este recibo los descuentos suman ${total}. Lo que sí conviene revisar es que tu sueldo registrado en el IMSS sea el real.`;
  }
  return null;
}

function guard(answer: string): string {
  if (/\bcumple\b/i.test(answer)) {
    return answer.replace(/\bcumple\b/gi, "esté al corriente");
  }
  return answer;
}

export function answerGuestAdvisor(params: {
  prompt: string;
  facts: GuestAdvisorFacts;
  officialCheck?: OfficialCheckSummary | null;
  preliminaryAnalysis?: unknown;
  previewOpinion?: unknown;
}): string {
  const grounding = buildWorkerChatGrounding({
    documents: [
      {
        documentType: "payroll_receipt",
        originalName: "recibo",
        preliminaryAnalysis: params.preliminaryAnalysis,
        heliosOpinion: params.previewOpinion,
      },
    ],
    opinion: params.previewOpinion,
    officialCheck: params.officialCheck ?? null,
    caseOnly: true,
  });
  const guidance = buildLaborFiscalChatGuidance(
    { ...grounding, caseChatPrimary: true },
    params.prompt,
  );
  const facts = { ...grounding.laborFacts, ...params.facts };
  const prompt = params.prompt.toLowerCase();
  const aboutPrivacy = /empresa|privac|compart/.test(prompt);
  if (aboutPrivacy) {
    return "No. Lo que subes no se comparte con tu empresa. El aviso de privacidad se lee sin cuenta, desde el inicio.";
  }

  const aboutDiscount = /descont|legal|540|deduc|isr|retenc|cuota|impuesto/.test(prompt);
  const aboutImss = /imss|registrad|alta|tiene/.test(prompt);
  const aboutInfonavit = /infonavit/.test(prompt);
  const parts: string[] = [];
  if (aboutDiscount) {
    const discount = discountSentence(facts);
    if (discount) parts.push(discount);
  }
  if (aboutImss) parts.push(imssRegistrationSentence(params.officialCheck));
  if (aboutInfonavit) {
    const infonavit = params.officialCheck?.checks?.find((item) => item.source === "infonavit");
    parts.push(
      infonavit && (infonavit.status === "vivo" || infonavit.honesty === "live")
        ? "Infonavit ya contestó en esta consulta. Revisa el dato que aparece arriba."
        : "Infonavit no contestó en esta consulta. Si ya tienes tu estado de cuenta, súbelo.",
    );
  }
  if (parts.length === 0) {
    const known = guidance.visibleFactLines.slice(0, 2).join(" ");
    const discount = discountSentence(facts);
    parts.push(
      known || discount || "Puedo hablar de los montos de este recibo y de lo que cada oficina ya contestó.",
    );
  }
  return guard(parts.join(" ").replace(/\s+/g, " ").trim());
}

const advisorByToken = new Map<string, number[]>();
const advisorByIp = new Map<string, number[]>();
const ADVISOR_HOUR_MS = 60 * 60 * 1000;

export function resetGuestAdvisorRateLimitForTests() {
  advisorByToken.clear();
  advisorByIp.clear();
}

export function assertGuestAdvisorRateLimit(params: { tokenId: string; ip: string | null; nowMs?: number }) {
  const now = params.nowMs ?? Date.now();
  const keep = (stamps: number[]) => stamps.filter((stamp) => now - stamp < ADVISOR_HOUR_MS);
  const tokenStamps = keep(advisorByToken.get(params.tokenId) ?? []);
  if (tokenStamps.length >= 8) {
    throw new Error("Ya hiciste varias preguntas. Espera un poco y vuelve a intentar.");
  }
  const ipKey = params.ip ?? "ip:unknown";
  const ipStamps = keep(advisorByIp.get(ipKey) ?? []);
  if (ipStamps.length >= 30) {
    throw new Error("Hay muchas preguntas desde esta conexión. Espera un poco y vuelve a intentar.");
  }
  tokenStamps.push(now);
  ipStamps.push(now);
  advisorByToken.set(params.tokenId, tokenStamps);
  advisorByIp.set(ipKey, ipStamps);
}

export function guestAdvisorAnswerKeepsFacts(modelText: string, draft: string): boolean {
  const text = modelText.trim();
  if (text.length < 40) return false;
  if (/\bcumple\b/i.test(text)) return false;
  if (/primera lectura útil|sube el cfdi/i.test(text)) return false;
  const amounts = draft.match(/\$[\d,.]+/g) ?? [];
  return amounts.every((amount) => text.includes(amount));
}
