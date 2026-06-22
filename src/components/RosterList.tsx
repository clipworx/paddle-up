"use client";

import { Player, Tier } from "@/lib/types";

const TIER_LABELS: Record<Tier, string> = {
  novice: "Novice",
  intermediate: "Intermediate",
};

type Props = {
  players: Player[];
  myId: string | null;
  isEditor: boolean;
  onKick?: (id: string) => void;
};

function Row({ player, myId, isEditor, onKick, suffix }: {
  player: Player; myId: string | null; isEditor: boolean; onKick?: (id: string) => void; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-foreground">
        {player.name}
        {player.id === myId && <span className="text-muted"> (you)</span>}
        {suffix && <span className="text-xs text-muted ml-1.5">{suffix}</span>}
      </span>
      {isEditor && player.id !== myId && onKick && (
        <button
          onClick={() => onKick(player.id)}
          className="text-xs text-muted hover:text-accent transition-colors shrink-0"
        >
          Kick
        </button>
      )}
    </div>
  );
}

export function RosterList({ players, myId, isEditor, onKick }: Props) {
  const playing = players.filter((p) => p.inMatchOnCourt !== null);
  const queued = (tier: Tier) => players.filter((p) => p.inMatchOnCourt === null && p.joined && p.tier === tier);
  const resting = players.filter((p) => p.inMatchOnCourt === null && !p.joined);

  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        Players ({players.length})
      </h3>

      {playing.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Playing</p>
          <div className="divide-y divide-border/50">
            {playing.map((p) => (
              <Row key={p.id} player={p} myId={myId} isEditor={isEditor} onKick={onKick} suffix={`Court ${p.inMatchOnCourt! + 1}`} />
            ))}
          </div>
        </div>
      )}

      {(["novice", "intermediate"] as Tier[]).map((tier) => {
        const list = queued(tier);
        if (list.length === 0) return null;
        return (
          <div key={tier}>
            <p className="text-xs font-semibold text-foreground mb-1">{TIER_LABELS[tier]} queue ({list.length})</p>
            <div className="divide-y divide-border/50">
              {list.map((p) => <Row key={p.id} player={p} myId={myId} isEditor={isEditor} onKick={onKick} />)}
            </div>
          </div>
        );
      })}

      {resting.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted mb-1">Resting</p>
          <div className="divide-y divide-border/50">
            {resting.map((p) => (
              <Row key={p.id} player={p} myId={myId} isEditor={isEditor} onKick={onKick} suffix={p.tier ? TIER_LABELS[p.tier] : undefined} />
            ))}
          </div>
        </div>
      )}

      {players.length === 0 && <p className="text-sm text-muted">No one has joined yet.</p>}
    </div>
  );
}
