"use client";

import { use } from "react";
import Link from "next/link";
import { useSharedState } from "@/lib/sharedState";
import { Player } from "@/lib/types";
import { TIER_LABEL, TIER_TEXT_CLASS, queuedInTier } from "@/lib/openPlayDisplay";
import { TIERS } from "@/lib/types";

function nameOf(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "?";
}

export default function LivePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const normalized = code.toUpperCase();
  const { state, hydrated, exists } = useSharedState(normalized);

  if (hydrated && !exists) {
    return (
      <main className="max-w-145 w-full mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Session not found</h1>
        <Link
          href="/play"
          className="inline-block rounded-lg bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          Back to start
        </Link>
      </main>
    );
  }

  return (
    <div className="max-w-250 w-full mx-auto px-4.5 py-5 pb-16">
      <div className="flex items-end justify-between gap-4 mb-5.5 pb-4 border-b border-border">
        <div>
          <div className="font-display italic font-black text-[38px] text-accent leading-[0.92] tracking-tight">
            ReZerve
          </div>
          <div className="font-op-mono text-[9px] text-muted tracking-[0.22em] mt-1.25">OPEN PLAY · LIVE</div>
        </div>
        <div className="text-right">
          <div className="font-op-mono text-[9px] text-muted tracking-[0.17em]">SESSION</div>
          <div className="font-op-mono text-[28px] font-bold text-accent tracking-[0.17em] leading-none">
            {normalized}
          </div>
        </div>
      </div>

      <div className="grid gap-3.25 mb-5.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {state.courts.map((match, i) => {
          const isPlaying = match !== null;
          return (
            <div
              key={i}
              className={`bg-background rounded-xl overflow-hidden border ${isPlaying ? "border-warning/30" : "border-border"}`}
            >
              <div className={`px-3.5 py-2.5 flex items-center gap-2 border-b border-border/60 ${isPlaying ? "bg-warning/8" : "bg-surface/40"}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPlaying ? "bg-warning" : "bg-foreground/22"}`} />
                <div className={`font-op-mono text-[9px] tracking-[0.17em] font-bold ${isPlaying ? "text-warning" : "text-foreground/22"}`}>
                  COURT {i + 1} · {isPlaying ? "LIVE" : "OPEN"}
                </div>
              </div>
              <div className="p-3.5">
                {match ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                    <div>
                      <div className="font-display italic font-extrabold text-[21px] text-foreground leading-tight">{nameOf(state.players, match.teamA[0])}</div>
                      <div className="font-display italic font-extrabold text-[21px] text-foreground leading-tight">{nameOf(state.players, match.teamA[1])}</div>
                    </div>
                    <div className="flex flex-col items-center px-2 shrink-0">
                      <div className="font-display italic font-black text-[19px] text-foreground leading-none">
                        {match.scoreA ?? 0} – {match.scoreB ?? 0}
                      </div>
                      <div className="font-op-mono text-[7px] text-warning tracking-[0.12em] mt-0.5">VS</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display italic font-extrabold text-[21px] text-foreground leading-tight">{nameOf(state.players, match.teamB[0])}</div>
                      <div className="font-display italic font-extrabold text-[21px] text-foreground leading-tight">{nameOf(state.players, match.teamB[1])}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4.5 font-op-mono text-[10px] text-foreground/17 tracking-[0.2em]">
                    STANDING BY
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5.5">
        {TIERS.map((tier) => {
          const queued = queuedInTier(state.players, tier);
          return (
            <div key={tier} className="bg-background border border-border rounded-lg p-3.5">
              <div className={`font-op-mono text-[9px] tracking-[0.17em] font-bold mb-2.5 ${TIER_TEXT_CLASS[tier]}`}>
                {TIER_LABEL[tier]} QUEUE
              </div>
              {queued.length > 0 ? (
                queued.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 py-0.75">
                    <div className={`font-display font-black text-2xl leading-none min-w-5 ${TIER_TEXT_CLASS[tier]}`}>
                      {i + 1}
                    </div>
                    <div className="font-semibold text-[15px] text-foreground truncate">{p.name}</div>
                  </div>
                ))
              ) : (
                <div className="font-op-mono text-[9px] text-foreground/17 tracking-[0.12em]">EMPTY</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <Link
          href={`/${normalized}`}
          className="font-op-mono text-[9px] text-muted px-4.5 py-2.25 border border-border rounded-md tracking-[0.12em] hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          ← BACK TO SESSION
        </Link>
      </div>
    </div>
  );
}
