"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "@/components/Notifications";
import { PendingMatch, Player, ResultMode, ServerNumber, ServingTeam } from "@/lib/types";

export type MatchResult = {
  scoreA?: number;
  scoreB?: number;
  winner: "A" | "B" | "tie";
};

type Props = {
  players: Player[];
  pending: PendingMatch | null;
  canGenerate: boolean;
  skillMode: boolean;
  readOnly?: boolean;
  onGenerate: () => void;
  onRecord: (result: MatchResult) => void;
  onCancel: () => void;
  onSetServer: (team: ServingTeam, number: ServerNumber) => void;
  onBumpScore: (team: ServingTeam, delta: number) => void;
  resultMode: ResultMode;
  onSetResultMode: (mode: ResultMode) => void;
};

function nameOf(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "?";
}

function TeamScore({
  label,
  names,
  score,
  serving,
  serverNumber,
  readOnly,
  onInc,
  onDec,
  onSetServer,
}: {
  label: string;
  names: [string, string];
  score: number;
  serving: boolean;
  serverNumber: ServerNumber;
  readOnly?: boolean;
  onInc: () => void;
  onDec: () => void;
  onSetServer: (number: ServerNumber) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-2 sm:p-3 flex flex-col min-w-0 transition-colors ${
        serving
          ? "border-accent bg-accent/10"
          : "border-border bg-background"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between mb-1 gap-1">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        {serving ? (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
              ● {serverNumber === 2 ? "2nd" : "1st"}
            </span>
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={() => onSetServer(1)}
                  disabled={serverNumber === 2}
                  aria-pressed={serverNumber === 1}
                  className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    serverNumber === 1
                      ? "bg-accent text-background border-accent"
                      : "border-accent/40 text-accent hover:bg-accent/10"
                  }`}
                >
                  1st
                </button>
                <button
                  type="button"
                  onClick={() => onSetServer(2)}
                  aria-pressed={serverNumber === 2}
                  className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border transition-colors ${
                    serverNumber === 2
                      ? "bg-accent text-background border-accent"
                      : "border-accent/40 text-accent hover:bg-accent/10"
                  }`}
                >
                  2nd
                </button>
              </>
            )}
          </div>
        ) : (
          !readOnly && (
            <button
              type="button"
              onClick={() => onSetServer(1)}
              className="text-[10px] uppercase tracking-wide text-muted hover:text-accent underline"
            >
              Set server
            </button>
          )
        )}
      </div>
      <p className="text-sm font-medium text-foreground truncate">{names[0]}</p>
      <p className="text-sm font-medium text-foreground truncate">{names[1]}</p>
      <p className="mt-2 sm:mt-3 text-center text-4xl sm:text-5xl font-bold text-foreground tabular-nums">
        {score}
      </p>
      {!readOnly && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onDec}
            aria-label={`Decrease ${label} score`}
            className="flex-1 rounded border border-border text-foreground py-1 text-lg font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
          >
            −
          </button>
          <button
            type="button"
            onClick={onInc}
            aria-label={`Increase ${label} score`}
            className="flex-1 rounded border border-border text-foreground py-1 text-lg font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

