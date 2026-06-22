"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { useNotifications } from "@/components/Notifications";

const PASSWORD_KEY_PREFIX = "paddle-up-edit-pw-v1:";

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

const STEPS = [
  {
    title: "Create an open play",
    body: "Tap Create Open Play, pick an edit password, and you'll get a 6-character code unique to your session.",
  },
  {
    title: "Share the code",
    body: "Your group opens the link, types their name, and picks novice or intermediate. They're in the roster instantly — no roster typing for you.",
  },
  {
    title: "Tap Join, play, repeat",
    body: "Players tap Join when they want to play. Once a tier has four, a match forms and assigns itself to a free court automatically.",
  },
];

export default function Landing() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [joinCode, setJoinCode] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirm, setCreateConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (createPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (createPassword !== createConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    let code: string | null = null;
    let errMsg: string | null = null;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: createPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body?.code !== "string") {
        errMsg = body?.error ?? "Failed to create session.";
      } else {
        code = body.code;
      }
    } catch (e) {
      errMsg = (e as Error).message;
    }
    setBusy(false);
    if (!code) {
      const msg = errMsg ?? "Failed to create session.";
      setError(msg);
      notify(msg, "error");
      return;
    }
    try {
      localStorage.setItem(`${PASSWORD_KEY_PREFIX}${code}`, createPassword);
    } catch {}
    notify(`Session ${code} created`, "success");
    router.push(`/${code}`);
  };

  const doJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/${trimmed}`);
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
        <section className="text-center space-y-5">
          <div className="inline-block rounded-full bg-accent/15 text-accent px-4 py-1 text-xs font-semibold uppercase tracking-widest">
            Open Play
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-foreground tracking-tight">
            ReZerve
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-xl mx-auto">
            Self-service open play for your pickleball group. Create a session,
            share the 6-character code, and everyone joins, picks a tier, and
            gets matched up automatically &mdash; no roster typing required.
          </p>

          {mode === "idle" && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  setMode("create");
                  setError(null);
                }}
                className="flex-1 rounded-lg bg-accent text-background px-6 py-3 text-base font-semibold hover:bg-muted transition-colors shadow-sm"
              >
                Create Open Play
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("join");
                  setError(null);
                }}
                className="flex-1 rounded-lg border border-border text-foreground px-6 py-3 text-base font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
              >
                Join with code
              </button>
            </div>
          )}

          {mode === "idle" && (
            <div className="pt-1">
              <Link
                href="/book"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 text-accent px-5 py-2.5 text-sm font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
              >
                Book a Court
              </Link>
            </div>
          )}

          {mode === "create" && (
            <form
              onSubmit={doCreate}
              className="text-left max-w-md mx-auto rounded-xl border border-border bg-background/60 p-5 space-y-4 shadow-sm"
            >
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Create a new open play
                </h2>
                <p className="text-xs text-muted mt-1">
                  Pick a password. Anyone can view the session, but only people
                  with the password can edit players, scores, and the match queue.
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                  Edit password
                </span>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                  Confirm password
                </span>
                <input
                  type="password"
                  value={createConfirm}
                  onChange={(e) => setCreateConfirm(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </label>
              {error && (
                <p className="text-sm text-accent font-semibold">{error}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode("idle");
                    setCreatePassword("");
                    setCreateConfirm("");
                    setError(null);
                  }}
                  className="rounded-lg px-4 py-2 text-sm border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-accent"
                >
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          )}

          {mode === "join" && (
            <form
              onSubmit={doJoin}
              className="text-left max-w-md mx-auto rounded-xl border border-border bg-background/60 p-5 space-y-4 shadow-sm"
            >
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Join an open play
                </h2>
                <p className="text-xs text-muted mt-1">
                  Enter the 6-character code shared with you.
                </p>
              </div>
              <input
                type="text"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                }
                autoFocus
                placeholder="ABC123"
                maxLength={6}
                className="w-full rounded-lg border border-border bg-background px-3 py-4 text-center text-3xl font-mono tracking-[0.5em] uppercase text-foreground focus:outline-none focus:border-accent"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode("idle");
                    setJoinCode("");
                  }}
                  className="rounded-lg px-4 py-2 text-sm border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinCode.length < 1}
                  className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-accent"
                >
                  Go
                </button>
              </div>
            </form>
          )}
        </section>

        {/* HOW IT WORKS */}
        <section className="space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">
              How it works
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">
              Three steps to get started
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border border-border bg-background/60 p-5 shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-background font-bold mb-3">
                  {i + 1}
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">
                  {step.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
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
            Anyone with the session code can join, pick a tier, and tap Join
            queue &mdash; no password needed. Only whoever created the session
            (the host) can enter the edit password to adjust court count,
            remove a player, or end the session.
          </p>
        </section>

      </main>
      <Footer />
    </>
  );
}
