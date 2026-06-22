"use client";

type Props = {
  status: "pending" | "declined";
  busy: boolean;
  onRetry: () => void;
};

export function WaitingRoom({ status, busy, onRetry }: Props) {
  return (
    <main className="mx-auto max-w-sm w-full px-4 py-16 text-center space-y-4">
      {status === "pending" ? (
        <>
          <div className="mx-auto w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <h1 className="text-xl font-bold text-foreground">You&apos;re in the waiting room</h1>
          <p className="text-sm text-muted">The host needs to let you in before you can join the queue.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-foreground">Your request was declined</h1>
          <p className="text-sm text-muted">The host didn&apos;t admit you this time.</p>
          <button
            onClick={onRetry}
            disabled={busy}
            className="rounded-xl bg-accent text-background px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
          >
            {busy ? "Asking…" : "Ask to join again"}
          </button>
        </>
      )}
    </main>
  );
}
