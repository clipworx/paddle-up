"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { CurrentMatch, MatchResult } from "@/components/CurrentMatch";
import { EditLock } from "@/components/EditLock";
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
} from "@/lib/sessionHelpers";
import {
  CompletedMatch,
  PendingMatch,
  ServerNumber,
  ServingTeam,
  skillTier,
} from "@/lib/types";

export default function CourtScoringPage({
  params,
}: {
  params: Promise<{ code: string; n: string }>;
}) {
  const { code, n } = use(params);
  const normalized = code.toUpperCase();
  const courtIndex = Math.max(0, parseInt(n, 10) - 1);
  const {
    state,
    setState,
    hydrated,
    exists,
    isEditor,
    authenticate,
    logout,
    lastError,
  } = useSharedState(normalized);
  const readOnly = !isEditor;
  const { notify } = useNotifications();

  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastError && lastError !== lastErrorRef.current && lastError !== "read_only") {
      notify(`Save failed: ${lastError}`, "error");
    }
    lastErrorRef.current = lastError;
  }, [lastError, notify]);

  const match = state.courts[courtIndex] ?? null;
  const resultMode = state.resultMode ?? "score";
  const matchingStyle = state.matchingStyle ?? "auto-balanced";

  const handleSetResultMode = (mode: import("@/lib/types").ResultMode) => {
    setState((s) => ({ ...s, resultMode: mode }));
  };

  const skillMode = state.skillBased === true;
  const activePlayers = state.players.filter((p) => p.active !== false);
  const canGenerate = !match && (
    matchingStyle === "skill-courts"
      ? activePlayers.filter((p) => skillTier(p.skill) === "casual").length >= 4 ||
        activePlayers.filter((p) => skillTier(p.skill) === "competitive").length >= 4
      : activePlayers.length >= 4
  );

  const handleGenerate = () => {
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

  const handleRecord = (result: MatchResult) => {
    let recorded = false;
    setState((s) => {
      const m = s.courts[courtIndex];
      if (!m) return s;
      const completed: CompletedMatch = {
        ...m,
        scoreA: result.scoreA,
        scoreB: result.scoreB,
        winner: result.winner,
        completedAt: Date.now(),
      };
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
        const winLoss = advanceWinnerLoser(m.teamA, m.teamB, result.winner, winnerQueue, loserQueue);
        winnerQueue = winLoss.winnerQueue;
        loserQueue = winLoss.loserQueue;
      } else if (style === "king-of-court") {
        const ladder = advanceLadder(courtIndex, s.courtCount, m.teamA, m.teamB, result.winner, ladderPending, ladderQueue);
        ladderPending = ladder.ladderPending;
        ladderQueue = ladder.ladderQueue;
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

      recorded = true;
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
    if (recorded) {
      const label =
        result.winner === "tie"
          ? "Tie game"
          : result.winner === "A"
          ? "Team A wins"
          : "Team B wins";
      const score =
        result.scoreA !== undefined && result.scoreB !== undefined
          ? ` ${result.scoreA}-${result.scoreB}`
          : "";
      notify(`Court ${courtIndex + 1}: ${label}${score}`, "success");
    }
  };

  const handleCancel = () => {
    setState((s) => {
      const courts = [...s.courts];
      courts[courtIndex] = null;
      return {
        ...s,
        courts,
        upcoming: fillQueue(buildFillQueueContext(s, courts)),
      };
    });
    notify(`Court ${courtIndex + 1} cleared`, "warning");
  };

  const handleSetServer = (team: ServingTeam, number: ServerNumber) => {
    setState((s) => {
      const m = s.courts[courtIndex];
      if (!m) return s;
      const courts = [...s.courts];
      courts[courtIndex] = { ...m, serving: team, serverNumber: number };
      return { ...s, courts };
    });
  };

  const handleBumpScore = (team: ServingTeam, delta: number) => {
    setState((s) => {
      const m: PendingMatch | null = s.courts[courtIndex];
      if (!m) return s;
      const a = m.liveScoreA ?? 0;
      const b = m.liveScoreB ?? 0;
      const nextA = team === "A" ? Math.max(0, a + delta) : a;
      const nextB = team === "B" ? Math.max(0, b + delta) : b;
      if (nextA === a && nextB === b) return s;
      const courts = [...s.courts];
      courts[courtIndex] = { ...m, liveScoreA: nextA, liveScoreB: nextB };
      return { ...s, courts };
    });
  };

  if (hydrated && !exists) {
    return (
      <main className="mx-auto max-w-xl w-full px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Session not found</h1>
        <Link
          href="/play"
          className="inline-block rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
        >
          Back to start
        </Link>
      </main>
    );
  }

  if (hydrated && courtIndex >= state.courts.length) {
    return (
      <main className="mx-auto max-w-xl w-full px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">
          Court {courtIndex + 1} not found
        </h1>
        <p className="text-sm text-muted">
          This session only has {state.courts.length} court
          {state.courts.length === 1 ? "" : "s"}.
        </p>
        <Link
          href={`/${normalized}`}
          className="inline-block rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
        >
          Back to session
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-6 sm:py-8 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/${normalized}`}
            className="text-xs text-muted hover:text-accent transition-colors"
          >
            ← {normalized}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
            Court {courtIndex + 1}
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Session{" "}
            <span className="font-mono font-semibold text-accent">
              {normalized}
            </span>
          </p>
        </div>
        <div className="shrink-0">
          <EditLock
            isEditor={isEditor}
            onAuthenticate={authenticate}
            onLogout={logout}
          />
        </div>
      </header>

      <CurrentMatch
        players={state.players}
        pending={match}
        canGenerate={canGenerate}
        skillMode={skillMode}
        readOnly={readOnly}
        onGenerate={handleGenerate}
        onRecord={handleRecord}
        onCancel={handleCancel}
        onSetServer={handleSetServer}
        onBumpScore={handleBumpScore}
        resultMode={resultMode}
        onSetResultMode={handleSetResultMode}
      />
    </main>
  );
}
