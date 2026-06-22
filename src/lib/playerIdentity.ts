"use client";

// Per-device player identity, scoped by session code — mirrors the
// PASSWORD_KEY_PREFIX convention in sharedState.ts. Persisting this in
// localStorage is what makes "refresh the page" restore the same player
// instead of creating a new one each time.

const PLAYER_KEY_PREFIX = "paddle-up-player-v1:";

export type StoredIdentity = { playerId: string; name: string };

export function getStoredIdentity(code: string): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(`${PLAYER_KEY_PREFIX}${code}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.playerId === "string" && typeof parsed?.name === "string") {
      return parsed as StoredIdentity;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStoredIdentity(code: string, identity: StoredIdentity): void {
  try {
    localStorage.setItem(`${PLAYER_KEY_PREFIX}${code}`, JSON.stringify(identity));
  } catch {}
}

export function generatePlayerId(): string {
  return crypto.randomUUID();
}
