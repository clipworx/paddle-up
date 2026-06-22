"use client";

import { useState } from "react";

type Props = {
  busy: boolean;
  onSubmit: (name: string) => void;
};

export function JoinGate({ busy, onSubmit }: Props) {
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <main className="mx-auto max-w-sm w-full px-4 py-16">
      <form onSubmit={submit} className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-foreground">What&apos;s your name?</h1>
        <p className="text-sm text-muted">You&apos;ll show up in the roster for everyone in this session.</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={40}
          placeholder="Your name"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground text-center placeholder:text-muted/60 focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-full rounded-xl bg-accent text-background py-3 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
        >
          {busy ? "Joining…" : "Join session"}
        </button>
      </form>
    </main>
  );
}
