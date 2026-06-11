"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { CurrentMatch, MatchResult } from "@/components/CurrentMatch";
import { EditLock } from "@/components/EditLock";
import { useNotifications } from "@/components/Notifications";
import { useSharedState } from "@/lib/sharedState";
import { generateMatch, advanceQueue } from "@/lib/rotation";
import { activeCourtMatches, fillQueue } from "@/lib/sessionHelpers";
import {
  CompletedMatch,
  PendingMatch,
  ServerNumber,
  ServingTeam,
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
  const canGenerate =
    state.players.filter((p) => p.active !== false).length >= 4 && !match;

  const handleGenerate = () => {
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
          queue,
          s.players,
          s.history,
          activeCourtMatches(courts),
          [],
          s.skillBased === true,
          s.lockedPairs ?? []
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
      recorded = true;
      return {
        ...s,
        history,
        queue,
        courts,
        upcoming: fillQueue(queue, s.players, history, courts, s.skillBased === true, s.lockedPairs ?? []),
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
      const courts = [...s.courts];
      courts[courtIndex] = null;
      return {
        ...s,
        courts,
        upcoming: fillQueue(queue, s.players, s.history, courts, s.skillBased === true, s.lockedPairs ?? []),
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
