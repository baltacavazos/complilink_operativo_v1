import mysql from 'mysql2/promise';

function redact(value) {
  if (value == null) return value;
  const text = String(value);
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL no está configurada');

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [documents] = await connection.query(
      `
      SELECT
        d.documentId AS documentId,
        d.caseId AS caseId,
        d.originalName AS originalName,
        d.documentType AS documentType,
        d.createdAt AS createdAt,
        d.processedAt AS processedAt,
        h.createdAt AS heliosLoggedAt,
        JSON_UNQUOTE(JSON_EXTRACT(h.afterState, '$.opinion.mode')) AS heliosMode,
        JSON_UNQUOTE(JSON_EXTRACT(h.afterState, '$.opinion.status')) AS opinionStatus,
        JSON_UNQUOTE(JSON_EXTRACT(h.afterState, '$.opinion.summary')) AS opinionSummary,
        JSON_UNQUOTE(JSON_EXTRACT(h.afterState, '$.opinion.resultCard.headline')) AS headline,
        e.createdAt AS dispatchLoggedAt,
        JSON_UNQUOTE(JSON_EXTRACT(e.afterState, '$.status')) AS dispatchStatus,
        JSON_UNQUOTE(JSON_EXTRACT(e.afterState, '$.reason')) AS dispatchReason,
        JSON_UNQUOTE(JSON_EXTRACT(e.afterState, '$.httpStatus')) AS httpStatus,
        JSON_UNQUOTE(JSON_EXTRACT(e.afterState, '$.errorMessage')) AS errorMessage,
        JSON_UNQUOTE(JSON_EXTRACT(e.afterState, '$.observabilityEnvelope.targetHost')) AS targetHost,
        JSON_UNQUOTE(JSON_EXTRACT(e.afterState, '$.observabilityEnvelope.targetPath')) AS targetPath
      FROM case_documents d
      LEFT JOIN audit_logs h
        ON h.documentId = d.documentId
       AND h.action = 'document.helios_opinion'
      LEFT JOIN audit_logs e
        ON e.documentId = d.documentId
       AND e.action = 'document.engine_dispatch'
      ORDER BY d.createdAt DESC
      LIMIT 10
      `,
    );

    console.log(
      JSON.stringify(
        documents.map((row) => ({
          ...row,
          caseId: redact(row.caseId),
          documentId: redact(row.documentId),
        })),
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
