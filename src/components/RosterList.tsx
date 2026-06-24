"use client";

import { Player } from "@/lib/types";
import { TIER_LABEL, TIER_TEXT_CLASS, TIER_BG_CLASS } from "@/lib/openPlayDisplay";

type Props = {
  players: Player[];
  myId: string | null;
  onKick: (id: string) => void;
};

// Host-only: shows admitted players who are neither queued nor playing.
// Queued/playing players live in TierQueueCard/CourtCard instead.
export function RosterList({ players, myId, onKick }: Props) {
  const resting = players.filter((p) => p.status === "admitted" && p.inMatchOnCourt === null && !p.joined);
  if (resting.length === 0) return null;

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.25 border-b border-border">
        <div className="font-op-mono text-[9px] text-muted tracking-[0.17em]">RESTING</div>
      </div>
      <div>
        {resting.map((p) => {
          const isMe = p.id === myId;
          const tier = p.tier ?? "novice";
          return (
            <div key={p.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/60 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-[15px] truncate ${isMe ? "text-accent" : "text-foreground"}`}>
                  {p.name}
                </div>
                <div className={`inline-flex mt-1 px-2 py-0.5 rounded-sm font-op-mono text-[8px] tracking-[0.12em] ${TIER_BG_CLASS[tier]} ${TIER_TEXT_CLASS[tier]}`}>
                  {TIER_LABEL[tier]}
                </div>
              </div>
              {!isMe && (
                <button
                  onClick={() => onKick(p.id)}
                  className="text-[11px] text-muted px-2.25 py-1.25 rounded-md border border-border hover:border-foreground/30 hover:text-foreground transition-colors shrink-0"
                >
                  Kick
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