export function CurrentMatch({
  players,
  pending,
  canGenerate,
  skillMode,
  onGenerate,
  onRecord,
  onCancel,
  onSetServer,
  onBumpScore,
  readOnly,
  resultMode,
  onSetResultMode,
}: Props) {
  const scoreA = pending?.liveScoreA ?? 0;
  const scoreB = pending?.liveScoreB ?? 0;
  const serving: ServingTeam = pending?.serving ?? "A";
  const serverNumber: ServerNumber = pending?.serverNumber ?? 1;
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const { confirm } = useNotifications();

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const preferred = [
      "Samantha", "Ava", "Allison", "Serena", "Karen", "Moira", "Tessa",
      "Fiona", "Daniel", "Google UK English Female", "Google US English",
      "Microsoft Aria", "Microsoft Jenny",
    ];
    const scoreVoice = (v: SpeechSynthesisVoice) => {
      const name = v.name.toLowerCase();
      let score = 0;
      if (name.includes("natural")) score += 200;
      if (name.includes("neural")) score += 150;
      if (name.includes("premium") || name.includes("enhanced")) score += 120;
      const idx = preferred.findIndex((p) => v.name === p || v.name.includes(p));
      if (idx >= 0) score += 100 - idx;
      if (v.default) score -= 10;
      return score;
    };
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
      const pool = en.length > 0 ? en : voices;
      pool.sort((a, b) => scoreVoice(b) - scoreVoice(a));
      voiceRef.current = pool[0] ?? null;
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, []);

  const submitScore = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (scoreA < 0 || scoreB < 0 || scoreA === scoreB) return;
    const winner = scoreA > scoreB ? "Team A" : "Team B";
    const ok = await confirm(
      `Record final score ${scoreA} – ${scoreB}?\n${winner} wins. This cannot be undone.`,
      { title: "Record result", confirmLabel: "Record result" }
    );
    if (!ok) return;
    onRecord({ scoreA, scoreB, winner: scoreA > scoreB ? "A" : "B" });
  };

  const declareWinner = async (winner: "A" | "B" | "tie") => {
    const nameA = pending ? `${nameOf(players, pending.teamA[0])} & ${nameOf(players, pending.teamA[1])}` : "Team A";
    const nameB = pending ? `${nameOf(players, pending.teamB[0])} & ${nameOf(players, pending.teamB[1])}` : "Team B";
    const label = winner === "tie" ? "Tie game" : winner === "A" ? `${nameA} wins` : `${nameB} wins`;
    const ok = await confirm(`${label}. This cannot be undone.`, {
      title: "Declare result",
      confirmLabel: "Confirm",
    });
    if (!ok) return;
    onRecord({ winner });
  };

  const bump = (team: ServingTeam, delta: number) => onBumpScore(team, delta);

  const servingScore = serving === "A" ? scoreA : scoreB;
  const receivingScore = serving === "A" ? scoreB : scoreA;
  const call = `${servingScore} – ${receivingScore} – ${serverNumber}`;

  const buildUtter = (text: string, opts: { rate?: number; pitch?: number; volume?: number } = {}) => {
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) { utter.voice = voiceRef.current; utter.lang = voiceRef.current.lang; }
    utter.rate = opts.rate ?? 0.95;
    utter.pitch = opts.pitch ?? 1.05;
    utter.volume = opts.volume ?? 1;
    return utter;
  };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(buildUtter(text));
  };

  const speakSequence = (parts: { text: string; rate?: number; pitch?: number; volume?: number }[]) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    for (const p of parts) window.speechSynthesis.speak(buildUtter(p.text, p));
  };

  const announce = () => speak(`${servingScore}, ${receivingScore}, ${serverNumber}`);

  const announcePlayers = () => {
    if (!pending) return;
    const a1 = nameOf(players, pending.teamA[0]);
    const a2 = nameOf(players, pending.teamA[1]);
    const b1 = nameOf(players, pending.teamB[0]);
    const b2 = nameOf(players, pending.teamB[1]);
    speakSequence([
      { text: `${a1} and ${a2},` },
      { text: " " },
      { text: "VERSUS!", rate: 0.7, pitch: 0.8 },
      { text: " " },
      { text: `${b1} and ${b2}.` },
    ]);
  };

  return (
    <section className="rounded-lg border border-border bg-background/60 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        {skillMode && (
          <span className="text-xs rounded-full bg-accent/20 text-accent font-semibold px-2 py-1">
            skill-matched
          </span>
        )}
      </div>

      {!pending ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted mb-3">
            {readOnly
              ? "Waiting for host to start a match."
              : canGenerate
              ? "Ready to start a match."
              : "Add at least 4 players."}
          </p>
          {!readOnly && (
            <button
              type="button"
              disabled={!canGenerate}
              onClick={onGenerate}
              className="rounded-lg bg-accent text-background px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-accent"
            >
              Generate Match
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-stretch min-w-0">
            <TeamScore
              label="Team A"
              names={[nameOf(players, pending.teamA[0]), nameOf(players, pending.teamA[1])]}
              score={scoreA}
              serving={serving === "A"}
              serverNumber={serverNumber}
              readOnly={readOnly}
              onInc={() => bump("A", 1)}
              onDec={() => bump("A", -1)}
              onSetServer={(n) => onSetServer("A", n)}
            />
            <span className="self-center text-center text-muted text-sm font-semibold">vs</span>
            <TeamScore
              label="Team B"
              names={[nameOf(players, pending.teamB[0]), nameOf(players, pending.teamB[1])]}
              score={scoreB}
              serving={serving === "B"}
              serverNumber={serverNumber}
              readOnly={readOnly}
              onInc={() => bump("B", 1)}
              onDec={() => bump("B", -1)}
              onSetServer={(n) => onSetServer("B", n)}
            />
          </div>

          <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Announcer</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">{call}</p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={announce}
                  className="w-full sm:w-auto rounded-lg border border-accent bg-accent text-background px-3 py-2 text-sm font-semibold hover:bg-muted hover:border-muted transition-colors"
                >
                  Announce Score
                </button>
              )}
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={announcePlayers}
                className="w-full rounded-lg border border-accent/60 text-accent px-3 py-2 text-sm font-semibold hover:bg-accent/10 transition-colors"
              >
                Announce Players
              </button>
            )}
          </div>

          {!readOnly && (
            <div className="space-y-3">
              {/* Mode toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => onSetResultMode("score")}
                  className={`flex-1 py-2 transition-colors ${
                    resultMode === "score"
                      ? "bg-accent text-background"
                      : "text-muted hover:bg-accent/10"
                  }`}
                >
                  Record score
                </button>
                <button
                  type="button"
                  onClick={() => onSetResultMode("winner")}
                  className={`flex-1 py-2 border-l border-border transition-colors ${
                    resultMode === "winner"
                      ? "bg-accent text-background"
                      : "text-muted hover:bg-accent/10"
                  }`}
                >
                  Declare winner
                </button>
              </div>

              {resultMode === "score" ? (
                <form onSubmit={submitScore} className="flex gap-2">
                  <button
                    type="submit"
                    disabled={scoreA === scoreB}
                    className="flex-1 rounded-lg bg-accent text-background px-3 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    Record Result
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg px-3 py-2 text-sm border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => declareWinner("A")}
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors text-left"
                    >
                      <span className="text-[10px] text-muted uppercase tracking-wide block mb-0.5">Team A wins</span>
                      <span className="truncate block">{nameOf(players, pending.teamA[0])} & {nameOf(players, pending.teamA[1])}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => declareWinner("B")}
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors text-left"
                    >
                      <span className="text-[10px] text-muted uppercase tracking-wide block mb-0.5">Team B wins</span>
                      <span className="truncate block">{nameOf(players, pending.teamB[0])} & {nameOf(players, pending.teamB[1])}</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => declareWinner("tie")}
                      className="flex-1 rounded-lg border border-border text-muted px-3 py-2 text-sm font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
                    >
                      Tie
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded-lg px-3 py-2 text-sm border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
