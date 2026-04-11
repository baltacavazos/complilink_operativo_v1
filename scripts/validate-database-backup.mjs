import process from "node:process";

import { validateRecoverableDatabaseBackup } from "../server/databaseBackup.ts";

function parseArgs(argv) {
  const args = {
    artifactPath: "",
    compareWithLive: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--artifact" && argv[index + 1]) {
      args.artifactPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--no-live-compare") {
      args.compareWithLive = false;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.artifactPath) {
    throw new Error("Debes indicar --artifact con la ruta del archivo .backup.json.gz");
  }

  const databaseUrl = process.env.DATABASE_URL;
  const result = await validateRecoverableDatabaseBackup({
    artifactPath: args.artifactPath,
    databaseUrl: args.compareWithLive ? databaseUrl : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
