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
    <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5 shadow-sm space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-accent">
        Waiting room ({pending.length})
      </h3>
      <div className="space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2">
            <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onAdmit(p.id)}
                className="rounded-lg bg-accent text-background px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
              >
                Admit
              </button>
              <button
                onClick={() => onDecline(p.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
