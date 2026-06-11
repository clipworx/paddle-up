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
import { generateMatch, advanceQueue } from "@/lib/rotation";
import {
  activeCourtMatches,
  fillQueue,
  resizeCourts,
} from "@/lib/sessionHelpers";
import { CompletedMatch, MAX_COURTS, PendingMatch, Player, ResultMode, SkillLevel } from "@/lib/types";

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
  const skillBased = state.skillBased === true;
  const skillSeparation = state.skillSeparation === true;
  const lockedPairs = state.lockedPairs ?? [];
  const resultMode: ResultMode = state.resultMode ?? "score";
  // Fallback for sessions created before queue was introduced
  const q = state.queue?.length ? state.queue : state.players.map((p) => p.id);

  const handleSetResultMode = (mode: ResultMode) =>
    setState((s) => ({ ...s, resultMode: mode }));

  const canGenerateAny =
    state.players.filter((p) => p.active !== false).length >= 4;

  const handleGenerate = (courtIndex: number) => {
    let generated = false;
    setState((s) => {
      if (s.courts[courtIndex]) return s;
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const courts = [...s.courts];
      let upcoming = [...s.upcoming];
      if (upcoming.length > 0) {
        courts[courtIndex] = upcoming[0];
        upcoming = upcoming.slice(1);
      } else {
        const fresh = generateMatch(
          queue, s.players, s.history,
          activeCourtMatches(courts), [],
          s.skillBased === true, s.lockedPairs ?? []
        );
        if (!fresh) return s;
        courts[courtIndex] = fresh;
      }
      generated = true;
      return {
        ...s,
        courts,
        upcoming: fillQueue(queue, s.players, s.history, courts, s.skillBased === true, s.lockedPairs ?? []),
      };
    });
    if (generated) notify(`New match assigned to Court ${courtIndex + 1}`, "info");
  };

  const handleDeclareWinner = (courtIndex: number, winner: "A" | "B" | "tie") => {
    setState((s) => {
      const m = s.courts[courtIndex];
      if (!m) return s;
      const completed: CompletedMatch = { ...m, winner, completedAt: Date.now() };
      const history = [...s.history, completed];
      const queue = advanceQueue(
        s.queue?.length ? s.queue : s.players.map((p) => p.id),
        [...m.teamA, ...m.teamB]
      );
      const courts = [...s.courts];
      let upcoming = [...s.upcoming];
      if (upcoming.length > 0) {
        courts[courtIndex] = upcoming[0];
        upcoming = upcoming.slice(1);
      } else {
        courts[courtIndex] = null;
      }
      return {
        ...s,
        history,
        queue,
        courts,
        upcoming: fillQueue(queue, s.players, history, courts, s.skillBased === true, s.lockedPairs ?? []),
      };
    });
    const label = winner === "tie" ? "Tie game" : winner === "A" ? "Team A wins" : "Team B wins";
    notify(`Court ${courtIndex + 1}: ${label}`, "success");
  };

  const handleEndSession = async () => {
    const ok = await confirm(
      `This permanently deletes session ${normalized} and all of its players, matches, and history. This cannot be undone.`,
      { title: "End session?", confirmLabel: "End session" }
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
    const player: Player = { id: crypto.randomUUID(), name, skill, active: true, joinedAt: Date.now() };
    setState((s) => ({
      ...s,
      players: [...s.players, player],
      queue: [...(s.queue?.length ? s.queue : s.players.map((p) => p.id)), player.id],
    }));
  };

  const toggleActive = (id: string) => {
    setState((s) => {
      const goingInactive = s.players.find((p) => p.id === id)?.active !== false;
      const players = s.players.map((p) =>
        p.id === id ? { ...p, active: p.active === false } : p
      );
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const lockedPairs = s.lockedPairs ?? [];

      if (goingInactive) {
        const courtIdx = s.courts.findIndex(
          (m) => m && (m.teamA.includes(id) || m.teamB.includes(id))
        );

        if (courtIdx !== -1) {
          const lockedMap = new Map<string, string>();
          for (const [a, b] of lockedPairs) {
            lockedMap.set(a, b);
            lockedMap.set(b, a);
          }

          const onAnyCourt = new Set<string>();
          s.courts.forEach((m) => {
            if (!m) return;
            for (const pid of [...m.teamA, ...m.teamB])
              if (pid !== id) onAnyCourt.add(pid);
          });

          const substitute = queue.find((qid) => {
            if (qid === id) return false;
            if (onAnyCourt.has(qid)) return false;
            const p = players.find((pl) => pl.id === qid);
            if (!p || p.active === false) return false;
            if (lockedMap.has(qid)) return false;
            return true;
          });

          if (substitute) {
            const m = s.courts[courtIdx]!;
            const courts = [...s.courts];
            courts[courtIdx] = {
              ...m,
              teamA: m.teamA.map((pid) => (pid === id ? substitute : pid)) as [string, string],
              teamB: m.teamB.map((pid) => (pid === id ? substitute : pid)) as [string, string],
            };
            return {
              ...s,
              players,
              courts,
              upcoming: fillQueue(queue, players, s.history, courts, s.skillBased === true, lockedPairs),
            };
          }
        }
      }

      return {
        ...s,
        players,
        upcoming: fillQueue(queue, players, s.history, s.courts, s.skillBased === true, lockedPairs),
      };
    });
  };

  const removePlayer = (id: string) => {
    setState((s) => {
      const players = s.players.filter((p) => p.id !== id);
      const lockedPairs = (s.lockedPairs ?? []).filter(([a, b]) => a !== id && b !== id);
      const queue = (s.queue?.length ? s.queue : s.players.map((p) => p.id)).filter((qid) => qid !== id);
      const matchHasPlayer = (m: PendingMatch) => [...m.teamA, ...m.teamB].includes(id);
      const courts = s.courts.map((m) => (m && matchHasPlayer(m) ? null : m));
      return {
        ...s,
        players,
        lockedPairs,
        queue,
        courts,
        upcoming: fillQueue(queue, players, s.history, courts, s.skillBased === true, lockedPairs),
      };
    });
  };

  const setCourtCount = (n: number) =>
    setState((s) => {
      const desired = Math.max(1, Math.min(MAX_COURTS, n));
      const courts = resizeCourts(s.courts, desired);
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      return {
        ...s,
        courtCount: desired,
        courts,
        upcoming: fillQueue(queue, s.players, s.history, courts, s.skillBased === true, s.lockedPairs ?? []),
      };
    });

  const setSkillSeparation = (next: boolean) =>
    setState((s) => ({ ...s, skillSeparation: next }));

  const setSkillBased = (next: boolean) =>
    setState((s) => {
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      return {
        ...s,
        skillBased: next,
        upcoming: fillQueue(queue, s.players, s.history, s.courts, next, s.lockedPairs ?? []),
      };
    });

  const setLockedPair = (playerId: string, partnerId: string | null) =>
    setState((s) => {
      const pairs = (s.lockedPairs ?? []).filter(([a, b]) => a !== playerId && b !== playerId);
      const lockedPairs = partnerId
        ? [...pairs.filter(([a, b]) => a !== partnerId && b !== partnerId), [playerId, partnerId] as [string, string]]
        : pairs;
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      return {
        ...s,
        lockedPairs,
        upcoming: fillQueue(queue, s.players, s.history, s.courts, s.skillBased === true, lockedPairs),
      };
    });

  const changeSkill = (id: string, skill: SkillLevel) => {
    setState((s) => {
      const players = s.players.map((p) => p.id === id ? { ...p, skill } : p);
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
          href="/play"
          className="inline-block rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
        >
          Back to start
        </Link>
      </main>
    );
  }

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-6xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/play" className="flex items-center gap-2 shrink-0 mr-2">
            <Logo size={28} />
            <span className="text-sm font-bold text-foreground hidden sm:block">
              ReZerve
            </span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm text-muted hidden sm:inline">Session</span>
            <span className="font-mono font-semibold text-accent text-sm">
              {normalized}
            </span>
            <span className="text-border hidden sm:inline mx-1">·</span>
            <Link
              href={`/${normalized}/live`}
              className="text-xs text-muted hover:text-accent transition-colors hidden sm:inline"
            >
              Live view →
            </Link>
          </div>
          <div className="shrink-0">
            <EditLock
              isEditor={isEditor}
              onAuthenticate={authenticate}
              onLogout={logout}
            />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl w-full px-4 py-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <PlayerList
              players={state.players}
              lockedPairs={lockedPairs}
              readOnly={readOnly}
              onAdd={addPlayer}
              onRemove={removePlayer}
              onToggleActive={toggleActive}
              onChangeSkill={changeSkill}
              onSetPartner={setLockedPair}
            />
            <CourtConfig
              courtCount={state.courtCount}
              readOnly={readOnly}
              skillSeparation={skillSeparation}
              skillBased={skillBased}
              onChange={setCourtCount}
              onToggleSkillSeparation={setSkillSeparation}
              onToggleSkillBased={setSkillBased}
            />
          </div>

          <div className="space-y-4">
            {!readOnly && (
              <div className="flex rounded-xl border border-border overflow-hidden text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => handleSetResultMode("score")}
                  className={`flex-1 py-2.5 transition-colors ${
                    resultMode === "score"
                      ? "bg-accent text-background"
                      : "text-muted hover:bg-accent/10"
                  }`}
                >
                  Record score
                </button>
                <button
                  type="button"
                  onClick={() => handleSetResultMode("winner")}
                  className={`flex-1 py-2.5 border-l border-border transition-colors ${
                    resultMode === "winner"
                      ? "bg-accent text-background"
                      : "text-muted hover:bg-accent/10"
                  }`}
                >
                  Declare winner
                </button>
              </div>
            )}
            {state.courts.map((match, i) => (
              <CourtSummaryCard
                key={i}
                code={normalized}
                courtIndex={i}
                pending={match}
                players={state.players}
                readOnly={readOnly}
                canGenerate={canGenerateAny && !match}
                resultMode={resultMode}
                onGenerate={() => handleGenerate(i)}
                onDeclareWinner={(winner) => handleDeclareWinner(i, winner)}
              />
            ))}
            <UpcomingMatches
              players={state.players}
              courts={state.courts}
              upcoming={state.upcoming}
            />
          </div>

          <Scoreboard players={state.players} history={state.history} />
        </div>

        {!readOnly && (
          <section className="rounded-xl border border-accent/40 bg-accent/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted font-semibold">
                Danger zone
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                End session
              </p>
              <p className="text-xs text-muted mt-0.5">
                Permanently deletes all players, matches, and history for{" "}
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
    </>
  );
}
