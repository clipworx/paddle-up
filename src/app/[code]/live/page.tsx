"use client";

import { use } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useSharedState } from "@/lib/sharedState";
import { Match, Player } from "@/lib/types";

const COURT_PALETTE = [
  { card: "border-amber-300 bg-amber-50/60", label: "text-amber-700" },
  { card: "border-sky-300 bg-sky-50/60", label: "text-sky-700" },
  { card: "border-emerald-300 bg-emerald-50/60", label: "text-emerald-700" },
  { card: "border-violet-300 bg-violet-50/60", label: "text-violet-700" },
];

function nameOf(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "?";
}

function LiveCourtCard({
  courtNumber,
  match,
  players,
}: {
  courtNumber: number;
  match: Match;
  players: Player[];
}) {
  const palette = COURT_PALETTE[(courtNumber - 1) % COURT_PALETTE.length];

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${palette.card}`}>
      <div className="px-5 py-3 border-b border-black/5">
        <h2 className={`text-xs font-bold uppercase tracking-widest ${palette.label}`}>
          Court {courtNumber}
        </h2>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] divide-x divide-black/5">
        <div className="px-5 py-6 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-3">Team A</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground leading-snug">{nameOf(players, match.teamA[0])}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground leading-snug">{nameOf(players, match.teamA[1])}</p>
        </div>
        <div className="flex items-center justify-center px-3 py-6">
          <span className="text-xs font-bold text-muted uppercase tracking-widest">vs</span>
        </div>
        <div className="px-5 py-6 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-3">Team B</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground leading-snug">{nameOf(players, match.teamB[0])}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground leading-snug">{nameOf(players, match.teamB[1])}</p>
        </div>
      </div>
    </div>
  );
}

export default function LivePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const normalized = code.toUpperCase();
  const { state, hydrated, exists } = useSharedState(normalized);

  const activeMatches = state.courts
    .map((m, i) => ({ match: m, courtNumber: i + 1 }))
    .filter((x): x is { match: Match; courtNumber: number } => x.match !== null);

  if (hydrated && !exists) {
    return (
      <main className="mx-auto max-w-xl w-full px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Session not found</h1>
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
        <div className="mx-auto max-w-6xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/play" className="flex items-center gap-2 shrink-0 mr-2">
            <Logo size={28} />
            <span className="text-sm font-bold text-foreground hidden sm:block">
              ReZerve
            </span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm text-muted hidden sm:inline">Session</span>
            <Link
              href={`/${normalized}`}
              className="font-mono font-semibold text-accent text-sm hover:underline"
            >
              {normalized}
            </Link>
            <span className="text-border hidden sm:inline mx-1">·</span>
            <span className="text-xs text-muted hidden sm:inline">Live view</span>
          </div>
          <span
            className="h-2 w-2 rounded-full bg-accent shrink-0 animate-pulse"
            title="Live"
          />
        </div>
      </nav>

      <main className="mx-auto max-w-6xl w-full px-4 py-8 space-y-6">
        {activeMatches.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-lg font-medium text-muted">
              No active matches right now.
            </p>
            <p className="text-sm text-muted/60 mt-1">
              Check back once a queue fills up.
            </p>
          </div>
        ) : (
          <div className={`grid gap-6 ${activeMatches.length > 1 ? "lg:grid-cols-2" : "max-w-2xl"}`}>
            {activeMatches.map(({ match, courtNumber }) => (
              <LiveCourtCard
                key={match.id}
                courtNumber={courtNumber}
                match={match}
                players={state.players}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
