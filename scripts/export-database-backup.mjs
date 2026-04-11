import process from "node:process";

import {
  createRecoverableDatabaseBackup,
  validateRecoverableDatabaseBackup,
} from "../server/databaseBackup.ts";

function parseArgs(argv) {
  const args = {
    label: "manual",
    outputDir: undefined,
    dropboxPath: undefined,
    validate: false,
    compareWithLive: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--label" && argv[index + 1]) {
      args.label = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--output-dir" && argv[index + 1]) {
      args.outputDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--dropbox-path" && argv[index + 1]) {
      args.dropboxPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--validate") {
      args.validate = true;
      continue;
    }
    if (token === "--no-live-compare") {
      args.compareWithLive = false;
    }
  }

  return args;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está disponible en el entorno.");
  }

  const args = parseArgs(process.argv.slice(2));
  const dropboxAccessToken = process.env.DROPBOX_API_KEY;
  const backup = await createRecoverableDatabaseBackup({
    databaseUrl,
    backupLabel: args.label,
    outputDir: args.outputDir,
    dropbox:
      args.dropboxPath && dropboxAccessToken
        ? {
            accessToken: dropboxAccessToken,
            basePath: args.dropboxPath,
          }
        : undefined,
  });

  const validation = args.validate
    ? await validateRecoverableDatabaseBackup({
        artifactPath: backup.artifactPath,
        databaseUrl: args.compareWithLive ? databaseUrl : undefined,
      })
    : null;

  console.log(
    JSON.stringify(
      {
        backup,
        validation,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
