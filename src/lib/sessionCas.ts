import { getServerSupabase } from "./supabase-server";
import { AppState } from "./types";
import { Transition, normalizeAppState } from "./sessionTransitions";

export type CasResult =
  | { ok: true; state: AppState; version: number }
  | { ok: false; error: string; status: number };

// Self-service writes have no password gate, so many devices can hit the
// same session concurrently. This applies a pure transition function against
// the latest state and writes it back with an optimistic-concurrency check
// (update_session_state_cas only succeeds if `version` still matches what we
// read) — on a conflict it just re-reads and retries.
export async function casUpdate(
  code: string,
  transition: (state: AppState) => Transition,
  maxAttempts = 5
): Promise<CasResult> {
  const supabase = getServerSupabase();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: row, error: readErr } = await supabase
      .from("sessions")
      .select("state, version")
      .eq("code", code)
      .maybeSingle();
    if (readErr) return { ok: false, error: readErr.message, status: 500 };
    if (!row) return { ok: false, error: "session_not_found", status: 404 };

    const result = transition(normalizeAppState(row.state));
    if ("error" in result) {
      const status = result.error === "player_not_found" ? 404 : 400;
      return { ok: false, error: result.error, status };
    }

    const { data, error } = await supabase.rpc("update_session_state_cas", {
      p_code: code,
      p_expected_version: row.version as number,
      p_new_state: result,
    });
    if (error) return { ok: false, error: error.message, status: 500 };
    if (Array.isArray(data) && data.length > 0) {
      return { ok: true, state: data[0].state as AppState, version: data[0].version as number };
    }
    // 0 rows back = version mismatch (a concurrent writer won) — loop and retry.
  }

  return { ok: false, error: "conflict_retry_exhausted", status: 409 };
}
