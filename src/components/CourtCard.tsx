"use client";

import Link from "next/link";
import { Match, Player } from "@/lib/types";
import { MatchDisplay } from "@/components/MatchDisplay";

type Props = {
  code: string;
  courtIndex: number;
  match: Match | null;
  players: Player[];
  busy: boolean;
  isEditor: boolean;
  onComplete: () => void;
};

export function CourtCard({ code, courtIndex, match, players, busy, isEditor, onComplete }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Court {courtIndex + 1}</h3>
        <Link
          href={`/${code}/court/${courtIndex + 1}`}
          className="text-xs text-muted hover:text-accent transition-colors"
        >
          Open court view →
        </Link>
      </div>

      {match ? (
        <>
          <MatchDisplay match={match} players={players} />
          {isEditor ? (
            <button
              onClick={onComplete}
              disabled={busy}
              className="w-full rounded-lg border border-accent/50 bg-accent/5 text-accent py-2 text-sm font-semibold hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
            >
              {busy ? "Completing…" : "Complete match"}
            </button>
          ) : (
            <p className="text-xs text-muted text-center py-1">Waiting for host to complete this match</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted text-center py-4">Free</p>
      )}
    </div>
  );
}
