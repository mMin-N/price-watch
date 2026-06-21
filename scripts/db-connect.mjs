import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

export function loadEnvFile() {
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
      })
  );
}

export function projectRefFromUrl(url) {
  const match = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL");
  return match[1];
}

function sessionPoolerUrl(ref, password, poolerHost, port = 5432) {
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${poolerHost}:${port}/postgres`;
}

const POOLER_PREFIXES = ["aws-0", "aws-1", "aws-2"];
const POOLER_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-south-1",
  "sa-east-1",
  "ca-central-1",
];
const POOLER_PORTS = [5432, 6543];

async function connectWithPoolerDiscovery(ref, password, env) {
  const configuredHost =
    process.env.SUPABASE_DB_POOLER_HOST ?? env.SUPABASE_DB_POOLER_HOST;
  const hosts = configuredHost
    ? [configuredHost]
    : POOLER_PREFIXES.flatMap((prefix) =>
        POOLER_REGIONS.map((region) => `${prefix}-${region}.pooler.supabase.com`)
      );

  let lastError;
  for (const host of hosts) {
    for (const port of POOLER_PORTS) {
      const url = sessionPoolerUrl(ref, password, host, port);
      const client = new pg.Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
      });
      try {
        await client.connect();
        console.log(`Connected via session pooler at ${host}:${port}.`);
        return client;
      } catch (error) {
        lastError = error;
        const message = String(error.message ?? "");
        const wrongCluster =
          message.includes("tenant/user") || message.includes("tenant identifier");
        if (!wrongCluster) {
          throw error;
        }
      }
    }
  }

  throw lastError ?? new Error("Could not find a working Supabase pooler host.");
}

function directUrl(ref, password) {
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

function isRetryableConnectionError(error) {
  const message = String(error.message ?? "");
  if (message.includes("tenant/user") || message.includes("tenant identifier")) {
    return false;
  }
  if (error.code === "ENOTFOUND" && message.includes("getaddrinfo")) {
    return true;
  }
  return false;
}

export async function connectToSupabaseDb(env = loadEnvFile()) {
  const password = process.env.SUPABASE_DB_PASSWORD ?? env.SUPABASE_DB_PASSWORD;
  if (!password) {
    const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
    throw new Error(
      [
        "Set SUPABASE_DB_PASSWORD (Supabase → Database → Settings → Reset database password).",
        "Or set SUPABASE_DB_URL to the Session pooler URI from the Connect panel.",
        `SQL Editor fallback: https://supabase.com/dashboard/project/${ref}/sql/new`,
      ].join("\n")
    );
  }

  const explicit = process.env.SUPABASE_DB_URL ?? env.SUPABASE_DB_URL;
  if (explicit) {
    const client = new pg.Client({
      connectionString: explicit,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    console.log("Connected using SUPABASE_DB_URL.");
    return client;
  }

  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);

  try {
    return await connectWithPoolerDiscovery(ref, password, env);
  } catch (poolerError) {
    const message = String(poolerError?.message ?? "");
    if (!isRetryableConnectionError(poolerError) && !message.includes("tenant")) {
      throw poolerError;
    }
  }

  const attempts = [
    { label: "direct (IPv6)", url: directUrl(ref, password) },
  ];

  let lastError;
  for (const attempt of attempts) {
    const client = new pg.Client({
      connectionString: attempt.url,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      console.log(`Connected via ${attempt.label}.`);
      return client;
    } catch (error) {
      lastError = error;
      if (!isRetryableConnectionError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    [
      lastError?.message ?? "Could not connect to Supabase Postgres.",
      "",
      "Fix options:",
      "1. Dashboard → Connect → copy the Session pooler URI into SUPABASE_DB_URL in .env.local",
      "2. Or paste SQL into Dashboard → SQL Editor (no CLI needed)",
      "3. Direct db.<ref>.supabase.co is IPv6-only and often fails on Windows/home networks",
    ].join("\n")
  );
}

export async function applySqlFile(relativePath) {
  const sqlPath = resolve(root, relativePath);
  const sql = readFileSync(sqlPath, "utf8");
  const client = await connectToSupabaseDb();
  try {
    await client.query(sql);
    console.log(`Applied ${relativePath} successfully.`);
  } finally {
    await client.end();
  }
}
