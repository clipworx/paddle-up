"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayerList } from "@/components/PlayerList";
import { CourtConfig } from "@/components/CourtConfig";
import { CourtSummaryCard } from "@/components/CourtSummaryCard";
import { UpcomingMatches } from "@/components/UpcomingMatches";
import { Scoreboard } from "@/components/Scoreboard";
import { EditLock } from "@/components/EditLock";
import { Logo } from "@/components/Logo";
import { useNotifications } from "@/components/Notifications";
import { useSharedState } from "@/lib/sharedState";
import { generateMatch, substituteInMatch } from "@/lib/rotation";
import {
  activeCourtMatches,
  fillQueue,
  resizeCourts,
} from "@/lib/sessionHelpers";
import { MAX_COURTS, PendingMatch, Player, SkillLevel } from "@/lib/types";

export default function SessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const normalized = code.toUpperCase();
  const router = useRouter();
  const { notify, confirm } = useNotifications();
  const {
    state,
    setState,
    hydrated,
    exists,
    isEditor,
    authenticate,
    logout,
    deleteSession,
  } = useSharedState(normalized);
  const readOnly = !isEditor;
  const skillSeparation = state.skillSeparation === true;

  const canGenerateAny =
    state.players.filter((p) => p.active !== false).length >= 4;

  const handleGenerate = (courtIndex: number) => {
    let generated = false;
    setState((s) => {
      if (s.courts[courtIndex]) return s;
      const courts = [...s.courts];
      let upcoming = [...s.upcoming];
      if (upcoming.length > 0) {
        courts[courtIndex] = upcoming[0];
        upcoming = upcoming.slice(1);
      } else {
        const fresh = generateMatch(
          s.players,
          s.history,
          activeCourtMatches(courts),
          upcoming,
          s.skillSeparation === true
        );
        if (!fresh) return s;
        courts[courtIndex] = fresh;
      }
      generated = true;
      return {
        ...s,
        courts,
        upcoming: fillQueue(
          s.players,
          s.history,
          courts,
          upcoming,
          s.skillSeparation === true
        ),
      };
    });
    if (generated) notify(`New match assigned to Court ${courtIndex + 1}`, "info");
  };

  const handleEndSession = async () => {
    const ok = await confirm(
      `This permanently deletes session ${normalized} and all of its players, matches, and history. This cannot be undone.`,
      {
        title: "End session?",
        confirmLabel: "End session",
      }
    );
    if (!ok) return;
    const deleted = await deleteSession();
    if (deleted) {
      notify(`Session ${normalized} ended`, "success");
      router.push("/");
    } else {
      notify("Failed to end session", "error");
    }
  };

  const addPlayer = (name: string, skill: SkillLevel) => {
    const player: Player = { id: crypto.randomUUID(), name, skill, active: true };
    setState((s) => ({ ...s, players: [...s.players, player] }));
  };

  const toggleActive = (id: string) => {
    setState((s) => {
      const players = s.players.map((p) =>
        p.id === id ? { ...p, active: p.active === false } : p
      );
      const target = players.find((p) => p.id === id);
      if (!target || target.active) return { ...s, players };
      const matchHasPlayer = (m: PendingMatch) =>
        [...m.teamA, ...m.teamB].includes(id);

      // Substitute resting player in upcoming queue (keeps slots intact).
      const updatedUpcoming: PendingMatch[] = [];
      for (let i = 0; i < s.upcoming.length; i++) {
        const m = s.upcoming[i];
        if (!matchHasPlayer(m)) {
          updatedUpcoming.push(m);
          continue;
        }
        const active = activeCourtMatches(s.courts);
        const prev =
          i === 0 ? active[active.length - 1] : updatedUpcoming[updatedUpcoming.length - 1];
        const next = s.upcoming[i + 1];
        const forbidden = new Set<string>();
        for (const am of active)
          for (const pid of [...am.teamA, ...am.teamB]) forbidden.add(pid);
        if (prev) for (const pid of [...prev.teamA, ...prev.teamB]) forbidden.add(pid);
        if (next) for (const pid of [...next.teamA, ...next.teamB]) forbidden.add(pid);
        const sub = substituteInMatch(
          m,
          id,
          players,
          s.history,
          forbidden,
          s.skillSeparation === true
        );
        if (sub) updatedUpcoming.push(sub);
      }

      return {
        ...s,
        players,
        upcoming: fillQueue(
          players,
          s.history,
          s.courts,
          updatedUpcoming,
          s.skillSeparation === true
        ),
      };
    });
  };

  const removePlayer = (id: string) => {
    setState((s) => {
      const players = s.players.filter((p) => p.id !== id);
      const matchHasPlayer = (m: PendingMatch) =>
        [...m.teamA, ...m.teamB].includes(id);
      // Clear any court whose match contains this player
      const courts = s.courts.map((m) => (m && matchHasPlayer(m) ? null : m));
      const upcoming = s.upcoming.filter((m) => !matchHasPlayer(m));
      return {
        ...s,
        players,
        courts,
        upcoming: fillQueue(
          players,
          s.history,
          courts,
          upcoming,
          s.skillSeparation === true
        ),
      };
    });
  };

  const setCourtCount = (n: number) =>
    setState((s) => {
      const desired = Math.max(1, Math.min(MAX_COURTS, n));
      const courts = resizeCourts(s.courts, desired);
      return {
        ...s,
        courtCount: desired,
        courts,
        upcoming: fillQueue(
          s.players,
          s.history,
          courts,
          s.upcoming,
          s.skillSeparation === true
        ),
      };
    });

  const setSkillSeparation = (next: boolean) =>
    setState((s) => ({
      ...s,
      skillSeparation: next,
      upcoming: fillQueue(s.players, s.history, s.courts, [], next),
    }));

  const changeSkill = (id: string, skill: SkillLevel) => {
    setState((s) => {
      const players = s.players.map((p) =>
        p.id === id ? { ...p, skill } : p
      );
      if (s.skillSeparation === true) {
        // If separation is on, tier membership may have shifted; regenerate
        // the upcoming queue from scratch under the new grouping.
        return {
          ...s,
          players,
          upcoming: fillQueue(players, s.history, s.courts, [], true),
        };
      }
      return { ...s, players };
    });
  };

  if (hydrated && !exists) {
    return (
      <main className="mx-auto max-w-xl w-full px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Session not found</h1>
        <p className="text-sm text-muted">
          No open play exists with code{" "}
          <span className="font-mono font-semibold text-foreground">
            {normalized}
          </span>
          .
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
        >
          Back to start
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl w-full px-4 py-6 sm:py-8 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Logo size={44} className="shrink-0 mt-1 sm:w-13 sm:h-13" />
          <div className="min-w-0">
            <Link
              href="/"
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              ← Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
              Paddle Up
            </h1>
            <p className="text-xs sm:text-sm text-muted">
              Session{" "}
              <span className="font-mono font-semibold text-accent">
                {normalized}
              </span>
              <span className="hidden sm:inline">
                {" "}
                · Pickleball open play rotation & scores.
              </span>
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <EditLock
            isEditor={isEditor}
            onAuthenticate={authenticate}
            onLogout={logout}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <PlayerList
            players={state.players}
            readOnly={readOnly}
            onAdd={addPlayer}
            onRemove={removePlayer}
            onToggleActive={toggleActive}
            onChangeSkill={changeSkill}
          />
          <CourtConfig
            courtCount={state.courtCount}
            readOnly={readOnly}
            skillSeparation={skillSeparation}
            onChange={setCourtCount}
            onToggleSkillSeparation={setSkillSeparation}
          />
        </div>

        <div className="space-y-4">
          {state.courts.map((match, i) => (
            <CourtSummaryCard
              key={i}
              code={normalized}
              courtIndex={i}
              pending={match}
              players={state.players}
              readOnly={readOnly}
              canGenerate={canGenerateAny && !match}
              onGenerate={() => handleGenerate(i)}
            />
          ))}
          <UpcomingMatches players={state.players} upcoming={state.upcoming} />
        </div>

        <Scoreboard players={state.players} history={state.history} />
      </div>

      {!readOnly && (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
              Danger zone
            </h2>
            <p className="text-xs text-muted mt-1">
              Ending this session permanently deletes all players, matches, and
              history for code{" "}
              <span className="font-mono font-semibold text-foreground">
                {normalized}
              </span>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={handleEndSession}
            className="shrink-0 rounded-lg border border-accent bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted hover:border-muted transition-colors"
          >
            End Session
          </button>
        </section>
      )}
    </main>
  );
}
