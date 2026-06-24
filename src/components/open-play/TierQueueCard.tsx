"use client";

import { Player, Tier } from "@/lib/types";
import { TIER_LABEL, TIER_TEXT_CLASS, TIER_BG_CLASS, queuedInTier } from "@/lib/openPlayDisplay";

type Props = {
  tier: Tier;
  players: Player[];
  myId: string | null;
  isEditor: boolean;
  onKick?: (id: string) => void;
};

export function TierQueueCard({ tier, players, myId, isEditor, onKick }: Props) {
  const queued = queuedInTier(players, tier);
  if (queued.length === 0) return null;

  const tierText = TIER_TEXT_CLASS[tier];

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.25 border-b border-border flex items-center">
        <div className={`font-op-mono text-[9px] tracking-[0.17em] font-bold ${tierText}`}>
          {TIER_LABEL[tier]} QUEUE
        </div>
        <div className="ml-auto font-op-mono text-[9px] text-muted">{queued.length}/4</div>
      </div>
      <div>
        {queued.map((p, i) => {
          const isMe = p.id === myId;
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 last:border-b-0"
            >
              <div className={`font-display font-black text-[38px] leading-[0.88] min-w-7.5 shrink-0 ${isMe ? tierText : "text-foreground/25"}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-[15px] truncate ${isMe ? tierText : "text-foreground"}`}>
                  {p.name}
                </div>
              </div>
              {isMe && (
                <div className={`font-op-mono text-[8px] tracking-[0.12em] px-1.75 py-0.75 rounded-sm shrink-0 ${TIER_BG_CLASS[tier]} ${tierText}`}>
                  YOU
                </div>
              )}
              {isEditor && !isMe && onKick && (
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
