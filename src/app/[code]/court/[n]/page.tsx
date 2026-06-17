"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { CurrentMatch, MatchResult } from "@/components/CurrentMatch";
import { EditLock } from "@/components/EditLock";
import { useNotifications } from "@/components/Notifications";
import { useSharedState } from "@/lib/sharedState";
import { generateMatch, advanceQueue } from "@/lib/rotation";
import { activeCourtMatches, fillQueue, pickNextTier } from "@/lib/sessionHelpers";
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

  const handleSetResultMode = (mode: import("@/lib/types").ResultMode) => {
    setState((s) => ({ ...s, resultMode: mode }));
  };

  const skillMode = state.skillBased === true;
  const activePlayers = state.players.filter((p) => p.active !== false);
  const canGenerate = !match && (
    state.skillSeparation
      ? activePlayers.filter((p) => skillTier(p.skill) === "casual").length >= 4 ||
        activePlayers.filter((p) => skillTier(p.skill) === "competitive").length >= 4
      : activePlayers.length >= 4
  );

  const handleGenerate = () => {
    let generated = false;
    setState((s) => {
      if (s.courts[courtIndex]) return s;
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const compQueue = s.skillSeparation ? (s.competitiveQueue ?? []) : undefined;
      const courts = [...s.courts];
      const courtTier = s.skillSeparation ? (s.courtTiers?.[courtIndex] ?? null) : null;

      if (courtTier) {
        // Pass s.players so cross-tier locked partners are visible to pickNextFour
        const activeCourts = activeCourtMatches(courts);
        const tierQueue = courtTier === "casual" ? queue : (compQueue ?? []);
        const fresh = generateMatch(tierQueue, s.players, s.history, activeCourts, [], s.skillBased === true, s.lockedPairs ?? []);
        if (!fresh) return s;
        courts[courtIndex] = fresh;
      } else if (s.upcoming.length > 0) {
        courts[courtIndex] = s.upcoming[0];
      } else if (s.skillSeparation) {
        const activeCourts = activeCourtMatches(courts);
        const casualPlayers = s.players.filter((p) => skillTier(p.skill) === "casual");
        const compPlayers = s.players.filter((p) => skillTier(p.skill) === "competitive");
        const next = pickNextTier(casualPlayers, compPlayers, s.casualMatchCount ?? 0, s.competitiveMatchCount ?? 0);
        const tryOrder: ("casual" | "competitive")[] = [next, next === "casual" ? "competitive" : "casual"];
        let fresh: PendingMatch | null = null;
        for (const tier of tryOrder) {
          const tq = tier === "casual" ? queue : (compQueue ?? []);
          const fillQ = tier === "casual" ? (compQueue ?? []) : queue;
          // Pass s.players so cross-tier locked partners are visible to pickNextFour
          fresh =
            generateMatch(tq, s.players, s.history, activeCourts, [], s.skillBased === true, s.lockedPairs ?? []) ??
            generateMatch([...tq, ...fillQ], s.players, s.history, activeCourts, [], s.skillBased === true, s.lockedPairs ?? []);
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
        upcoming: fillQueue(queue, s.players, s.history, courts, s.skillBased === true, s.lockedPairs ?? [], compQueue, s.casualMatchCount ?? 0, s.competitiveMatchCount ?? 0),
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
      let queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      let compQueue = s.competitiveQueue;
      let queuePhase: "append" | "interleave" = s.queuePhase ?? "append";
      let compQueuePhase: "append" | "interleave" = s.competitiveQueuePhase ?? "append";
      let casualMatchCount = s.casualMatchCount ?? 0;
      let competitiveMatchCount = s.competitiveMatchCount ?? 0;
      const played = [...m.teamA, ...m.teamB];
      if (s.skillSeparation) {
        const hasCasual = played.some((id) => {
          const p = s.players.find((pl) => pl.id === id);
          return p ? skillTier(p.skill) === "casual" : false;
        });
        const hasComp = played.some((id) => {
          const p = s.players.find((pl) => pl.id === id);
          return p ? skillTier(p.skill) === "competitive" : false;
        });
        if (hasCasual) {
          queue = advanceQueue(queue, played, queuePhase);
          queuePhase = queuePhase === "append" ? "interleave" : "append";
          casualMatchCount++;
        }
        if (hasComp && compQueue) {
          compQueue = advanceQueue(compQueue, played, compQueuePhase);
          compQueuePhase = compQueuePhase === "append" ? "interleave" : "append";
          competitiveMatchCount++;
        }
      } else {
        queue = advanceQueue(queue, played, queuePhase);
        queuePhase = queuePhase === "append" ? "interleave" : "append";
      }
      const courtTier = s.skillSeparation ? (s.courtTiers?.[courtIndex] ?? null) : null;
      const courts = [...s.courts];
      courts[courtIndex] = null;

      if (courtTier) {
        // Pass s.players so cross-tier locked partners are visible to pickNextFour
        const activeCourtsNow = activeCourtMatches(courts);
        const tierQueue = courtTier === "casual" ? queue : (compQueue ?? []);
        const nextMatch = generateMatch(tierQueue, s.players, history, activeCourtsNow, [], s.skillBased === true, s.lockedPairs ?? []);
        if (nextMatch) courts[courtIndex] = nextMatch;
      } else if (s.upcoming.length > 0) {
        courts[courtIndex] = s.upcoming[0];
      }

      recorded = true;
      return {
        ...s,
        history,
        queue,
        queuePhase,
        competitiveQueue: compQueue,
        competitiveQueuePhase: compQueuePhase,
        casualMatchCount,
        competitiveMatchCount,
        courts,
        upcoming: fillQueue(queue, s.players, history, courts, s.skillBased === true, s.lockedPairs ?? [], s.skillSeparation ? compQueue : undefined, casualMatchCount, competitiveMatchCount),
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
      const queue = s.queue?.length ? s.queue : s.players.map((p) => p.id);
      const compQueue = s.skillSeparation ? (s.competitiveQueue ?? []) : undefined;
      const courts = [...s.courts];
      courts[courtIndex] = null;
      return {
        ...s,
        courts,
        upcoming: fillQueue(queue, s.players, s.history, courts, s.skillBased === true, s.lockedPairs ?? [], compQueue, s.casualMatchCount ?? 0, s.competitiveMatchCount ?? 0),
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
