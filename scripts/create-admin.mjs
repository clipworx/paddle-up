#!/usr/bin/env node
// Bootstrap (or reset) an admin user. Reads NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SECRET_KEY from .env.local, and accepts username/password from
// ADMIN_USERNAME/ADMIN_PASSWORD env vars or positional args.
//
// Usage:
//   node scripts/create-admin.mjs <username> <password>
//   ADMIN_USERNAME=foo ADMIN_PASSWORD=bar node scripts/create-admin.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* .env.local is optional */
  }
}

loadDotEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const username = process.env.ADMIN_USERNAME || process.argv[2];
const password = process.env.ADMIN_PASSWORD || process.argv[3];

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local"
  );
  process.exit(1);
}
if (!username || !password) {
  console.error("Usage: node scripts/create-admin.mjs <username> <password>");
  console.error("   or: set ADMIN_USERNAME and ADMIN_PASSWORD env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc("upsert_admin", {
  p_username: username,
  p_password: password,
});

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

console.log(`Admin "${username}" created/updated (id: ${data})`);
