"use client";

import { Player, Tier } from "@/lib/types";

const TIER_LABELS: Record<Tier, string> = {
  novice: "Novice",
  intermediate: "Intermediate",
};

type Props = {
  players: Player[];
  myId: string | null;
};

export function QueueList({ players, myId }: Props) {
  const queued = (tier: Tier) =>
    players
      .filter((p) => p.tier === tier && p.joined && p.inMatchOnCourt === null)
      .sort((a, b) => (a.joinedQueueAt ?? 0) - (b.joinedQueueAt ?? 0));

  const tiers: Tier[] = ["novice", "intermediate"];
  const hasAnyQueue = tiers.some((t) => queued(t).length > 0);

  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted">Queue</h3>

      {!hasAnyQueue && <p className="text-sm text-muted">No one is queued right now.</p>}

      {tiers.map((tier) => {
        const list = queued(tier);
        if (list.length === 0) return null;
        return (
          <div key={tier}>
            <p className="text-xs font-semibold text-foreground mb-1">{TIER_LABELS[tier]} ({list.length})</p>
            <div className="divide-y divide-border/50">
              {list.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-xs text-muted w-5 shrink-0 tabular-nums">{i + 1}.</span>
                  <span className="text-sm text-foreground">
                    {p.name}
                    {p.id === myId && <span className="text-muted"> (you)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
