"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MatchDisplay } from "@/components/MatchDisplay";
import { useSharedState } from "@/lib/sharedState";

export default function CourtScoringPage({
  params,
}: {
  params: Promise<{ code: string; n: string }>;
}) {
  const { code, n } = use(params);
  const normalized = code.toUpperCase();
  const courtIndex = Math.max(0, parseInt(n, 10) - 1);
  const { state, hydrated, exists } = useSharedState(normalized);
  const [busy, setBusy] = useState(false);

  const match = state.courts[courtIndex] ?? null;

  const handleComplete = async () => {
    setBusy(true);
    await fetch(`/api/sessions/${normalized}/complete-match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courtIndex }),
    });
    setBusy(false);
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
        </div>
      </nav>

      <main className="mx-auto max-w-2xl w-full px-4 py-10 space-y-6">
        {match ? (
          <>
            <MatchDisplay match={match} players={state.players} />
            <button
              onClick={handleComplete}
              disabled={busy}
              className="w-full rounded-xl bg-accent text-background py-3 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
            >
              {busy ? "Completing…" : "Complete match"}
            </button>
          </>
        ) : (
          <p className="text-center text-sm text-muted py-16">No match on this court right now.</p>
        )}
      </main>
    </>
  );
}
