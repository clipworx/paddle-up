import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client. Used from /api route handlers so the browser
// never talks to Supabase directly for HTTP operations.
//
// Currently uses the same publishable key the client uses. For stronger
// isolation, set SUPABASE_SECRET_KEY (no NEXT_PUBLIC_ prefix) in .env.local
// and the server will use it to bypass RLS. Never expose a secret key from
// a `"use client"` file.

let cached: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or key (SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
