import { applySqlFile } from "./db-connect.mjs";

applySqlFile("supabase/catchup-006-008.sql").catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
