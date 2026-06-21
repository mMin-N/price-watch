import { applySqlFile } from "./db-connect.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-sql-file.mjs <path-to-sql-file>");
  process.exit(1);
}

applySqlFile(file).catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
