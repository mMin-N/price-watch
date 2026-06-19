import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

function loadEnv() {
  if (!existsSync(envPath)) {
    throw new Error("Missing .env.local");
  }
  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function projectRefFromUrl(url) {
  const match = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL");
  return match[1];
}

async function main() {
  const env = loadEnv();
  const password = process.env.SUPABASE_DB_PASSWORD ?? env.SUPABASE_DB_PASSWORD;
  if (!password) {
    const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
    console.error(
      [
        "Set SUPABASE_DB_PASSWORD (Supabase → Project Settings → Database → Database password).",
        "Then run: npm run db:catchup",
        "",
        "Or paste supabase/catchup-006-008.sql into SQL Editor:",
        `https://supabase.com/dashboard/project/${ref}/sql/new`,
      ].join("\n"),
    );
    process.exit(1);
  }

  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const sql = readFileSync(resolve(root, "supabase/catchup-006-008.sql"), "utf8");
  const connectionString =
    process.env.SUPABASE_DB_URL ??
    env.SUPABASE_DB_URL ??
    `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied catchup migrations 006–008 successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
