import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Admin-only Supabase client. REQUIRES SUPABASE_SECRET_KEY so that admin RPCs
// (which are granted to service_role only) can execute. Never import this from
// a "use client" file.

let cached: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Admin API requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY"
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
