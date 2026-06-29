"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { useNotifications } from "@/components/Notifications";
import { setStoredIdentity, generatePlayerId } from "@/lib/playerIdentity";
import { applySetCourtCount } from "@/lib/sessionTransitions";
import { MAX_COURTS } from "@/lib/types";

const PASSWORD_KEY_PREFIX = "paddle-up-edit-pw-v1:";

const COURT_OPTIONS = [1, 2, 3, 4];

const FEATURES = [
  {
    title: "Everyone joins themselves",
    body: "No more typing every name into a roster. Each player opens the link on their own phone, types their name once, and they're in — like a Skribbl.io lobby.",
  },
  {
    title: "Novice or intermediate",
    body: "Players pick their own tier and tap Join when they're ready to play. Tap Leave anytime to rest — no host needed to manage who's up next.",
  },
  {
    title: "Automatic matchmaking",
    body: "The moment four players in the same tier have joined and a court is free, a match forms automatically and shows up on every phone instantly.",
  },
  {
    title: "Up to four courts",
    body: "Run one to four courts at once. Novice and intermediate matches fill whichever court frees up next — nobody waits longer than a match cycle.",
  },
  {
    title: "Live everywhere",
    body: "Every device watching the session — including a shared screen at courtside — sees joins, matches, and completions update in real time.",
  },
  {
    title: "Light host controls",
    body: "Whoever creates the session keeps a few admin powers — adjust court count, remove a player, or end the session — everything else is self-service.",
  },
];

