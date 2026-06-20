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
import { advanceQueue } from "@/lib/rotation";
import {
  activeCourtMatches,
  advanceLadder,
  advanceWinnerLoser,
  buildFillQueueContext,
  buildGenerateForCourtContext,
  fillQueue,
  generateForCourt,
  removeFromLadder,
  resetSession,
  resizeCourts,
  transitionToStyle,
} from "@/lib/sessionHelpers";
import {
  CompletedMatch,
  MAX_COURTS,
  MatchingStyle,
  PendingMatch,
  Player,
  ResultMode,
  SkillLevel,
  SkillTier,
  skillTier,
} from "@/lib/types";

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
  const matchingStyle: MatchingStyle = state.matchingStyle ?? "auto-balanced";
  const isSkillCourts = matchingStyle === "skill-courts";
  const isKingOfCourt = matchingStyle === "king-of-court";
  const lockedPairs = state.lockedPairs ?? [];
  const resultMode: ResultMode = state.resultMode ?? "score";

  const handleSetResultMode = (mode: ResultMode) =>
    setState((s) => ({ ...s, resultMode: mode }));

  const activePlayers = state.players.filter((p) => p.active !== false);
  const canGenerateAny = isSkillCourts
    ? activePlayers.filter((p) => skillTier(p.skill) === "casual").length >= 4 ||
      activePlayers.filter((p) => skillTier(p.skill) === "competitive").length >= 4
    : activePlayers.length >= 4;

  const handleGenerate = (courtIndex: number) => {
    let generated = false;
    setState((s) => {
      if (s.courts[courtIndex]) return s;
      const style = s.matchingStyle ?? "auto-balanced";
      const courts = [...s.courts];
      const courtTier = style === "skill-courts" ? (s.courtTiers?.[courtIndex] ?? null) : null;

      let fresh: PendingMatch | null = null;
      let ladderPending = s.ladderPending;
      let ladderQueue = s.ladderQueue;
      let queueOverride: string[] | undefined;
      let compQueueOverride: string[] | undefined;
      let winnerQueueOverride: string[] | undefined;
      let loserQueueOverride: string[] | undefined;

      if (s.upcoming.length > 0 && !courtTier && style !== "king-of-court") {
        fresh = s.upcoming[0];
      } else {
        const result = generateForCourt(buildGenerateForCourtContext(s, courtIndex, activeCourtMatches(courts)));
        fresh = result.match;
        queueOverride = result.queue;
        compQueueOverride = result.competitiveQueue;
        winnerQueueOverride = result.winnerQueue;
        loserQueueOverride = result.loserQueue;
        if (result.ladderPending) ladderPending = result.ladderPending;
        if (result.ladderQueue) ladderQueue = result.ladderQueue;
      }
      if (!fresh) return s;
      courts[courtIndex] = fresh;
      generated = true;

      return {
        ...s,
        courts,
        ...(queueOverride ? { queue: queueOverride } : {}),
        ...(compQueueOverride ? { competitiveQueue: compQueueOverride } : {}),
        ...(winnerQueueOverride ? { winnerQueue: winnerQueueOverride } : {}),
        ...(loserQueueOverride ? { loserQueue: loserQueueOverride } : {}),
        ladderPending,
        ladderQueue,
        upcoming: fillQueue(buildFillQueueContext(s, courts, {
          queue: queueOverride, competitiveQueue: compQueueOverride, winnerQueue: winnerQueueOverride, loserQueue: loserQueueOverride,
        })),
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
      const style = s.matchingStyle ?? "auto-balanced";
      const played = [...m.teamA, ...m.teamB];

      const courts = [...s.courts];
      courts[courtIndex] = null;

      let queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      let compQueue = s.competitiveQueue;
      let casualMatchCount = s.casualMatchCount ?? 0;
      let competitiveMatchCount = s.competitiveMatchCount ?? 0;
      let winnerQueue = s.winnerQueue ?? [];
      let loserQueue = s.loserQueue ?? [];
      let ladderPending = s.ladderPending ?? { promote: {}, relegate: {} };
      let ladderQueue = s.ladderQueue ?? [];

      if (style === "skill-courts") {
        const hasCasual = played.some((id) => {
          const p = s.players.find((pl) => pl.id === id);
          return p ? skillTier(p.skill) === "casual" : false;
        });
        const hasComp = played.some((id) => {
          const p = s.players.find((pl) => pl.id === id);
          return p ? skillTier(p.skill) === "competitive" : false;
        });
        if (hasCasual) { queue = advanceQueue(queue, played); casualMatchCount++; }
        if (hasComp) { compQueue = advanceQueue(compQueue ?? [], played); competitiveMatchCount++; }
      } else if (style === "winner-loser-groups") {
        const result = advanceWinnerLoser(m.teamA, m.teamB, winner, winnerQueue, loserQueue);
        winnerQueue = result.winnerQueue;
        loserQueue = result.loserQueue;
      } else if (style === "king-of-court") {
        const result = advanceLadder(courtIndex, s.courtCount, m.teamA, m.teamB, winner, ladderPending, ladderQueue);
        ladderPending = result.ladderPending;
        ladderQueue = result.ladderQueue;
      } else {
        queue = advanceQueue(queue, played);
      }

      const genResult = generateForCourt(
        buildGenerateForCourtContext(s, courtIndex, activeCourtMatches(courts), {
          queue, competitiveQueue: compQueue, winnerQueue, loserQueue, ladderPending, ladderQueue,
          history, casualMatchCount, competitiveMatchCount,
        })
      );
      if (genResult.match) courts[courtIndex] = genResult.match;
      if (genResult.queue) queue = genResult.queue;
      if (genResult.competitiveQueue) compQueue = genResult.competitiveQueue;
      if (genResult.winnerQueue) winnerQueue = genResult.winnerQueue;
      if (genResult.loserQueue) loserQueue = genResult.loserQueue;
      if (genResult.ladderPending) ladderPending = genResult.ladderPending;
      if (genResult.ladderQueue) ladderQueue = genResult.ladderQueue;

      return {
        ...s,
        history,
        queue,
        competitiveQueue: compQueue,
        casualMatchCount,
        competitiveMatchCount,
        winnerQueue,
        loserQueue,
        ladderPending,
        ladderQueue,
        courts,
        upcoming: fillQueue(buildFillQueueContext(s, courts, {
          queue, competitiveQueue: compQueue, winnerQueue, loserQueue, history, casualMatchCount, competitiveMatchCount,
        })),
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

  const handleResetSession = async () => {
    const ok = await confirm(
      "This clears all courts, the upcoming queue, and match history. Players and settings (matching style, court count, locked partners) are kept. This cannot be undone.",
      { title: "Reset session?", confirmLabel: "Reset" }
    );
    if (!ok) return;
    setState((s) => ({ ...s, ...resetSession(s) }));
    notify(`Session ${normalized} reset`, "success");
  };

  const addPlayer = (name: string, skill: SkillLevel) => {
    const player: Player = { id: crypto.randomUUID(), name, skill, active: true, joinedAt: Date.now() };
    setState((s) => {
      const players = [...s.players, player];
      const style = s.matchingStyle ?? "auto-balanced";
      let queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      let compQueue = s.competitiveQueue;
      let winnerQueue = s.winnerQueue;
      let ladderQueue = s.ladderQueue;

      // New players have 0 games — put them at the front of whichever queue
      // their style uses, so they're prioritized over players who've already
      // had several, rather than appended to the back where they'd be
      // perpetually skipped by the rotation.
      if (style === "skill-courts" && skillTier(skill) === "competitive") {
        compQueue = [player.id, ...(compQueue ?? [])];
      } else if (style === "winner-loser-groups") {
        winnerQueue = [player.id, ...(winnerQueue ?? [])];
      } else if (style === "king-of-court") {
        ladderQueue = [player.id, ...(ladderQueue ?? [])];
      } else {
        queue = [player.id, ...queue];
      }

      return {
        ...s,
        players,
        queue,
        competitiveQueue: compQueue,
        winnerQueue,
        ladderQueue,
        upcoming: fillQueue(buildFillQueueContext(s, s.courts, { queue, competitiveQueue: compQueue, winnerQueue })),
      };
    });
  };

  const toggleActive = (id: string) => {
    setState((s) => {
      const goingInactive = s.players.find((p) => p.id === id)?.active !== false;
      const players = s.players.map((p) =>
        p.id === id ? { ...p, active: p.active === false } : p
      );
      const style = s.matchingStyle ?? "auto-balanced";
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const compQueue = style === "skill-courts" ? (s.competitiveQueue ?? []) : undefined;
      const winnerQueue = s.winnerQueue ?? [];
      const loserQueue = s.loserQueue ?? [];
      const ladderQueue = s.ladderQueue ?? [];
      const lockedPairsNow = s.lockedPairs ?? [];

      if (goingInactive) {
        const courtIdx = s.courts.findIndex(
          (m) => m && (m.teamA.includes(id) || m.teamB.includes(id))
        );

        if (courtIdx !== -1) {
          const lockedMap = new Map<string, string>();
          for (const [a, b] of lockedPairsNow) {
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
          const inactiveTier = inactivePlayer && style === "skill-courts"
            ? skillTier(inactivePlayer.skill)
            : null;

          let subQueue: string[];
          if (style === "skill-courts") {
            subQueue = inactiveTier === "competitive" ? (compQueue ?? []) : queue;
          } else if (style === "winner-loser-groups") {
            subQueue = [...winnerQueue, ...loserQueue];
          } else if (style === "king-of-court") {
            subQueue = ladderQueue;
          } else {
            subQueue = queue;
          }

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
              upcoming: fillQueue(buildFillQueueContext(s, courts, { queue, competitiveQueue: compQueue, winnerQueue, loserQueue })),
            };
          }
        }
      }

      return {
        ...s,
        players,
        upcoming: fillQueue(buildFillQueueContext(s, s.courts, { queue, competitiveQueue: compQueue, winnerQueue, loserQueue })),
      };
    });
  };

  const removePlayer = (id: string) => {
    setState((s) => {
      const players = s.players.filter((p) => p.id !== id);
      const lockedPairsNext = (s.lockedPairs ?? []).filter(([a, b]) => a !== id && b !== id);
      const queue = (s.queue?.length ? s.queue : s.players.map((p) => p.id)).filter((qid) => qid !== id);
      const compQueue = s.competitiveQueue?.filter((qid) => qid !== id);
      const winnerQueue = s.winnerQueue?.filter((qid) => qid !== id);
      const loserQueue = s.loserQueue?.filter((qid) => qid !== id);
      const ladderQueue = s.ladderQueue?.filter((qid) => qid !== id);
      const ladderPending = s.ladderPending ? removeFromLadder(s.ladderPending, id) : undefined;
      const matchHasPlayer = (m: PendingMatch) => [...m.teamA, ...m.teamB].includes(id);
      const courts = s.courts.map((m) => (m && matchHasPlayer(m) ? null : m));
      return {
        ...s,
        players,
        lockedPairs: lockedPairsNext,
        queue,
        competitiveQueue: compQueue,
        winnerQueue,
        loserQueue,
        ladderQueue,
        ladderPending,
        courts,
        upcoming: fillQueue(buildFillQueueContext(s, courts, { queue, competitiveQueue: compQueue, winnerQueue, loserQueue })),
      };
    });
  };

  const setCourtCount = (n: number) =>
    setState((s) => {
      const desired = Math.max(1, Math.min(MAX_COURTS, n));
      const courts = resizeCourts(s.courts, desired);
      const existingTiers = s.courtTiers ?? [];
      const courtTiers = Array.from({ length: desired }, (_, i) => existingTiers[i] ?? null);
      const allNull = courtTiers.every((t) => t === null);
      return {
        ...s,
        courtCount: desired,
        courts,
        courtTiers: allNull ? undefined : courtTiers,
        upcoming: fillQueue(buildFillQueueContext(s, courts)),
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

  const setMatchingStyle = (next: MatchingStyle) =>
    setState((s) => {
      if (next === "mixed-doubles") return s; // coming soon — not selectable
      const merged = { ...s, ...transitionToStyle(s, next) };
      return { ...merged, upcoming: fillQueue(buildFillQueueContext(merged, s.courts)) };
    });

  const setLockedPair = (playerId: string, partnerId: string | null) =>
    setState((s) => {
      const pairs = (s.lockedPairs ?? []).filter(([a, b]) => a !== playerId && b !== playerId);
      const nextLockedPairs = partnerId
        ? [...pairs.filter(([a, b]) => a !== partnerId && b !== partnerId), [playerId, partnerId] as [string, string]]
        : pairs;
      return {
        ...s,
        lockedPairs: nextLockedPairs,
        upcoming: fillQueue({ ...buildFillQueueContext(s, s.courts), lockedPairs: nextLockedPairs }),
      };
    });

  const changeSkill = (id: string, skill: SkillLevel) => {
    setState((s) => {
      const oldPlayer = s.players.find((p) => p.id === id);
      const players = s.players.map((p) => p.id === id ? { ...p, skill } : p);
      const style = s.matchingStyle ?? "auto-balanced";
      let queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      let compQueue = s.competitiveQueue;
      if (style === "skill-courts" && oldPlayer) {
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
        upcoming: fillQueue(buildFillQueueContext(s, s.courts, { queue, competitiveQueue: compQueue })),
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
              matchingStyle={matchingStyle}
              onChange={setCourtCount}
              onSelectStyle={setMatchingStyle}
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
              const cTier = isSkillCourts ? (state.courtTiers?.[i] ?? null) : null;
              const ladderRank = isKingOfCourt ? { rank: i + 1, total: state.courtCount } : undefined;
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
                  skillSeparation={isSkillCourts}
                  courtTier={cTier}
                  onSetTier={!readOnly ? (tier) => setCourtTier(i, tier) : undefined}
                  ladderRank={ladderRank}
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
          <section className="rounded-xl border border-border bg-background/60 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Reset session
              </p>
              <p className="text-xs text-muted mt-0.5">
                Clears courts, the upcoming queue, and match history. Keeps players and
                settings (matching style, court count, locked partners).
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetSession}
              className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
            >
              Reset
            </button>
          </section>
        )}

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
