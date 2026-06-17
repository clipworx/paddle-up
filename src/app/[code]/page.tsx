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
import { CompletedMatch, MAX_COURTS, PendingMatch, Player, ResultMode, SkillLevel, SkillTier, skillTier } from "@/lib/types";

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

  const activePlayers = state.players.filter((p) => p.active !== false);
  const canGenerateAny = skillSeparation
    ? activePlayers.filter((p) => skillTier(p.skill) === "casual").length >= 4 ||
      activePlayers.filter((p) => skillTier(p.skill) === "competitive").length >= 4
    : activePlayers.length >= 4;

  const handleGenerate = (courtIndex: number) => {
    let generated = false;
    setState((s) => {
      if (s.courts[courtIndex]) return s;
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const compQueue = s.skillSeparation ? (s.competitiveQueue ?? []) : undefined;
      const courts = [...s.courts];
      const courtTier = s.skillSeparation ? (s.courtTiers?.[courtIndex] ?? null) : null;

      if (courtTier) {
        // Court has an explicit tier assignment — always generate fresh from that tier
        const activeCourts = activeCourtMatches(courts);
        const tierPlayers = s.players.filter((p) => skillTier(p.skill) === courtTier);
        const tierQueue = courtTier === "casual" ? queue : (compQueue ?? []);
        const fresh = generateMatch(tierQueue, tierPlayers, s.history, activeCourts, [], s.skillBased === true, s.lockedPairs ?? []);
        if (!fresh) return s;
        courts[courtIndex] = fresh;
      } else if (s.upcoming.length > 0) {
        courts[courtIndex] = s.upcoming[0];
      } else if (s.skillSeparation) {
        const activeCourts = activeCourtMatches(courts);
        const casualPlayers = s.players.filter((p) => skillTier(p.skill) === "casual");
        const compPlayers = s.players.filter((p) => skillTier(p.skill) === "competitive");
        // Single court: alternate based on last completed match
        let tryOrder: ("casual" | "competitive")[] = ["casual", "competitive"];
        if (s.courts.length === 1 && s.history.length > 0) {
          const last = s.history[s.history.length - 1];
          const lp = s.players.find((p) => p.id === last.teamA[0]);
          const lastTier = lp ? skillTier(lp.skill) : "casual";
          tryOrder = lastTier === "casual" ? ["competitive", "casual"] : ["casual", "competitive"];
        }
        let fresh: PendingMatch | null = null;
        for (const tier of tryOrder) {
          const tq = tier === "casual" ? queue : (compQueue ?? []);
          const tp = tier === "casual" ? casualPlayers : compPlayers;
          fresh = generateMatch(tq, tp, s.history, activeCourts, [], s.skillBased === true, s.lockedPairs ?? []);
          if (fresh) break;
        }
        if (!fresh) return s;
        courts[courtIndex] = fresh;
      } else {
        const fresh = generateMatch(queue, s.players, s.history, activeCourtMatches(courts), [], s.skillBased === true, s.lockedPairs ?? []);
        if (!fresh) return s;
        courts[courtIndex] = fresh;
      }
      generated = true;
      return {
        ...s,
        courts,
        upcoming: fillQueue(queue, s.players, s.history, courts, s.skillBased === true, s.lockedPairs ?? [], compQueue),
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
      let queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      let compQueue = s.competitiveQueue;
      let queuePhase: "append" | "interleave" = s.queuePhase ?? "append";
      let compQueuePhase: "append" | "interleave" = s.competitiveQueuePhase ?? "append";
      if (s.skillSeparation && compQueue) {
        const firstPlayer = s.players.find((p) => p.id === m.teamA[0]);
        if (firstPlayer && skillTier(firstPlayer.skill) === "competitive") {
          compQueue = advanceQueue(compQueue, [...m.teamA, ...m.teamB], compQueuePhase);
          compQueuePhase = compQueuePhase === "append" ? "interleave" : "append";
        } else {
          queue = advanceQueue(queue, [...m.teamA, ...m.teamB], queuePhase);
          queuePhase = queuePhase === "append" ? "interleave" : "append";
        }
      } else {
        queue = advanceQueue(queue, [...m.teamA, ...m.teamB], queuePhase);
        queuePhase = queuePhase === "append" ? "interleave" : "append";
      }
      const courtTier = s.skillSeparation ? (s.courtTiers?.[courtIndex] ?? null) : null;
      const courts = [...s.courts];
      courts[courtIndex] = null;

      if (courtTier) {
        // Tier-assigned court: generate next match immediately from that tier
        const activeCourtsNow = activeCourtMatches(courts);
        const tierPlayers = s.players.filter((p) => skillTier(p.skill) === courtTier);
        const tierQueue = courtTier === "casual" ? queue : (compQueue ?? []);
        const nextMatch = generateMatch(tierQueue, tierPlayers, history, activeCourtsNow, [], s.skillBased === true, s.lockedPairs ?? []);
        if (nextMatch) courts[courtIndex] = nextMatch;
      } else if (s.upcoming.length > 0) {
        courts[courtIndex] = s.upcoming[0];
      }

      return {
        ...s,
        history,
        queue,
        queuePhase,
        competitiveQueue: compQueue,
        competitiveQueuePhase: compQueuePhase,
        courts,
        upcoming: fillQueue(queue, s.players, history, courts, s.skillBased === true, s.lockedPairs ?? [], s.skillSeparation ? compQueue : undefined),
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
    setState((s) => {
      const players = [...s.players, player];
      let queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      let compQueue = s.competitiveQueue;
      if (s.skillSeparation && skillTier(skill) === "competitive") {
        compQueue = [...(compQueue ?? []), player.id];
      } else {
        queue = [...queue, player.id];
      }
      return {
        ...s,
        players,
        queue,
        competitiveQueue: compQueue,
        upcoming: fillQueue(queue, players, s.history, s.courts, s.skillBased === true, s.lockedPairs ?? [], s.skillSeparation ? compQueue : undefined),
      };
    });
  };

  const toggleActive = (id: string) => {
    setState((s) => {
      const goingInactive = s.players.find((p) => p.id === id)?.active !== false;
      const players = s.players.map((p) =>
        p.id === id ? { ...p, active: p.active === false } : p
      );
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const compQueue = s.skillSeparation ? (s.competitiveQueue ?? []) : undefined;
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

          const inactivePlayer = s.players.find((p) => p.id === id);
          const inactiveTier = inactivePlayer && s.skillSeparation
            ? skillTier(inactivePlayer.skill)
            : null;
          const subQueue = inactiveTier === "competitive" && compQueue ? compQueue : queue;

          const substitute = subQueue.find((qid) => {
            if (qid === id) return false;
            if (onAnyCourt.has(qid)) return false;
            const p = players.find((pl) => pl.id === qid);
            if (!p || p.active === false) return false;
            if (lockedMap.has(qid)) return false;
            if (inactiveTier && skillTier(p.skill) !== inactiveTier) return false;
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
              upcoming: fillQueue(queue, players, s.history, courts, s.skillBased === true, lockedPairs, compQueue),
            };
          }
        }
      }

      return {
        ...s,
        players,
        upcoming: fillQueue(queue, players, s.history, s.courts, s.skillBased === true, lockedPairs, compQueue),
      };
    });
  };

  const removePlayer = (id: string) => {
    setState((s) => {
      const players = s.players.filter((p) => p.id !== id);
      const lockedPairs = (s.lockedPairs ?? []).filter(([a, b]) => a !== id && b !== id);
      const queue = (s.queue?.length ? s.queue : s.players.map((p) => p.id)).filter((qid) => qid !== id);
      const compQueue = s.skillSeparation ? (s.competitiveQueue ?? []).filter((qid) => qid !== id) : undefined;
      const matchHasPlayer = (m: PendingMatch) => [...m.teamA, ...m.teamB].includes(id);
      const courts = s.courts.map((m) => (m && matchHasPlayer(m) ? null : m));
      return {
        ...s,
        players,
        lockedPairs,
        queue,
        competitiveQueue: compQueue,
        courts,
        upcoming: fillQueue(queue, players, s.history, courts, s.skillBased === true, lockedPairs, compQueue),
      };
    });
  };

  const setCourtCount = (n: number) =>
    setState((s) => {
      const desired = Math.max(1, Math.min(MAX_COURTS, n));
      const courts = resizeCourts(s.courts, desired);
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const compQueue = s.skillSeparation ? (s.competitiveQueue ?? []) : undefined;
      const existingTiers = s.courtTiers ?? [];
      const courtTiers = Array.from({ length: desired }, (_, i) => existingTiers[i] ?? null);
      const allNull = courtTiers.every((t) => t === null);
      return {
        ...s,
        courtCount: desired,
        courts,
        courtTiers: allNull ? undefined : courtTiers,
        upcoming: fillQueue(queue, s.players, s.history, courts, s.skillBased === true, s.lockedPairs ?? [], compQueue),
      };
    });

  const setCourtTier = (courtIndex: number, tier: SkillTier | null) =>
    setState((s) => {
      const existingTiers = s.courtTiers ?? Array.from({ length: s.courts.length }, () => null as SkillTier | null);
      const courtTiers = existingTiers.map((t, i) => (i === courtIndex ? tier : t));
      const allNull = courtTiers.every((t) => t === null);
      return {
        ...s,
        courtTiers: allNull ? undefined : courtTiers,
      };
    });

  const setSkillSeparation = (next: boolean) =>
    setState((s) => {
      const currentQueue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      if (next) {
        // Split single queue into casual + competitive, preserving existing order within each tier
        const queue = currentQueue.filter((id) => {
          const p = s.players.find((pl) => pl.id === id);
          return p ? skillTier(p.skill) === "casual" : true;
        });
        const compQueue = currentQueue.filter((id) => {
          const p = s.players.find((pl) => pl.id === id);
          return p ? skillTier(p.skill) === "competitive" : false;
        });
        return {
          ...s,
          skillSeparation: true,
          queue,
          queuePhase: "append",
          competitiveQueue: compQueue,
          competitiveQueuePhase: "append",
          upcoming: fillQueue(queue, s.players, s.history, s.courts, s.skillBased === true, s.lockedPairs ?? [], compQueue),
        };
      } else {
        // Merge queues by interleaving: casual[0], comp[0], casual[1], comp[1], …
        const comp = s.competitiveQueue ?? [];
        const merged: string[] = [];
        const maxLen = Math.max(currentQueue.length, comp.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < currentQueue.length) merged.push(currentQueue[i]);
          if (i < comp.length) merged.push(comp[i]);
        }
        return {
          ...s,
          skillSeparation: false,
          queue: merged,
          queuePhase: "append",
          competitiveQueue: undefined,
          competitiveQueuePhase: undefined,
          upcoming: fillQueue(merged, s.players, s.history, s.courts, s.skillBased === true, s.lockedPairs ?? []),
        };
      }
    });

  const setSkillBased = (next: boolean) =>
    setState((s) => {
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const compQueue = s.skillSeparation ? (s.competitiveQueue ?? []) : undefined;
      return {
        ...s,
        skillBased: next,
        upcoming: fillQueue(queue, s.players, s.history, s.courts, next, s.lockedPairs ?? [], compQueue),
      };
    });

  const setLockedPair = (playerId: string, partnerId: string | null) =>
    setState((s) => {
      const pairs = (s.lockedPairs ?? []).filter(([a, b]) => a !== playerId && b !== playerId);
      const lockedPairs = partnerId
        ? [...pairs.filter(([a, b]) => a !== partnerId && b !== partnerId), [playerId, partnerId] as [string, string]]
        : pairs;
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const compQueue = s.skillSeparation ? (s.competitiveQueue ?? []) : undefined;
      return {
        ...s,
        lockedPairs,
        upcoming: fillQueue(queue, s.players, s.history, s.courts, s.skillBased === true, lockedPairs, compQueue),
      };
    });

  const changeSkill = (id: string, skill: SkillLevel) => {
    setState((s) => {
      const oldPlayer = s.players.find((p) => p.id === id);
      const players = s.players.map((p) => p.id === id ? { ...p, skill } : p);
      let queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      let compQueue = s.competitiveQueue;
      if (s.skillSeparation && oldPlayer) {
        const oldTier = skillTier(oldPlayer.skill);
        const newTier = skillTier(skill);
        if (oldTier !== newTier) {
          if (newTier === "competitive") {
            queue = queue.filter((qid) => qid !== id);
            compQueue = [...(compQueue ?? []), id];
          } else {
            compQueue = compQueue?.filter((qid) => qid !== id);
            queue = [...queue, id];
          }
        }
      }
      return {
        ...s,
        players,
        queue,
        competitiveQueue: compQueue,
        upcoming: fillQueue(queue, players, s.history, s.courts, s.skillBased === true, s.lockedPairs ?? [], s.skillSeparation ? compQueue : undefined),
      };
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
            {state.courts.map((match, i) => {
              const cTier = skillSeparation && state.courtCount > 1
                ? (state.courtTiers?.[i] ?? null)
                : null;
              const canGen = !match && (
                cTier === "casual"
                  ? activePlayers.filter((p) => skillTier(p.skill) === "casual").length >= 4
                  : cTier === "competitive"
                  ? activePlayers.filter((p) => skillTier(p.skill) === "competitive").length >= 4
                  : canGenerateAny
              );
              return (
                <CourtSummaryCard
                  key={i}
                  code={normalized}
                  courtIndex={i}
                  pending={match}
                  players={state.players}
                  readOnly={readOnly}
                  canGenerate={canGen}
                  resultMode={resultMode}
                  onGenerate={() => handleGenerate(i)}
                  onDeclareWinner={(winner) => handleDeclareWinner(i, winner)}
                  skillSeparation={skillSeparation && state.courtCount > 1}
                  courtTier={cTier}
                  onSetTier={!readOnly ? (tier) => setCourtTier(i, tier) : undefined}
                />
              );
            })}
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
