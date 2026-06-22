"use client";

import { useState } from "react";
import { Player, Tier, TIERS } from "@/lib/types";

const TIER_LABELS: Record<Tier, string> = {
  novice: "Novice",
  intermediate: "Intermediate",
};

type Props = {
  player: Player;
  busy: boolean;
  onRename: (name: string) => void;
  onSetTier: (tier: Tier) => void;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
};

export function MyStatusCard({ player, busy, onRename, onSetTier, onJoinQueue, onLeaveQueue }: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(player.name);

  const inMatch = player.inMatchOnCourt !== null;

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== player.name) onRename(trimmed);
    setEditingName(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">You</p>
        {editingName ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
              maxLength={40}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-base font-bold text-foreground focus:outline-none focus:border-accent"
            />
            <button onClick={saveName} className="rounded-lg bg-accent text-background px-3 py-1.5 text-sm font-semibold">
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setNameDraft(player.name); setEditingName(true); }}
            className="text-xl font-bold text-foreground hover:text-accent transition-colors"
          >
            {player.name} <span className="text-xs text-muted font-normal">(edit)</span>
          </button>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">Tier</p>
        <div className="flex gap-2">
          {TIERS.map((tier) => (
            <button
              key={tier}
              disabled={inMatch || busy}
              onClick={() => onSetTier(tier)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                player.tier === tier
                  ? "border-accent bg-accent text-background"
                  : "border-border text-foreground hover:bg-accent/10"
              }`}
            >
              {TIER_LABELS[tier]}
            </button>
          ))}
        </div>
      </div>

      <div>
        {inMatch ? (
          <div className="rounded-lg bg-accent/10 text-accent text-center py-2.5 text-sm font-semibold">
            Playing on Court {player.inMatchOnCourt! + 1}
          </div>
        ) : player.joined ? (
          <button
            onClick={onLeaveQueue}
            disabled={busy}
            className="w-full rounded-lg border border-accent/50 bg-accent/5 text-accent py-2.5 text-sm font-semibold hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
          >
            {busy ? "Leaving…" : "Leave queue"}
          </button>
        ) : (
          <button
            onClick={onJoinQueue}
            disabled={busy || !player.tier}
            className="w-full rounded-lg bg-accent text-background py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
          >
            {busy ? "Joining…" : !player.tier ? "Pick a tier first" : "Join queue"}
          </button>
        )}
      </div>
    </div>
  );
}
