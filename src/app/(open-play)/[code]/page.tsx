"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditLock } from "@/components/EditLock";
import { JoinGate } from "@/components/JoinGate";
import { WaitingRoom } from "@/components/WaitingRoom";
import { PendingRequests } from "@/components/PendingRequests";
import { MyStatusCard } from "@/components/MyStatusCard";
import { RosterList } from "@/components/RosterList";
import { TierQueueCard } from "@/components/open-play/TierQueueCard";
import { KoBanner } from "@/components/open-play/KoBanner";
import { CourtCard } from "@/components/CourtCard";
import { HostPanel } from "@/components/HostPanel";
import { useNotifications } from "@/components/Notifications";
import { useSharedState, getStoredPassword } from "@/lib/sharedState";
import { getStoredIdentity, setStoredIdentity, generatePlayerId } from "@/lib/playerIdentity";
import { applySetCourtCount, applyKickPlayer, applyAdmit, applyDecline, applyCompleteMatch } from "@/lib/sessionTransitions";
import { queuedInTier } from "@/lib/openPlayDisplay";
import { Tier, TIERS, MAX_COURTS } from "@/lib/types";

export default function SessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const normalized = code.toUpperCase();
  const router = useRouter();
  const { notify, confirm } = useNotifications();
  const { state, setState, hydrated, exists, isEditor, authenticate, logout, deleteSession } =
    useSharedState(normalized);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showKO, setShowKO] = useState(false);
  // A synchronous localStorage read, not a side effect — computing it here
  // (rather than in the effect below) means we know on the very first render
  // whether there's an identity to restore, so the render logic never has to
  // guess "no identity" vs. "still confirming one" from playerId alone.
  const storedIdentity = useMemo(() => getStoredIdentity(normalized), [normalized]);

  // Confirm the restored identity server-side (covers the case where the
  // player was kicked while away). Nothing to do if there's no stored
  // identity — that falls straight through to the JoinGate render below.
  useEffect(() => {
    if (!storedIdentity) return;
    let cancelled = false;
    fetch(`/api/sessions/${normalized}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: storedIdentity.playerId,
        name: storedIdentity.name,
        password: getStoredPassword(normalized),
      }),
    }).then(() => {
      if (!cancelled) setPlayerId(storedIdentity.playerId);
    });
    return () => {
      cancelled = true;
    };
  }, [normalized, storedIdentity]);

  const myPlayer = state.players.find((p) => p.id === playerId) ?? null;

  const handleJoinGateSubmit = async (name: string) => {
    setJoining(true);
    const id = generatePlayerId();
    const res = await fetch(`/api/sessions/${normalized}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: id, name, password: getStoredPassword(normalized) }),
    });
    setJoining(false);
    if (res.ok) {
      setStoredIdentity(normalized, { playerId: id, name });
      setPlayerId(id);
    } else {
      notify("Failed to join session", "error");
    }
  };

  const handleRetryJoin = async () => {
    if (!playerId || !myPlayer) return;
    setBusy(true);
    await fetch(`/api/sessions/${normalized}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, name: myPlayer.name, password: getStoredPassword(normalized) }),
    });
    setBusy(false);
  };

  const handleAdmit = (id: string) => {
    setState((s) => {
      const result = applyAdmit(s, id);
      return "error" in result ? s : result;
    });
  };

  const handleDecline = (id: string) => {
    setState((s) => {
      const result = applyDecline(s, id);
      return "error" in result ? s : result;
    });
  };

  const handleRename = async (name: string) => {
    if (!playerId) return;
    setBusy(true);
    await fetch(`/api/sessions/${normalized}/rename`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, name }),
    });
    setStoredIdentity(normalized, { playerId, name });
    setBusy(false);
  };

  const handleSetTier = async (tier: Tier) => {
    if (!playerId) return;
    setBusy(true);
    await fetch(`/api/sessions/${normalized}/set-tier`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, tier }),
    });
    setBusy(false);
  };

  const handleJoinQueue = async () => {
    if (!playerId) return;
    setBusy(true);
    await fetch(`/api/sessions/${normalized}/queue-join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    setBusy(false);
  };

  const handleLeaveQueue = async () => {
    if (!playerId) return;
    setBusy(true);
    await fetch(`/api/sessions/${normalized}/queue-leave`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    setBusy(false);
  };

  const handleCompleteMatch = (courtIndex: number) => {
    let succeeded = false;
    setState((s) => {
      const result = applyCompleteMatch(s, courtIndex);
      if ("error" in result) return s;
      succeeded = true;
      return result;
    });
    if (succeeded) {
      setShowKO(true);
      setTimeout(() => setShowKO(false), 2800);
    }
  };

  const handleSetCourtCount = (n: number) => {
    setState((s) => {
      const result = applySetCourtCount(s, n, MAX_COURTS);
      return "error" in result ? s : result;
    });
  };

  const handleKick = async (id: string) => {
    const ok = await confirm("Remove this player from the session?", {
      title: "Kick player?",
      confirmLabel: "Kick",
    });
    if (!ok) return;
    setState((s) => {
      const result = applyKickPlayer(s, id);
      return "error" in result ? s : result;
    });
  };

  const handleEndSession = async () => {
    const ok = await confirm(
      `This permanently deletes session ${normalized} and removes everyone from it. This cannot be undone.`,
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

  let content: React.ReactNode;

  if (!hydrated || (storedIdentity && !playerId)) {
    // Either the session state hasn't loaded yet, or we have a stored
    // identity that's still being confirmed with the server — don't flash
    // the JoinGate in either case.
    content = <p className="text-center text-sm text-muted py-16">Loading…</p>;
  } else if (!exists) {
    content = (
      <div className="text-center py-16">
        <div className="font-display italic font-black text-[44px] text-negative mb-2.5 leading-tight">
          SESSION NOT FOUND
        </div>
        <div className="text-muted text-[15px] mb-7">
          No session with code{" "}
          <span className="text-foreground font-op-mono text-[13px]">{normalized}</span>
        </div>
        <Link
          href="/play"
          className="inline-block bg-surface text-foreground px-7 py-3 rounded-lg text-sm font-semibold border border-border hover:border-accent/40 transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    );
  } else if (!playerId) {
    content = <JoinGate code={normalized} busy={joining} onSubmit={handleJoinGateSubmit} />;
  } else if (!myPlayer) {
    // Identity restored from localStorage but the roster hasn't caught up
    // yet (join request in flight / realtime still propagating).
    content = <p className="text-center text-sm text-muted py-16">Loading…</p>;
  } else if (myPlayer.status !== "admitted") {
    content = (
      <WaitingRoom name={myPlayer.name} status={myPlayer.status} busy={busy} onRetry={handleRetryJoin} />
    );
  } else {
    const myQueuePosition =
      myPlayer.tier && myPlayer.joined
        ? queuedInTier(state.players, myPlayer.tier).findIndex((p) => p.id === playerId) + 1
        : 0;
    const hasActiveCourts = state.courts.some((m) => m !== null);

    content = (
      <>
        <MyStatusCard
          code={normalized}
          player={myPlayer}
          busy={busy}
          myQueuePosition={myQueuePosition}
          onRename={handleRename}
          onSetTier={handleSetTier}
          onJoinQueue={handleJoinQueue}
          onLeaveQueue={handleLeaveQueue}
        />

        {isEditor && (
          <PendingRequests players={state.players} onAdmit={handleAdmit} onDecline={handleDecline} />
        )}

        {isEditor && (
          <HostPanel
            code={normalized}
            courtCount={state.courtCount}
            onSetCourtCount={handleSetCourtCount}
            onEndSession={handleEndSession}
          />
        )}

        {hasActiveCourts && (
          <div>
            <div className="font-op-mono text-[9px] text-muted tracking-[0.18em] mb-2.25 pl-0.5">
              ACTIVE COURTS
            </div>
            <div className="flex flex-col gap-2.5">
              {state.courts.map((match, i) => (
                <CourtCard
                  key={i}
                  code={normalized}
                  courtIndex={i}
                  match={match}
                  players={state.players}
                  busy={busy}
                  isEditor={isEditor}
                  onComplete={() => handleCompleteMatch(i)}
                />
              ))}
            </div>
          </div>
        )}

        {TIERS.map((tier) => (
          <TierQueueCard
            key={tier}
            tier={tier}
            players={state.players}
            myId={playerId}
            isEditor={isEditor}
            onKick={handleKick}
          />
        ))}

        {isEditor && <RosterList players={state.players} myId={playerId} onKick={handleKick} />}
      </>
    );
  }

  return (
    <>
      <KoBanner show={showKO} />
      <nav className="sticky top-0 z-40 bg-background/97 backdrop-blur-md border-b border-border">
        <div className="px-4.5 py-2.5 flex items-center gap-3">
          <Link
            href="/play"
            aria-label="Home"
            className="text-muted text-[22px] leading-none px-1.5 py-1 rounded-md hover:text-foreground transition-colors"
          >
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-op-mono text-[9px] text-muted tracking-[0.18em]">SESSION</div>
            <div className="font-op-mono text-[21px] font-bold text-accent tracking-[0.16em] leading-tight truncate">
              {normalized}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/${normalized}/live`}
              className="font-op-mono text-[9px] text-muted tracking-widest px-3 py-1.75 border border-border rounded-md hover:text-foreground hover:border-foreground/30 transition-colors whitespace-nowrap"
            >
              LIVE ↗
            </Link>
            <EditLock isEditor={isEditor} onAuthenticate={authenticate} onLogout={logout} />
          </div>
        </div>
      </nav>

      <main className="max-w-145 w-full mx-auto px-4 py-3.5 pb-22 flex flex-col gap-3.5">
        {content}
      </main>
    </>
  );
}
