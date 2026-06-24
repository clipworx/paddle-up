"use client";

type Props = {
  name: string;
  status: "pending" | "declined";
  busy: boolean;
  onRetry: () => void;
};

export function WaitingRoom({ name, status, busy, onRetry }: Props) {
  if (status === "pending") {
    return (
      <div className="bg-background border border-border rounded-xl px-6 py-9 text-center">
        <div className="font-op-mono text-[9px] text-warning tracking-[0.22em] mb-4 animate-[op-livePulse_2s_ease_infinite]">
          CHALLENGER APPROACHING
        </div>
        <div className="font-display italic font-black text-[46px] leading-[0.92] text-foreground mb-3.5">
          {name}
        </div>
        <div className="text-sm text-muted">Waiting for the host to admit you…</div>
      </div>
    );
  }

  return (
    <div className="bg-background border border-negative/24 rounded-xl px-6 py-9 text-center">
      <div className="font-op-mono text-[9px] text-negative tracking-[0.22em] mb-4">ACCESS DENIED</div>
      <div className="font-display italic font-black text-[46px] leading-[0.92] text-foreground mb-5.5">
        {name}
      </div>
      <button
        onClick={onRetry}
        disabled={busy}
        className="bg-surface text-foreground px-7 py-3 rounded-lg text-sm font-semibold border border-border hover:border-accent/40 transition-colors disabled:opacity-40"
      >
        {busy ? "Asking…" : "Ask to Join Again"}
      </button>
    </div>
  );
}
