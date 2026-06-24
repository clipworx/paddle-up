"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Megaphone, Minus, Plus, Volume2, VolumeX } from "lucide-react";
import { useSharedState } from "@/lib/sharedState";
import { applyAdjustScore, applyCompleteMatch, applyFault, applySwitchServer } from "@/lib/sessionTransitions";
import { TIER_LABEL, TIER_TEXT_CLASS, TIER_BG_CLASS } from "@/lib/openPlayDisplay";
import { speak, announceMatchComplete, announceFault, announceDoubleFault, isVoiceMuted, setVoiceMuted } from "@/lib/voiceOver";
import { Player, Tier } from "@/lib/types";

export default function CourtScoringPage({
  params,
}: {
  params: Promise<{ code: string; n: string }>;
}) {
  const { code, n } = use(params);
  const normalized = code.toUpperCase();
  const courtIndex = Math.max(0, parseInt(n, 10) - 1);
  // No visible EditLock on this page — host auth resolves automatically from
  // the password already cached in localStorage by useSharedState, exactly
  // like every other self-service action in Open Play.
  const { state, setState, hydrated, exists, isEditor } = useSharedState(normalized);

  const match = state.courts[courtIndex] ?? null;

  const [muted, setMuted] = useState(() => isVoiceMuted());

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      setVoiceMuted(next);
      return next;
    });
  }

  const handleAdjust = (team: "A" | "B", delta: 1 | -1) => {
    setState((s) => {
      const result = applyAdjustScore(s, courtIndex, team, delta);
      return "error" in result ? s : result;
    });
  };

  const handleFault = () => {
    if (!match) return;
    const wasSecondServe = (match.serveNumber ?? 1) === 2;
    setState((s) => {
      const result = applyFault(s, courtIndex);
      return "error" in result ? s : result;
    });
    if (!muted) {
      if (wasSecondServe) announceDoubleFault();
      else announceFault();
    }
  };

  const handleSwitchServer = () => {
    setState((s) => {
      const result = applySwitchServer(s, courtIndex);
      return "error" in result ? s : result;
    });
  };

  const handleComplete = () => {
    if (!match) return;
    const scoreA = match.scoreA ?? 0;
    const scoreB = match.scoreB ?? 0;
    let succeeded = false;
    setState((s) => {
      const result = applyCompleteMatch(s, courtIndex);
      if ("error" in result) return s;
      succeeded = true;
      return result;
    });
    if (succeeded && isEditor && !muted) announceMatchComplete(scoreA, scoreB);
  };

  const playerOf = (id: string): Player | undefined => state.players.find((p) => p.id === id);

  const handleAnnounce = () => {
    if (!match) return;
    const nameOf = (id: string) => playerOf(id)?.name ?? "Player";
    const nameA = `${nameOf(match.teamA[0])} and ${nameOf(match.teamA[1])}`;
    const nameB = `${nameOf(match.teamB[0])} and ${nameOf(match.teamB[1])}`;
    const servingNames = match.servingTeam === "B" ? nameB : nameA;
    const serveOrdinal = (match.serveNumber ?? 1) === 1 ? "First" : "Second";
    speak(
      `${nameA}, ${match.scoreA ?? 0}. ${nameB}, ${match.scoreB ?? 0}. ${servingNames} serving. ${serveOrdinal} serve.`
    );
  };

  if (hydrated && !exists) {
    return (
      <main className="max-w-145 w-full mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Session not found</h1>
        <p className="text-sm text-muted">
          No open play exists with code{" "}
          <span className="font-op-mono font-semibold text-foreground">{normalized}</span>.
        </p>
        <Link
          href="/play"
          className="inline-block rounded-lg bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          Back to start
        </Link>
      </main>
    );
  }

  return (
    <>
      <nav className="sticky top-0 z-40 bg-background/97 backdrop-blur-md border-b border-border">
        <div className="px-4.5 py-2.5 flex items-center gap-3">
          <Link
            href={`/${normalized}`}
            aria-label="Back to session"
            className="text-muted text-[22px] leading-none px-1.5 py-1 rounded-md hover:text-foreground transition-colors"
          >
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-op-mono text-[9px] text-muted tracking-[0.18em]">{normalized}</div>
            <div className="font-display italic font-black text-[28px] text-foreground leading-none">
              COURT {courtIndex + 1}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {isEditor && (
              <button
                onClick={toggleMute}
                aria-label={muted ? "Unmute score announcements" : "Mute score announcements"}
                className="text-muted hover:text-foreground transition-colors"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-warning animate-[op-livePulse_1.4s_ease_infinite]" />
              <div className="font-op-mono text-[9px] text-warning tracking-widest">LIVE</div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-145 w-full mx-auto px-4 py-5 pb-22">
        {match ? (
          <>
            <div className="bg-background border border-warning/26 rounded-2xl overflow-hidden mb-4.5">
              <div className="px-4.5 py-2.75 bg-warning/8 border-b border-warning/14 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-warning animate-[op-livePulse_1.4s_ease_infinite] shrink-0" />
                <div className="font-op-mono text-[9px] text-warning tracking-[0.17em] font-bold">
                  COURT {courtIndex + 1} · MATCH IN PROGRESS
                </div>
              </div>
              <div className="grid grid-cols-[1fr_60px_1fr] items-stretch min-h-40">
                <div className="px-4.5 py-6 flex flex-col justify-center">
                  {match.teamA.map((id) => {
                    const p = playerOf(id);
                    const tier: Tier = p?.tier ?? "novice";
                    return (
                      <div key={id} className="mb-3.5">
                        <div className="font-display italic font-black text-[clamp(26px,5.5vw,38px)] text-foreground leading-[0.88]">
                          {p?.name ?? "—"}
                        </div>
                        <div className={`inline-flex mt-1.25 px-2.25 py-0.5 rounded-sm font-op-mono text-[8px] tracking-[0.12em] ${TIER_BG_CLASS[tier]} ${TIER_TEXT_CLASS[tier]}`}>
                          {TIER_LABEL[tier]}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="relative flex items-center justify-center bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--color-warning)_10%,transparent)_50%,transparent_100%)]">
                  <div className="absolute left-0 top-[18%] bottom-[18%] w-px bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--color-warning)_42%,transparent),transparent)]" />
                  <div className="absolute right-0 top-[18%] bottom-[18%] w-px bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--color-warning)_42%,transparent),transparent)]" />
                  <div className="font-display italic font-black text-[28px] text-warning tracking-tight">VS</div>
                </div>
                <div className="px-4.5 py-6 flex flex-col justify-center text-right">
                  {match.teamB.map((id) => {
                    const p = playerOf(id);
                    const tier: Tier = p?.tier ?? "novice";
                    return (
                      <div key={id} className="mb-3.5">
                        <div className="font-display italic font-black text-[clamp(26px,5.5vw,38px)] text-foreground leading-[0.88]">
                          {p?.name ?? "—"}
                        </div>
                        <div className={`inline-flex mt-1.25 px-2.25 py-0.5 rounded-sm font-op-mono text-[8px] tracking-[0.12em] ${TIER_BG_CLASS[tier]} ${TIER_TEXT_CLASS[tier]}`}>
                          {TIER_LABEL[tier]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-background border border-border rounded-2xl px-4.5 py-3 mb-4.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-op-mono text-[8px] text-muted tracking-[0.17em] font-bold mb-1">SERVING</div>
                {isEditor ? (
                  <button
                    onClick={handleSwitchServer}
                    className="font-display italic font-bold text-[17px] text-foreground leading-none truncate hover:text-accent transition-colors"
                  >
                    {match.servingTeam === "B"
                      ? `${playerOf(match.teamB[0])?.name ?? "—"} & ${playerOf(match.teamB[1])?.name ?? "—"}`
                      : `${playerOf(match.teamA[0])?.name ?? "—"} & ${playerOf(match.teamA[1])?.name ?? "—"}`}
                  </button>
                ) : (
                  <div className="font-display italic font-bold text-[17px] text-foreground leading-none truncate">
                    {match.servingTeam === "B"
                      ? `${playerOf(match.teamB[0])?.name ?? "—"} & ${playerOf(match.teamB[1])?.name ?? "—"}`
                      : `${playerOf(match.teamA[0])?.name ?? "—"} & ${playerOf(match.teamA[1])?.name ?? "—"}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-op-mono text-[9px] font-bold px-2.5 py-1 rounded-full bg-accent/12 text-accent tracking-widest whitespace-nowrap">
                  {(match.serveNumber ?? 1) === 1 ? "1ST SERVE" : "2ND SERVE"}
                </span>
                {isEditor && (
                  <button
                    onClick={handleFault}
                    className="font-op-mono text-[9px] font-bold px-2.5 py-1.5 rounded-full border border-negative/30 text-negative hover:bg-negative hover:text-white transition-colors tracking-widest"
                  >
                    FAULT
                  </button>
                )}
              </div>
            </div>

            <div className="bg-background border border-border rounded-2xl px-4.5 py-4 mb-4.5">
              <div className="font-op-mono text-[9px] text-muted tracking-[0.17em] font-bold text-center mb-3">
                SCORE
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="text-center">
                  <div className="font-display italic font-black text-[56px] text-foreground leading-none">
                    {match.scoreA ?? 0}
                  </div>
                  {isEditor && (
                    <div className="flex items-center justify-center gap-2 mt-2.5">
                      <button
                        onClick={() => handleAdjust("A", -1)}
                        aria-label="Decrease team A score"
                        className="w-10 h-10 rounded-full border border-border text-foreground flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <button
                        onClick={() => handleAdjust("A", 1)}
                        aria-label="Increase team A score"
                        className="w-10 h-10 rounded-full border border-border text-foreground flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="font-display italic font-black text-lg text-muted px-1">–</div>
                <div className="text-center">
                  <div className="font-display italic font-black text-[56px] text-foreground leading-none">
                    {match.scoreB ?? 0}
                  </div>
                  {isEditor && (
                    <div className="flex items-center justify-center gap-2 mt-2.5">
                      <button
                        onClick={() => handleAdjust("B", -1)}
                        aria-label="Decrease team B score"
                        className="w-10 h-10 rounded-full border border-border text-foreground flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <button
                        onClick={() => handleAdjust("B", 1)}
                        aria-label="Increase team B score"
                        className="w-10 h-10 rounded-full border border-border text-foreground flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isEditor && (
              <button
                onClick={handleAnnounce}
                className="w-full py-3.5 rounded-xl font-op-mono text-[12px] font-bold tracking-widest bg-accent/10 text-accent border border-accent/28 hover:bg-accent hover:text-white transition-colors flex items-center justify-center gap-2 mb-3"
              >
                <Megaphone size={15} />
                ANNOUNCE SCORE
              </button>
            )}

            {isEditor && (
              <button
                onClick={handleComplete}
                className="w-full py-5 rounded-xl font-display italic font-black text-[28px] tracking-wide bg-negative/12 text-negative border-2 border-negative/28 hover:bg-negative hover:text-white transition-colors"
              >
                COMPLETE MATCH
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-22">
            <div className="font-display italic font-black text-[54px] text-foreground/12 mb-2.5 leading-none">
              COURT {courtIndex + 1}
            </div>
            <div className="font-op-mono text-[11px] text-foreground/18 tracking-[0.22em]">STANDING BY</div>
          </div>
        )}
      </main>
    </>
  );
}
