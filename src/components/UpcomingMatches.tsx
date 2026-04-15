"use client";

import { PendingMatch, Player } from "@/lib/types";

type Props = {
  players: Player[];
  upcoming: PendingMatch[];
};

function nameOf(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "?";
}

const LABELS = ["Next Up", "After That", "Then"];

export function UpcomingMatches({ players, upcoming }: Props) {
  if (upcoming.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-background/60 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-3">Upcoming</h2>
      <ul className="space-y-3">
        {upcoming.map((m, i) => (
          <li
            key={m.id}
            className="rounded-lg border border-border bg-background p-3"
          >
            <p className="text-[10px] uppercase tracking-wider font-semibold text-accent mb-2">
              {LABELS[i] ?? `In ${i + 1}`}
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm text-foreground">
              <div>
                <p className="truncate">{nameOf(players, m.teamA[0])}</p>
                <p className="truncate">{nameOf(players, m.teamA[1])}</p>
              </div>
              <span className="text-muted text-xs font-semibold">vs</span>
              <div className="text-right">
                <p className="truncate">{nameOf(players, m.teamB[0])}</p>
                <p className="truncate">{nameOf(players, m.teamB[1])}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
