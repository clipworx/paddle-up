"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useNotifications } from "@/components/Notifications";

const PASSWORD_KEY_PREFIX = "paddle-up-edit-pw-v1:";

const FEATURES = [
  {
    title: "Smart rotation",
    body: "Everyone gets equal court time, partners with new teammates every round, and sits out one game between matches so nobody plays back-to-back.",
  },
  {
    title: "Mixed or skill-separated",
    body: "Rotate everyone in one pool, or flip the skill-separation switch to split casual and competitive players into their own rotations.",
  },
  {
    title: "Up to four courts",
    body: "Run one to four courts at once. Players are never double-booked, and the upcoming queue always shows the next three matches across all courts.",
  },
  {
    title: "Real-time scoring",
    body: "Editors bump the score and every phone in the group sees it update instantly — no refresh, no reloads.",
  },
  {
    title: "Server & announcer",
    body: "Track which team is serving plus 1st / 2nd server, then tap the announcer to call the score or read the matchup out loud.",
  },
  {
    title: "Rest, change, remove",
    body: "Mark a player as resting to sit out a game, change a skill level from their profile, or remove them entirely — the queue re-shuffles automatically.",
  },
];

const STEPS = [
  {
    title: "Create an open play",
    body: "Tap Create Open Play, pick an edit password, and you'll get a 6-character code unique to your session.",
  },
  {
    title: "Share the code",
    body: "Your group opens the app, taps Join with code, and types the 6 characters. They join in view-only mode instantly.",
  },
  {
    title: "Add players and play",
    body: "Enter players with their skill levels, open the courts you'll use, generate matches, and score them as you go. End the session when everyone's done.",
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
    <main className="mx-auto max-w-3xl w-full px-4 py-12 sm:py-16 space-y-16">
      {/* HERO */}
      <section className="text-center space-y-5">
        <div className="flex justify-center">
          <Logo size={80} />
        </div>
        <div className="inline-block rounded-full bg-accent/15 text-accent px-4 py-1 text-xs font-semibold uppercase tracking-widest">
          Pickleball Open Play
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-foreground tracking-tight">
          Paddle Up
        </h1>
        <p className="text-base sm:text-lg text-muted max-w-xl mx-auto">
          Balanced matches, live scores, and a shared match queue for your
          pickleball group. Create a session, share the 6-character code, and
          you'll be playing in under a minute.
        </p>

        {mode === "idle" && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => {
                setMode("create");
                setError(null);
              }}
              className="flex-1 rounded-xl bg-accent text-background px-6 py-3 text-base font-semibold hover:bg-muted transition-colors shadow-sm"
            >
              Create Open Play
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("join");
                setError(null);
              }}
              className="flex-1 rounded-xl border-2 border-border text-foreground px-6 py-3 text-base font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
            >
              Join with code
            </button>
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
          Viewers vs editors
        </h3>
        <p className="text-sm text-muted max-w-xl mx-auto">
          Anyone with the session code can watch the rotation, scores, and
          upcoming queue live. Only people who enter the edit password can add
          players, generate matches, bump scores, or end the session. Join as a
          viewer first and tap the lock pill in the top right when you're ready
          to edit.
        </p>
      </section>

      <footer className="text-center text-xs text-muted pt-4">
        Made for the pickleball crew.
      </footer>
    </main>
  );
}
