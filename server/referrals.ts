import mysql from "mysql2/promise";

import { ENV } from "./_core/env";
import { isReferralCode } from "@shared/shareCopy";

export type ReferralRow = {
  code: string;
  createdAt: string;
  visits: number;
  receiptsAnalyzed: number;
  rewardedAt: string | null;
  extraReviews: number;
};

const memory = new Map<string, ReferralRow>();
let pool: mysql.Pool | null = null;

function nowIso() {
  return new Date().toISOString();
}

function blank(code: string): ReferralRow {
  return {
    code,
    createdAt: nowIso(),
    visits: 0,
    receiptsAnalyzed: 0,
    rewardedAt: null,
    extraReviews: 0,
  };
}

function dbPool() {
  if (!ENV.databaseUrl.trim()) return null;
  if (!pool) pool = mysql.createPool(ENV.databaseUrl);
  return pool;
}

async function readRow(code: string): Promise<ReferralRow> {
  const current = memory.get(code) ?? blank(code);
  const database = dbPool();
  if (!database) return current;
  try {
    const [rows] = await database.query<mysql.RowDataPacket[]>(
      "SELECT code, createdAt, visits, receiptsAnalyzed, rewardedAt FROM referrals WHERE code = ? LIMIT 1",
      [code],
    );
    const row = rows[0];
    if (!row) return current;
    return {
      code,
      createdAt: new Date(row.createdAt).toISOString(),
      visits: Number(row.visits) || 0,
      receiptsAnalyzed: Number(row.receiptsAnalyzed) || 0,
      rewardedAt: row.rewardedAt ? new Date(row.rewardedAt).toISOString() : null,
      extraReviews: Number(row.receiptsAnalyzed) || 0,
    };
  } catch {
    return current;
  }
}

async function writeRow(row: ReferralRow) {
  memory.set(row.code, row);
  const database = dbPool();
  if (!database) return;
  try {
    await database.query(
      `INSERT INTO referrals (code, visits, receiptsAnalyzed, rewardedAt)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE visits = VALUES(visits), receiptsAnalyzed = VALUES(receiptsAnalyzed), rewardedAt = VALUES(rewardedAt)`,
      [row.code, row.visits, row.receiptsAnalyzed, row.rewardedAt],
    );
  } catch {
    // La tabla se crea en el arranque. Si todavía no está, el conteo queda en memoria.
  }
}

export function resetReferralsForTests() {
  memory.clear();
}

export async function recordReferralVisit(code: string | null | undefined): Promise<ReferralRow | null> {
  const normalized = code?.trim().toUpperCase();
  if (!isReferralCode(normalized)) return null;
  const row = await readRow(normalized);
  row.visits += 1;
  await writeRow(row);
  return memory.get(normalized) ?? row;
}

export async function recordReferralReceipt(code: string | null | undefined): Promise<ReferralRow | null> {
  const normalized = code?.trim().toUpperCase();
  if (!isReferralCode(normalized)) return null;
  const row = await readRow(normalized);
  row.receiptsAnalyzed += 1;
  row.extraReviews = row.receiptsAnalyzed;
  if (!row.rewardedAt) row.rewardedAt = nowIso();
  await writeRow(row);
  return memory.get(normalized) ?? row;
}

export async function readReferral(code: string | null | undefined): Promise<ReferralRow | null> {
  const normalized = code?.trim().toUpperCase();
  if (!isReferralCode(normalized)) return null;
  return memory.get(normalized) ?? (await readRow(normalized));
}

const leads: Array<{ contact: string; planKey: string; createdAt: string }> = [];

export function resetPlanInterestForTests() {
  leads.length = 0;
}

export async function recordPlanInterest(params: { contact: string; planKey: string }) {
  const contact = params.contact.trim();
  const planKey = params.planKey.trim();
  if (!contact || !planKey) return { saved: false as const };
  const createdAt = nowIso();
  leads.push({ contact, planKey, createdAt });
  const database = dbPool();
  if (database) {
    try {
      await database.query(
        "INSERT INTO plan_interest_leads (contact, planKey, createdAt) VALUES (?, ?, ?)",
        [contact.slice(0, 320), planKey.slice(0, 64), createdAt],
      );
    } catch {
      // El aviso queda registrado en memoria. No se cobra nada.
    }
  }
  return { saved: true as const, charged: false as const };
}
