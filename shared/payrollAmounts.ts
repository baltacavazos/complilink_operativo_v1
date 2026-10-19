export function moneyToCents(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.replace(/[^\d.,-]/g, "").match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const normalized = match[0].replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export function centsToMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const pesos = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}$${pesos.toLocaleString("en-US")}.${fraction}`;
}

export function reconcilePayrollDeductions(params: {
  perceptions?: string | null;
  netAmount?: string | null;
  deductions?: string | null;
  listed?: Array<string | null | undefined>;
}): { deductions: string | null; calculated: boolean } {
  const perceptions = moneyToCents(params.perceptions);
  const net = moneyToCents(params.netAmount);
  if (perceptions == null || net == null) {
    return { deductions: params.deductions ?? null, calculated: false };
  }
  const expected = perceptions - net;
  const listedSum = (params.listed ?? [])
    .map((item) => moneyToCents(item))
    .filter((item): item is number => item != null)
    .reduce((sum, item) => sum + item, 0);
  const listedCount = (params.listed ?? []).filter((item) => moneyToCents(item) != null).length;
  const read = moneyToCents(params.deductions);
  const off = (value: number | null) => value == null || Math.abs(value - expected) > 100;
  const listedOff = listedCount > 0 && Math.abs(listedSum - expected) > 100;
  if (off(read) || listedOff) {
    return { deductions: centsToMoney(expected), calculated: true };
  }
  return { deductions: params.deductions ?? centsToMoney(expected), calculated: false };
}
