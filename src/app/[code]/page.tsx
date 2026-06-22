"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditLock } from "@/components/EditLock";
import { Logo } from "@/components/Logo";
import { JoinGate } from "@/components/JoinGate";
import { WaitingRoom } from "@/components/WaitingRoom";
import { PendingRequests } from "@/components/PendingRequests";
import { MyStatusCard } from "@/components/MyStatusCard";
import { RosterList } from "@/components/RosterList";
import { CourtCard } from "@/components/CourtCard";
import { HostPanel } from "@/components/HostPanel";
import { useNotifications } from "@/components/Notifications";
import { useSharedState, getStoredPassword } from "@/lib/sharedState";
import { getStoredIdentity, setStoredIdentity, generatePlayerId } from "@/lib/playerIdentity";
import { applySetCourtCount, applyKickPlayer, applyAdmit, applyDecline } from "@/lib/sessionTransitions";
import { Tier, MAX_COURTS } from "@/lib/types";

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

  // Restore identity from localStorage on mount, and confirm/recreate it
  // server-side (covers the case where the player was kicked while away).
  // Nothing to do if there's no stored identity — that's the fresh-device
  // case, handled by falling through to the JoinGate render below. There's
  // no separate "restoring" flag: while playerId is set but `myPlayer`
  // hasn't shown up in state.players yet (via this join call or realtime),
  // the render logic below already shows a loading state for that gap.
  useEffect(() => {
    const stored = getStoredIdentity(normalized);
    if (!stored) return;
    let cancelled = false;
    fetch(`/api/sessions/${normalized}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: stored.playerId, name: stored.name, password: getStoredPassword(normalized) }),
    }).then(() => {
      if (!cancelled) setPlayerId(stored.playerId);
    });
    return () => {
      cancelled = true;
    };
  }, [normalized]);

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

  const handleCompleteMatch = async (courtIndex: number) => {
    setBusy(true);
    await fetch(`/api/sessions/${normalized}/complete-match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courtIndex }),
    });
    setBusy(false);
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

  if (hydrated && !exists) {
    return (
      <main className="mx-auto max-w-xl w-full px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Session not found</h1>
        <p className="text-sm text-muted">
          No open play exists with code{" "}
          <span className="font-mono font-semibold text-foreground">{normalized}</span>.
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

  if (!hydrated) {
    return <main className="mx-auto max-w-xl w-full px-4 py-16 text-center text-sm text-muted">Loading…</main>;
  }

  if (!playerId) {
    return <JoinGate busy={joining} onSubmit={handleJoinGateSubmit} />;
  }

  if (!myPlayer) {
    // Identity restored from localStorage but the roster hasn't caught up
    // yet (join request in flight / realtime still propagating).
    return <main className="mx-auto max-w-xl w-full px-4 py-16 text-center text-sm text-muted">Loading…</main>;
  }

  if (myPlayer.status !== "admitted") {
    return <WaitingRoom status={myPlayer.status} busy={busy} onRetry={handleRetryJoin} />;
  }

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-6xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/play" className="flex items-center gap-2 shrink-0 mr-2">
            <Logo size={28} />
            <span className="text-sm font-bold text-foreground hidden sm:block">ReZerve</span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm text-muted hidden sm:inline">Session</span>
            <span className="font-mono font-semibold text-accent text-sm">{normalized}</span>
            <span className="text-border hidden sm:inline mx-1">·</span>
            <Link
              href={`/${normalized}/live`}
              className="text-xs text-muted hover:text-accent transition-colors hidden sm:inline"
            >
              Live view →
            </Link>
          </div>
          <div className="shrink-0">
            <EditLock isEditor={isEditor} onAuthenticate={authenticate} onLogout={logout} />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl w-full px-4 py-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <MyStatusCard
              player={myPlayer}
              busy={busy}
              onRename={handleRename}
              onSetTier={handleSetTier}
              onJoinQueue={handleJoinQueue}
              onLeaveQueue={handleLeaveQueue}
            />
            {isEditor && (
              <>
                <PendingRequests players={state.players} onAdmit={handleAdmit} onDecline={handleDecline} />
                <HostPanel
                  courtCount={state.courtCount}
                  onSetCourtCount={handleSetCourtCount}
                  onEndSession={handleEndSession}
                />
              </>
            )}
            <RosterList
              players={state.players.filter((p) => p.status === "admitted")}
              myId={playerId}
              isEditor={isEditor}
              onKick={isEditor ? handleKick : undefined}
            />
          </div>

          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
            {state.courts.map((match, i) => (
              <CourtCard
                key={i}
                code={normalized}
                courtIndex={i}
                match={match}
                players={state.players}
                busy={busy}
                onComplete={() => handleCompleteMatch(i)}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
