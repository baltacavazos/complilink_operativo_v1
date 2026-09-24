import {
  citeableOfficialHechos,
  type OfficialCheckSummary,
} from "./officialCheckCopy";

export const OFFICIAL_RESULT_NOTIFICATION_KIND = "official_fact_ready" as const;

export const OFFICIAL_RESULT_NOTIFICATION_COPY = {
  title: "Ya hay un resultado de tu consulta oficial",
  body: "Ya llegó un dato oficial para tu caso. Entra a AuditaPatrón para verlo con calma.",
  disclaimer: "Este resultado no prueba por sí solo que tu patrón cumpla.",
  actionLabel: "Ver mi resultado",
} as const;

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
