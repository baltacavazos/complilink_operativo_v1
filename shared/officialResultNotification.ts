import {
  citeableOfficialHechos,
  type OfficialCheckSummary,
} from "./officialCheckCopy";

export const OFFICIAL_RESULT_NOTIFICATION_KIND = "official_fact_ready" as const;

export const OFFICIAL_RESULT_NOTIFICATION_COPY = {
  title: "Ya hay un resultado de tu consulta oficial",
  /** Correo y aviso de salida. WhatsApp repite esta frase en su propio copy. */
  body: "Ya llegó un dato oficial para tu caso. Entra a AuditaPatrón para verlo con calma.",
  disclaimer: "Este resultado no prueba por sí solo que tu patrón cumpla.",
  actionLabel: "Ver mi resultado",
} as const;

/** Bandeja in-app (guest Home, /auditar y cuenta). La persona ya está dentro. */
export const OFFICIAL_RESULT_INBOX_BODY =
  "Ya llegó un dato oficial para tu caso. Ya puedes verlo con calma aquí.";

export function listUsableOfficialFacts(
  summary: OfficialCheckSummary | null | undefined,
): string[] {
  if (!summary) return [];

  const facts = summary.checks.flatMap((check) => {
    if (check.status !== "vivo" && check.honesty !== "live") return [];
    return citeableOfficialHechos(check.source, check.hechos ?? []);
  });

  if (summary.chatAnchor) {
    for (const anchor of [
      summary.chatAnchor.imss,
      summary.chatAnchor.sat,
      summary.chatAnchor.infonavit,
    ]) {
      if (anchor.estado !== "live") continue;
      facts.push(...citeableOfficialHechos(anchor.fuente, anchor.hechos));
    }
  }

  return Array.from(
    new Set(facts.map((fact) => fact.trim()).filter(Boolean)),
  ).slice(0, 6);
}

export function hasUsableOfficialFact(
  summary: OfficialCheckSummary | null | undefined,
): boolean {
  return listUsableOfficialFacts(summary).length > 0;
}

/** Frase del correo cuando el reintento ya trajo un hecho del IMSS. Nunca dice que el patrón cumple. */
export function officialImssArrivalSentence(
  summary: OfficialCheckSummary | null | undefined,
): string | null {
  const check = summary?.checks?.find((item) => item.source === "imss");
  if (!check || (check.status !== "vivo" && check.honesty !== "live")) return null;
  const facts = citeableOfficialHechos("imss", check.hechos ?? [])
    .map((fact) => fact.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (facts.length === 0) return null;
  const sentence = `El IMSS ya contestó. ${facts.join(" ")}`;
  if (/\bcumple\b/i.test(sentence)) return "El IMSS ya contestó.";
  return sentence;
}
