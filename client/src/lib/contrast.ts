function channel(value: number) {
  const scale = value / 255;
  return scale <= 0.03928 ? scale / 12.92 : ((scale + 0.055) / 1.055) ** 2.4;
}

export function parseColor(input: string): [number, number, number, number] | null {
  const hex = input.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
      1,
    ];
  }
  const rgb = input.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!rgb) return null;
  return [
    Number(rgb[1]),
    Number(rgb[2]),
    Number(rgb[3]),
    rgb[4] === undefined ? 1 : Number(rgb[4]),
  ];
}

export function compositeOver(foreground: string, background: string): string {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) throw new Error(`No pude leer el color ${foreground} sobre ${background}`);
  const alpha = fg[3];
  const blend = (index: number) => Math.round(fg[index] * alpha + bg[index] * (1 - alpha));
  return `rgb(${blend(0)}, ${blend(1)}, ${blend(2)})`;
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground);
  const bg = parseColor(background.includes("rgba") ? compositeOver(background, "#ffffff") : background);
  if (!fg || !bg) throw new Error(`No pude comparar ${foreground} con ${background}`);
  const lum = (color: [number, number, number, number]) =>
    0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
  const lighter = Math.max(lum(fg), lum(bg));
  const darker = Math.min(lum(fg), lum(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pares de los botones visibles en la revisión, en tema claro. */
export const LIGHT_WORKER_BUTTONS = [
  { name: "Guardar esta revisión", foreground: "#161616", background: "#ffffff" },
  { name: "Consultar IMSS y SAT", foreground: "#ffffff", background: "#111111" },
  { name: "Preguntar al asesor", foreground: "#ffffff", background: "#0f766e" },
  { name: "Bandeja", foreground: "#020617", background: "#f0fdfa" },
  { name: "Pedir mi constancia del IMSS", foreground: "#ffffff", background: "#111111" },
] as const;
