"use client";

import Link from "next/link";
import { Match, Player } from "@/lib/types";

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
  if (!match) return null;

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="bg-background border border-warning/22 rounded-xl overflow-hidden">
      <div className="px-3.5 py-2.25 bg-warning/7 border-b border-warning/13 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-warning shadow-[0_0_5px_color-mix(in_srgb,var(--color-warning)_50%,transparent)] animate-[op-livePulse_1.4s_ease_infinite] shrink-0" />
        <div className="font-op-mono text-[9px] text-warning tracking-[0.17em] font-bold">
          COURT {courtIndex + 1} · LIVE
        </div>
        <Link
          href={`/${code}/court/${courtIndex + 1}`}
          className="ml-auto font-op-mono text-[8px] text-muted px-2.25 py-1 border border-border rounded tracking-[0.08em] hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          DETAIL →
        </Link>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3.5 pt-3.5 pb-2.5">
        <div>
          <div className="font-display italic font-extrabold text-[22px] text-foreground leading-tight">{nameOf(match.teamA[0])}</div>
          <div className="font-display italic font-extrabold text-[22px] text-foreground leading-tight">{nameOf(match.teamA[1])}</div>
        </div>
        <div className="flex flex-col items-center px-2.5 shrink-0">
          <div className="font-display italic font-black text-[24px] text-foreground leading-none">
            {match.scoreA ?? 0} – {match.scoreB ?? 0}
          </div>
          <div className="font-op-mono text-[8px] text-warning tracking-[0.12em] mt-0.5">VS</div>
        </div>
        <div className="text-right">
          <div className="font-display italic font-extrabold text-[22px] text-foreground leading-tight">{nameOf(match.teamB[0])}</div>
          <div className="font-display italic font-extrabold text-[22px] text-foreground leading-tight">{nameOf(match.teamB[1])}</div>
        </div>
      </div>
      {isEditor && (
        <div className="px-3.5 pb-3">
          <button
            onClick={onComplete}
            disabled={busy}
            className="w-full py-2.5 rounded-md text-[13px] font-bold bg-negative/9 text-negative border border-negative/20 hover:bg-negative hover:text-white transition-colors disabled:opacity-40 tracking-wide"
          >
            Complete Match
          </button>
        </div>
      )}
    </div>
  );
}
