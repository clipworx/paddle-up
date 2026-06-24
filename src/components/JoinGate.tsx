"use client";

import { useState } from "react";

type Props = {
  code: string;
  busy: boolean;
  onSubmit: (name: string) => void;
};

export function JoinGate({ code, busy, onSubmit }: Props) {
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="bg-background border border-border rounded-xl px-5 py-7 text-center">
        <div className="font-op-mono text-[9px] text-accent tracking-[0.22em] mb-3.5">CHALLENGER APPROACHING</div>
        <div className="font-display italic font-black text-4xl text-foreground mb-1.5">{code}</div>
        <div className="text-sm text-muted">Enter your name to request entry</div>
      </div>
      <div className="bg-background border border-border rounded-lg px-4.5 py-3.5">
        <div className="font-op-mono text-[9px] text-muted tracking-[0.18em] mb-1.75">YOUR NAME</div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={40}
          placeholder="Enter your name"
          className="w-full bg-transparent text-[17px] font-semibold text-foreground placeholder:text-muted/60 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="w-full bg-accent text-white py-3.5 rounded-lg text-[15px] font-bold hover:bg-accent/90 transition-colors disabled:opacity-40"
      >
        {busy ? "Requesting…" : "Request to Join →"}
      </button>
    </form>
  );
}
