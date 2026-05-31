"use client";

import { PendingMatch, Player, isActive } from "@/lib/types";

type Props = {
  players: Player[];
  courts: (PendingMatch | null)[];
  upcoming: PendingMatch[];
};

type QueueEntry = {
  player: Player;
  status: "next" | "queued" | "waiting" | "resting";
  queueSlot?: number;
  position?: number;
};

export function UpcomingMatches({ players, courts, upcoming }: Props) {
  const scheduled = new Set<string>();
  const entries: QueueEntry[] = [];
  let position = 1;

  for (let i = 0; i < courts.length; i++) {
    const match = courts[i];
    if (!match) continue;
    for (const id of [...match.teamA, ...match.teamB]) {
      scheduled.add(id);
    }
  }

  for (let i = 0; i < upcoming.length; i++) {
    const match = upcoming[i];
    const status = i === 0 ? "next" : "queued";
    for (const id of [...match.teamA, ...match.teamB]) {
      const player = players.find((p) => p.id === id);
      if (!player || scheduled.has(id)) continue;
      scheduled.add(id);
      entries.push({ player, status, queueSlot: i, position: position++ });
    }
  }

  const waiting = players.filter((p) => isActive(p) && !scheduled.has(p.id));
  for (const player of waiting) {
    entries.push({ player, status: "waiting", position: position++ });
  }

  const resting = players.filter((p) => !isActive(p));
  for (const player of resting) {
    entries.push({ player, status: "resting" });
  }

  if (players.length === 0) return null;

  const badge = (e: QueueEntry) => {
    if (e.status === "next") {
      return (
        <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-accent/10 text-accent border border-accent/30">
          Next
        </span>
      );
    }
    if (e.status === "queued") {
      return (
        <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted/10 text-muted">
          #{e.queueSlot! + 1} up
        </span>
      );
    }
    if (e.status === "waiting") {
      return (
        <span className="text-[10px] text-muted/60 uppercase tracking-wide">
          Waiting
        </span>
      );
    }
    return (
      <span className="text-[10px] text-muted/40 uppercase tracking-wide">
        Resting
      </span>
    );
  };

  return (
    <section className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-3">Queue</h2>
      <ul className="divide-y divide-border">
        {entries.map((e) => (
          <li
            key={e.player.id}
            className={`flex items-center gap-3 py-2 ${
              e.status === "resting" ? "opacity-40" : ""
            }`}
          >
            <span
              className={`w-6 text-right text-xs tabular-nums shrink-0 ${
                e.position ? "text-muted" : "invisible"
              }`}
            >
              {e.position ?? "·"}
            </span>
            <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
              {e.player.name}
            </span>
            {badge(e)}
          </li>
        ))}
      </ul>
    </section>
  );
}
