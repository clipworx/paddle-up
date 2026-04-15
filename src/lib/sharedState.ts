"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { AppState, INITIAL_STATE, PendingMatch } from "./types";

type LegacyAppState = Partial<AppState> & {
  pending?: PendingMatch | null;
};

function normalizeState(raw: unknown): AppState {
  if (!raw || typeof raw !== "object") return INITIAL_STATE;
  const parsed = raw as LegacyAppState;
  const merged: AppState = { ...INITIAL_STATE, ...parsed };
  const courts = Array.isArray(parsed.courts)
    ? [...parsed.courts]
    : parsed.pending !== undefined
    ? [parsed.pending]
    : [];
  const desired = Math.max(1, merged.courtCount ?? 1);
  while (courts.length < desired) courts.push(null);
  merged.courts = courts.slice(0, desired);
  return merged;
}

const PASSWORD_KEY_PREFIX = "paddle-up-edit-pw-v1:";

type Updater = AppState | ((prev: AppState) => AppState);

export type SharedState = {
  state: AppState;
  hydrated: boolean;
  exists: boolean;
  isEditor: boolean;
  authenticate: (password: string) => Promise<boolean>;
  logout: () => void;
  setState: (updater: Updater) => void;
  deleteSession: () => Promise<boolean>;
  lastError: string | null;
};

async function fetchState(
  code: string
): Promise<{ state: unknown } | { error: string; status: number }> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(code)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.status === 404) return { error: "not_found", status: 404 };
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.error ?? `http_${res.status}`, status: res.status };
    }
    return (await res.json()) as { state: unknown };
  } catch (e) {
    return { error: (e as Error).message, status: 0 };
  }
}

async function verifyPassword(code: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/sessions/${encodeURIComponent(code)}/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      }
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { valid?: boolean };
    return body.valid === true;
  } catch {
    return false;
  }
}

async function patchState(
  code: string,
  password: string,
  state: AppState
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, state }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error ?? `http_${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function deleteSessionRequest(
  code: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(code)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error ?? `http_${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function useSharedState(code: string): SharedState {
  const [state, setLocalState] = useState<AppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [exists, setExists] = useState(false);
  const [password, setPasswordInternal] = useState<string | null>(null);
  const [isEditor, setIsEditor] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const passwordRef = useRef<string | null>(null);
  passwordRef.current = password;
  const storageKey = `${PASSWORD_KEY_PREFIX}${code}`;

  const mergeState = useCallback((incoming: unknown) => {
    if (!incoming || typeof incoming !== "object") return;
    setLocalState(normalizeState(incoming));
  }, []);

  const refetch = useCallback(async () => {
    const result = await fetchState(code);
    if ("state" in result) mergeState(result.state);
  }, [code, mergeState]);

  useEffect(() => {
    let mounted = true;
    setHydrated(false);
    setExists(false);

    (async () => {
      const result = await fetchState(code);
      if (!mounted) return;
      if ("state" in result) {
        mergeState(result.state);
        setExists(true);
      }
      setHydrated(true);
    })();

    // Realtime subscription stays direct — WebSocket can't route through /api.
    const channel = supabase
      .channel(`sessions:code:${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `code=eq.${code}`,
        },
        (payload) => {
          const next = payload.new as { state?: unknown } | null;
          if (next?.state) mergeState(next.state);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [code, mergeState]);

  useEffect(() => {
    let cancelled = false;
    setPasswordInternal(null);
    setIsEditor(false);
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      verifyPassword(code, stored).then((valid) => {
        if (cancelled) return;
        if (valid) {
          setPasswordInternal(stored);
          setIsEditor(true);
        } else {
          try {
            localStorage.removeItem(storageKey);
          } catch {}
        }
      });
    } catch {}
    return () => {
      cancelled = true;
    };
  }, [code, storageKey]);

  const setState = useCallback(
    (updater: Updater) => {
      const prev = stateRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next === prev) return;
      setLocalState(next);
      const pw = passwordRef.current;
      if (!pw) {
        setLastError("read_only");
        setLocalState(prev);
        return;
      }
      patchState(code, pw, next).then((result) => {
        if (!result.ok) {
          setLastError(result.error);
          refetch();
        } else {
          setLastError(null);
        }
      });
    },
    [code, refetch]
  );

  const authenticate = useCallback(
    async (pw: string): Promise<boolean> => {
      const valid = await verifyPassword(code, pw);
      if (!valid) return false;
      setPasswordInternal(pw);
      setIsEditor(true);
      try {
        localStorage.setItem(storageKey, pw);
      } catch {}
      return true;
    },
    [code, storageKey]
  );

  const logout = useCallback(() => {
    setPasswordInternal(null);
    setIsEditor(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  const deleteSession = useCallback(async (): Promise<boolean> => {
    const pw = passwordRef.current;
    if (!pw) {
      setLastError("read_only");
      return false;
    }
    const result = await deleteSessionRequest(code, pw);
    if (!result.ok) {
      setLastError(result.error);
      return false;
    }
    setLastError(null);
    setExists(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    return true;
  }, [code, storageKey]);

  return {
    state,
    setState,
    hydrated,
    exists,
    isEditor,
    authenticate,
    logout,
    deleteSession,
    lastError,
  };
}
