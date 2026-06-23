"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditLock } from "@/components/EditLock";
import { Logo } from "@/components/Logo";
import { JoinGate } from "@/components/JoinGate";
import { WaitingRoom } from "@/components/WaitingRoom";
import { PendingRequests } from "@/components/PendingRequests";
import { MyStatusCard } from "@/components/MyStatusCard";
import { RosterList } from "@/components/RosterList";
import { QueueList } from "@/components/QueueList";
import { JoinQrCode } from "@/components/JoinQrCode";
import { CourtCard } from "@/components/CourtCard";
import { HostPanel } from "@/components/HostPanel";
import { useNotifications } from "@/components/Notifications";
import { useSharedState, getStoredPassword } from "@/lib/sharedState";
import { getStoredIdentity, setStoredIdentity, generatePlayerId } from "@/lib/playerIdentity";
import { applySetCourtCount, applyKickPlayer, applyAdmit, applyDecline, applyCompleteMatch } from "@/lib/sessionTransitions";
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
    setState((s) => {
      const result = applyCompleteMatch(s, courtIndex);
      return "error" in result ? s : result;
    });
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

  if (!hydrated || (storedIdentity && !playerId)) {
    // Either the session state hasn't loaded yet, or we have a stored
    // identity that's still being confirmed with the server — in both
    // cases, don't flash the JoinGate.
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
            <span className="font-mono font-semibold text-accent text-sm truncate">{normalized}</span>
            <span className="text-border hidden sm:inline mx-1">·</span>
            <Link
              href={`/${normalized}/live`}
              className="text-xs text-muted hover:text-accent transition-colors shrink-0"
            >
              <span className="hidden sm:inline">Live view →</span>
              <span className="sm:hidden">Live →</span>
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
            {isEditor ? (
              <>
                <JoinQrCode code={normalized} />
                <PendingRequests players={state.players} onAdmit={handleAdmit} onDecline={handleDecline} />
                <HostPanel
                  courtCount={state.courtCount}
                  onSetCourtCount={handleSetCourtCount}
                  onEndSession={handleEndSession}
                />
                <RosterList
                  players={state.players.filter((p) => p.status === "admitted")}
                  myId={playerId}
                  isEditor={isEditor}
                  onKick={handleKick}
                />
              </>
            ) : (
              <QueueList players={state.players} myId={playerId} />
            )}
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {state.courts
              .map((match, i) => ({ match, i }))
              .filter(({ match }) => isEditor || match !== null)
              .map(({ match, i }) => (
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
            {!isEditor && state.courts.every((c) => c === null) && (
              <p className="text-sm text-muted sm:col-span-2 text-center py-8">No matches in progress right now.</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
