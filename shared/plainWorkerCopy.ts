const LANDING_JARGON: Array<[RegExp, string]> = [
  [/\bexpedientes digitales\b/gi, "casos"],
  [/\bexpediente digital\b/gi, "caso"],
  [/\bexpedientes laborales\b/gi, "casos"],
  [/\bexpediente laboral\b/gi, "caso"],
  [/\btus expedientes\b/gi, "tus casos"],
  [/\bmis expedientes\b/gi, "mis casos"],
  [/\bdel expediente\b/gi, "de tu caso"],
  [/\bal expediente\b/gi, "a tu caso"],
  [/\ben el expediente\b/gi, "en tu caso"],
  [/\bel expediente\b/gi, "tu caso"],
  [/\bun expediente\b/gi, "tu caso"],
  [/\bmi expediente\b/gi, "mi caso"],
  [/\btu expediente\b/gi, "tu caso"],
  [/\beste expediente\b/gi, "tu caso"],
  [/\bexpedientes\b/gi, "casos"],
  [/\bexpediente\b/gi, "caso"],
];

/** Educational/marketing surfaces only. Product flows keep their own copy. */
export function toPlainWorkerLandingCopy(value: string): string {
  const next = LANDING_JARGON.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );

  return next
    .replace(/\btu\s+tu\s+caso\b/gi, "tu caso")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1");
}
