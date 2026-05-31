"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PendingMatch, Player, ResultMode, ServingTeam } from "@/lib/types";

type Props = {
  code: string;
  courtIndex: number;
  pending: PendingMatch | null;
  players: Player[];
  readOnly?: boolean;
  canGenerate: boolean;
  resultMode: ResultMode;
  onGenerate: () => void;
  onDeclareWinner: (winner: "A" | "B" | "tie") => void;
};

function nameOf(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "?";
}

export function CourtSummaryCard({
  code,
  courtIndex,
  pending,
  players,
  readOnly,
  canGenerate,
  resultMode,
  onGenerate,
  onDeclareWinner,
}: Props) {
  const [declaring, setDeclaring] = useState(false);

  useEffect(() => {
    setDeclaring(false);
  }, [pending?.id]);

  const handleDeclare = (winner: "A" | "B") => {
    setDeclaring(true);
    setTimeout(() => onDeclareWinner(winner), 400);
  };

  const href = `/${code}/court/${courtIndex + 1}`;
  const label = `Court ${courtIndex + 1}`;
  const serving: ServingTeam = pending?.serving ?? "A";
  const scoreA = pending?.liveScoreA ?? 0;
  const scoreB = pending?.liveScoreB ?? 0;

  if (!pending) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/60 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{label}</h2>
          <Link
            href={href}
            className="text-xs text-muted hover:text-accent transition-colors"
          >
            Open →
          </Link>
        </div>
        <p className="text-sm text-muted">No match in progress.</p>
        {!readOnly && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="w-full rounded-lg bg-accent text-background px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-accent"
          >
            {canGenerate ? "Generate Match" : "Add at least 4 active players"}
          </button>
        )}
      </div>
    );
  }

  const teamPanel = (team: "A" | "B", showScore = true) => {
    const ids = team === "A" ? pending.teamA : pending.teamB;
    const isServing = serving === team;
    const score = team === "A" ? scoreA : scoreB;
    return (
      <div
        className={`rounded border p-2 min-w-0 transition-colors ${
          isServing ? "border-accent bg-accent/10" : "border-border bg-background"
        }`}
      >
        <p className="text-[10px] uppercase tracking-wide text-muted">Team {team}</p>
        <p className="text-sm font-medium text-foreground truncate">{nameOf(players, ids[0])}</p>
        <p className="text-sm font-medium text-foreground truncate">{nameOf(players, ids[1])}</p>
        {showScore && (
          <p className="mt-1 text-center text-3xl font-bold text-foreground tabular-nums">{score}</p>
        )}
      </div>
    );
  };

  if (declaring) {
    return (
      <div className="rounded-xl border border-border bg-background/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        </div>
        <div className="px-4 py-10 flex items-center justify-center gap-2 text-muted">
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm font-medium">Saving result…</span>
        </div>
      </div>
    );
  }

  if (!readOnly && resultMode === "winner") {
    return (
      <div className="rounded-xl border border-border bg-background/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{label}</h2>
          <Link href={href} className="text-xs text-muted hover:text-accent transition-colors">
            Open →
          </Link>
        </div>
        <div className="divide-y divide-border">
          <button
            type="button"
            onClick={() => handleDeclare("A")}
            className="w-full flex items-center justify-between gap-4 px-4 py-4 hover:bg-accent/5 active:bg-accent/10 transition-colors text-left group"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-0.5">Team A</p>
              <p className="text-sm font-semibold text-foreground">
                {nameOf(players, pending.teamA[0])}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {nameOf(players, pending.teamA[1])}
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted group-hover:border-accent group-hover:text-accent transition-colors">
              Won
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleDeclare("B")}
            className="w-full flex items-center justify-between gap-4 px-4 py-4 hover:bg-accent/5 active:bg-accent/10 transition-colors text-left group"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-0.5">Team B</p>
              <p className="text-sm font-semibold text-foreground">
                {nameOf(players, pending.teamB[0])}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {nameOf(players, pending.teamB[1])}
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted group-hover:border-accent group-hover:text-accent transition-colors">
              Won
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-background/60 p-4 hover:bg-accent/5 hover:border-accent transition-colors shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">{label}</h2>
        <span className="text-xs text-accent font-medium">Tap to score →</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-center min-w-0">
        {teamPanel("A")}
        <span className="self-center text-xs text-muted">vs</span>
        {teamPanel("B")}
      </div>
    </Link>
  );
}
