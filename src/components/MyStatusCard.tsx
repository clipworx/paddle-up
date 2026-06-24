"use client";

import { useState } from "react";
import Link from "next/link";
import { Player, Tier, TIERS } from "@/lib/types";
import {
  TIER_LABEL,
  TIER_TEXT_CLASS,
  TIER_BG_CLASS,
  TIER_BORDER_CLASS,
  TIER_BAR_CLASS,
  STATUS_LABEL,
  STATUS_TEXT_CLASS,
  derivePlayerDisplayStatus,
} from "@/lib/openPlayDisplay";

type Props = {
  code: string;
  player: Player;
  busy: boolean;
  myQueuePosition: number;
  onRename: (name: string) => void;
  onSetTier: (tier: Tier) => void;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
};

export function MyStatusCard({
  code, player, busy, myQueuePosition, onRename, onSetTier, onJoinQueue, onLeaveQueue,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(player.name);

  const tier = player.tier ?? "novice";
  const status = derivePlayerDisplayStatus(player);

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== player.name) onRename(trimmed);
    setEditingName(false);
  };

  return (
    <div className="bg-background rounded-xl overflow-hidden border border-border">
      <div className={`h-0.75 ${TIER_BAR_CLASS[tier]}`} />
      <div className="px-4.5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`inline-flex items-center px-2.5 py-0.75 rounded font-op-mono text-[9px] font-bold tracking-[0.14em] ${TIER_BG_CLASS[tier]} ${TIER_TEXT_CLASS[tier]}`}>
            {TIER_LABEL[tier]}
          </div>
          <div className={`font-op-mono text-[9px] tracking-[0.14em] font-bold ${STATUS_TEXT_CLASS[status]}`}>
            ● {STATUS_LABEL[status]}
          </div>
        </div>

        {editingName ? (
          <div className="flex gap-2 mb-3.5">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
              maxLength={40}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-base font-bold text-foreground focus:outline-none focus:border-accent"
            />
            <button onClick={saveName} className="rounded-lg bg-accent text-white px-3 py-1.5 text-sm font-semibold">
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setNameDraft(player.name); setEditingName(true); }}
            className="block text-left font-display italic font-black text-[50px] leading-[0.88] tracking-tight text-foreground mb-3.5 hover:opacity-80 transition-opacity"
          >
            {player.name}
          </button>
        )}

        {status === "resting" && (
          <div className="flex flex-col gap-2.25">
            <div className="flex gap-2">
              {TIERS.map((t) => {
                const selected = tier === t;
                return (
                  <button
                    key={t}
                    disabled={busy}
                    onClick={() => onSetTier(t)}
                    className={`flex-1 py-2.75 rounded-lg font-op-mono text-[10px] font-bold tracking-[0.12em] border-[1.5px] transition-colors disabled:opacity-40 ${
                      selected
                        ? `${TIER_BG_CLASS[t]} ${TIER_TEXT_CLASS[t]} ${TIER_BORDER_CLASS[t]}`
                        : "bg-surface text-muted border-border"
                    }`}
                  >
                    {TIER_LABEL[t]}
                  </button>
                );
              })}
            </div>
            <button
              onClick={onJoinQueue}
              disabled={busy || !player.tier}
              className="w-full bg-accent text-white py-3.25 rounded-lg text-[15px] font-bold shadow-[0_5px_18px_color-mix(in_srgb,var(--color-accent)_24%,transparent)] disabled:opacity-40 hover:bg-accent/90 transition-colors"
            >
              {busy ? "Joining…" : !player.tier ? "Pick a tier first" : "Join Queue →"}
            </button>
          </div>
        )}

        {status === "queued" && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-op-mono text-[9px] text-muted tracking-[0.14em] mb-1">QUEUE POSITION</div>
              <div className="font-display font-black text-[54px] leading-[0.82] tracking-tight text-accent">
                #{myQueuePosition}
              </div>
            </div>
            <button
              onClick={onLeaveQueue}
              disabled={busy}
              className="bg-surface text-muted px-4.5 py-2.75 rounded-lg text-[13px] font-semibold border border-border whitespace-nowrap shrink-0 hover:text-foreground transition-colors disabled:opacity-40"
            >
              Leave Queue
            </button>
          </div>
        )}

        {status === "playing" && (
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_color-mix(in_srgb,var(--color-warning)_65%,transparent)] animate-[op-livePulse_1.4s_ease_infinite] shrink-0" />
            <div className="font-op-mono text-[11px] text-warning tracking-[0.12em] font-bold">
              ON COURT {player.inMatchOnCourt! + 1}
            </div>
            <Link
              href={`/${code}/court/${player.inMatchOnCourt! + 1}`}
              className="ml-auto bg-surface text-foreground px-4 py-2.25 rounded-md text-[13px] font-semibold border border-border whitespace-nowrap shrink-0 hover:border-accent/40 transition-colors"
            >
              View Court →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
