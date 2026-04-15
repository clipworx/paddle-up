"use client";

import Link from "next/link";
import { PendingMatch, Player, ServingTeam } from "@/lib/types";

type Props = {
  code: string;
  courtIndex: number;
  pending: PendingMatch | null;
  players: Player[];
  readOnly?: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
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
  onGenerate,
}: Props) {
  const href = `/${code}/court/${courtIndex + 1}`;
  const label = `Court ${courtIndex + 1}`;
  const serving: ServingTeam = pending?.serving ?? "A";
  const scoreA = pending?.liveScoreA ?? 0;
  const scoreB = pending?.liveScoreB ?? 0;

  if (!pending) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background/60 p-5 shadow-sm space-y-3">
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

  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-background/60 p-4 hover:bg-accent/5 hover:border-accent transition-colors shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">{label}</h2>
        <span className="text-xs text-accent font-medium">Tap to score →</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-center min-w-0">
        <div
          className={`rounded border p-2 min-w-0 transition-colors ${
            serving === "A"
              ? "border-accent bg-accent/10"
              : "border-border bg-background"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-muted">Team A</p>
          <p className="text-sm font-medium text-foreground truncate">
            {nameOf(players, pending.teamA[0])}
          </p>
          <p className="text-sm font-medium text-foreground truncate">
            {nameOf(players, pending.teamA[1])}
          </p>
          <p className="mt-1 text-center text-3xl font-bold text-foreground tabular-nums">
            {scoreA}
          </p>
        </div>
        <span className="self-center text-xs text-muted">vs</span>
        <div
          className={`rounded border p-2 min-w-0 transition-colors ${
            serving === "B"
              ? "border-accent bg-accent/10"
              : "border-border bg-background"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-muted">Team B</p>
          <p className="text-sm font-medium text-foreground truncate">
            {nameOf(players, pending.teamB[0])}
          </p>
          <p className="text-sm font-medium text-foreground truncate">
            {nameOf(players, pending.teamB[1])}
          </p>
          <p className="mt-1 text-center text-3xl font-bold text-foreground tabular-nums">
            {scoreB}
          </p>
        </div>
      </div>
    </Link>
  );
}