export default function Landing() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [showCreate, setShowCreate] = useState(true);

  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createCourts, setCreateCourts] = useState(2);

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!createName.trim()) {
      setError("Enter your name.");
      return;
    }
    if (createPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: createPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body?.code !== "string") {
        const msg = body?.error ?? "Failed to create session.";
        setError(msg);
        notify(msg, "error");
        return;
      }
      const code: string = body.code;
      try {
        localStorage.setItem(`${PASSWORD_KEY_PREFIX}${code}`, createPassword);
      } catch {}

      // Self-join as host — including the password admits immediately,
      // so the host lands straight on the dashboard with no extra step.
      const playerId = generatePlayerId();
      await fetch(`/api/sessions/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, name: createName.trim(), password: createPassword }),
      });
      setStoredIdentity(code, { playerId, name: createName.trim() });

      if (createCourts !== 1) {
        const stateRes = await fetch(`/api/sessions/${code}`);
        const { state } = await stateRes.json();
        const result = applySetCourtCount(state, createCourts, MAX_COURTS);
        if (!("error" in result)) {
          await fetch(`/api/sessions/${code}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password: createPassword, state: result }),
          });
        }
      }

      notify(`Session ${code} created`, "success");
      router.push(`/${code}`);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedCode = joinCode.trim().toUpperCase();
    if (!trimmedCode) {
      setError("Enter a session code.");
      return;
    }
    if (!joinName.trim()) {
      setError("Enter your name.");
      return;
    }
    setBusy(true);
    try {
      const playerId = generatePlayerId();
      const res = await fetch(`/api/sessions/${trimmedCode}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, name: joinName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error === "session_not_found" ? "Session not found. Check the code." : "Failed to join session.");
        return;
      }
      setStoredIdentity(trimmedCode, { playerId, name: joinName.trim() });
      router.push(`/${trimmedCode}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-4xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/book" className="flex items-center gap-2 shrink-0">
            <Logo size={28} />
            <span className="text-sm font-bold text-foreground">ReZerve</span>
          </Link>
          <div className="flex-1" />
          <Link
            href="/book"
            className="text-sm font-semibold text-muted hover:text-accent transition-colors"
          >
            Book a Court
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl w-full px-4 py-12 sm:py-16 space-y-16">
        {/* HERO */}
        <section className="flex flex-col items-center text-center">
          <div className="mb-10">
            <div className="font-display italic font-black text-[54px] text-accent leading-none tracking-tight">
              ReZerve
            </div>
            <div className="font-op-mono text-[10px] text-muted tracking-[0.24em] mt-1.25">OPEN PLAY</div>
          </div>

          <div className="flex bg-background rounded-[10px] p-1 w-full max-w-105 mb-4.5">
            <button
              type="button"
              onClick={() => { setShowCreate(true); setError(null); }}
              className={`flex-1 py-2.75 rounded-lg text-sm font-bold transition-colors ${
                showCreate ? "bg-accent text-white" : "text-muted"
              }`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setError(null); }}
              className={`flex-1 py-2.75 rounded-lg text-sm font-bold transition-colors ${
                !showCreate ? "bg-accent text-white" : "text-muted"
              }`}
            >
              Join
            </button>
          </div>

          {showCreate ? (
            <form onSubmit={doCreate} className="w-full max-w-105 flex flex-col gap-2.5">
              <div className="bg-background border border-border rounded-lg px-4.5 py-3.5 text-left">
                <div className="font-op-mono text-[9px] text-muted tracking-[0.18em] mb-1.75">YOUR NAME</div>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                  autoComplete="off"
                  className="w-full bg-transparent text-[17px] font-semibold text-foreground placeholder:text-muted/60 focus:outline-none"
                />
              </div>
              <div className="bg-background border border-border rounded-lg px-4.5 py-3.5 text-left">
                <div className="font-op-mono text-[9px] text-muted tracking-[0.18em] mb-1.75">HOST PASSWORD</div>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Set a host password"
                  autoComplete="new-password"
                  className="w-full bg-transparent text-[17px] font-semibold text-foreground placeholder:text-muted/60 focus:outline-none"
                />
              </div>
              <div className="bg-background border border-border rounded-lg px-4.5 py-3.5 text-left">
                <div className="font-op-mono text-[9px] text-muted tracking-[0.18em] mb-2.5">COURTS</div>
                <div className="flex gap-2">
                  {COURT_OPTIONS.map((n) => {
                    const selected = n === createCourts;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCreateCourts(n)}
                        className={`flex-1 py-3 rounded-lg text-lg font-extrabold border-[1.5px] transition-colors ${
                          selected ? "bg-accent text-white border-accent" : "bg-background text-muted border-border"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && <p className="text-negative text-sm text-center font-medium px-2">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="bg-accent text-white py-4 rounded-lg text-base font-bold shadow-[0_8px_24px_color-mix(in_srgb,var(--color-accent)_28%,transparent)] hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                {busy ? "Creating…" : "Create Session →"}
              </button>
            </form>
          ) : (
            <form onSubmit={doJoin} className="w-full max-w-105 flex flex-col gap-2.5">
              <div className="bg-background border border-border rounded-lg px-4.5 py-3.5 text-left">
                <div className="font-op-mono text-[9px] text-muted tracking-[0.18em] mb-1.75">SESSION CODE</div>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="w-full bg-transparent font-op-mono text-[30px] font-bold text-accent tracking-[0.12em] placeholder:text-muted/40 focus:outline-none"
                />
              </div>
              <div className="bg-background border border-border rounded-lg px-4.5 py-3.5 text-left">
                <div className="font-op-mono text-[9px] text-muted tracking-[0.18em] mb-1.75">YOUR NAME</div>
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                  autoComplete="off"
                  className="w-full bg-transparent text-[17px] font-semibold text-foreground placeholder:text-muted/60 focus:outline-none"
                />
              </div>
              {error && <p className="text-negative text-sm text-center font-medium px-2">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="bg-accent text-white py-4 rounded-lg text-base font-bold shadow-[0_8px_24px_color-mix(in_srgb,var(--color-accent)_28%,transparent)] hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                {busy ? "Joining…" : "Join Session →"}
              </button>
            </form>
          )}
        </section>

        {/* FEATURES */}
        <section className="space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">
              What it does
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">
              Built for casual open play
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-background/60 p-5 shadow-sm"
              >
                <h3 className="text-base font-bold text-foreground mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* EDITING NOTE */}
        <section className="rounded-xl border border-accent/40 bg-accent/5 p-5 text-center">
          <h3 className="text-base font-bold text-foreground mb-1">
            Players vs host
          </h3>
          <p className="text-sm text-muted max-w-xl mx-auto">
            Anyone with the session code can request to join, pick a tier, and
            tap Join queue &mdash; no password needed. Only whoever created the
            session (the host) enters the host password to admit players,
            adjust court count, or end the session.
          </p>
        </section>

      </main>
      <Footer />
    </>
  );
}
