"use client";

import { MAX_COURTS } from "@/lib/types";

type Props = {
  courtCount: number;
  onSetCourtCount: (n: number) => void;
  onEndSession: () => void;
};

export function HostPanel({ courtCount, onSetCourtCount, onEndSession }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted">Host controls</h3>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Courts</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetCourtCount(Math.max(1, courtCount - 1))}
            disabled={courtCount <= 1}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-foreground hover:bg-accent/10 disabled:opacity-30"
          >
            −
          </button>
          <span className="w-6 text-center font-bold text-foreground">{courtCount}</span>
          <button
            onClick={() => onSetCourtCount(Math.min(MAX_COURTS, courtCount + 1))}
            disabled={courtCount >= MAX_COURTS}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-foreground hover:bg-accent/10 disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={onEndSession}
        className="w-full rounded-lg border border-accent/50 text-accent py-2 text-sm font-semibold hover:bg-accent hover:text-background transition-colors"
      >
        End session
      </button>
    </div>
  );
}
