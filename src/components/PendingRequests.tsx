"use client";

import { Player } from "@/lib/types";

type Props = {
  players: Player[];
  onAdmit: (id: string) => void;
  onDecline: (id: string) => void;
};

export function PendingRequests({ players, onAdmit, onDecline }: Props) {
  const pending = players.filter((p) => p.status === "pending");
  if (pending.length === 0) return null;

  return (
    <div className="bg-background border border-warning/20 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-warning animate-[op-livePulse_1.4s_ease_infinite] shrink-0" />
        <div className="font-op-mono text-[9px] text-warning tracking-[0.17em] font-bold">WAITING ROOM</div>
        <div className="ml-auto font-op-mono text-[9px] text-muted">{pending.length} PENDING</div>
      </div>
      <div>
        {pending.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 px-4 py-2.75 border-b border-border/60 last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base truncate">{p.name}</div>
              <div className="font-op-mono text-[9px] text-muted tracking-widest mt-0.5">CHALLENGER APPROACHING</div>
            </div>
            <button
              onClick={() => onAdmit(p.id)}
              className="bg-accent/14 text-accent px-3.5 py-2 rounded-md text-[13px] font-bold hover:bg-accent hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Admit
            </button>
            <button
              onClick={() => onDecline(p.id)}
              className="bg-negative/10 text-negative px-3.5 py-2 rounded-md text-[13px] font-bold hover:bg-negative hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Decline
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
