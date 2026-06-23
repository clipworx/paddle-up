"use client";

import { use } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { EditLock } from "@/components/EditLock";
import { MatchDisplay } from "@/components/MatchDisplay";
import { useSharedState } from "@/lib/sharedState";
import { applyCompleteMatch } from "@/lib/sessionTransitions";

export default function CourtScoringPage({
  params,
}: {
  params: Promise<{ code: string; n: string }>;
}) {
  const { code, n } = use(params);
  const normalized = code.toUpperCase();
  const courtIndex = Math.max(0, parseInt(n, 10) - 1);
  const { state, setState, hydrated, exists, isEditor, authenticate, logout } = useSharedState(normalized);

  const match = state.courts[courtIndex] ?? null;

  const handleComplete = () => {
    setState((s) => {
      const result = applyCompleteMatch(s, courtIndex);
      return "error" in result ? s : result;
    });
  };

  if (hydrated && !exists) {
    return (
      <main className="mx-auto max-w-xl w-full px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Session not found</h1>
        <p className="text-sm text-muted">
          No open play exists with code{" "}
          <span className="font-mono font-semibold text-foreground">{normalized}</span>.
        </p>
        <Link
          href="/play"
          className="inline-block rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
        >
          Back to start
        </Link>
      </main>
    );
  }

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-2xl w-full px-4 h-14 flex items-center gap-4">
          <Link href={`/${normalized}`} className="flex items-center gap-2 shrink-0">
            <Logo size={28} />
            <span className="text-sm font-bold text-foreground hidden sm:block">ReZerve</span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono font-semibold text-accent text-sm">{normalized}</span>
            <span className="text-border mx-1">·</span>
            <span className="text-sm text-foreground font-semibold">Court {courtIndex + 1}</span>
          </div>
          <div className="shrink-0">
            <EditLock isEditor={isEditor} onAuthenticate={authenticate} onLogout={logout} />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl w-full px-4 py-10 space-y-6">
        {match ? (
          <>
            <MatchDisplay match={match} players={state.players} />
            {isEditor ? (
              <button
                onClick={handleComplete}
                className="w-full rounded-xl bg-accent text-background py-3 text-sm font-semibold hover:bg-muted transition-colors"
              >
                Complete match
              </button>
            ) : (
              <p className="text-center text-xs text-muted">Only the host can complete a match. Unlock with the host password above.</p>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-muted py-16">No match on this court right now.</p>
        )}
      </main>
    </>
  );
}
