"use client";

import { useEffect, useState } from "react";
import { Player, SKILL_LEVELS, SkillLevel, isActive } from "@/lib/types";

function SkillModal({
  player,
  onClose,
  onPick,
}: {
  player: Player;
  onClose: () => void;
  onPick: (skill: SkillLevel) => void;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-modal-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl transition-transform duration-200 ${
          entered ? "translate-y-0 scale-100" : "translate-y-2 scale-95"
        }`}
      >
        <h2 id="skill-modal-title" className="text-lg font-bold text-foreground mb-1">
          Change skill level
        </h2>
        <p className="text-sm text-muted mb-4">
          Pick the new skill level for{" "}
          <span className="font-semibold text-foreground">{player.name}</span>.
        </p>
        <div className="space-y-2">
          {SKILL_LEVELS.map((s) => {
            const active = s === player.skill;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-semibold text-left transition-colors ${
                  active
                    ? "border-accent bg-accent text-background"
                    : "border-border text-foreground hover:bg-accent/10 hover:border-accent"
                }`}
                aria-pressed={active}
              >
                <span className="capitalize">{s}</span>
                {active && <span className="ml-2 text-xs opacity-80">· current</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PartnerModal({
  player,
  players,
  lockedPairs,
  currentPartnerId,
  onClose,
  onPick,
}: {
  player: Player;
  players: Player[];
  lockedPairs: [string, string][];
  currentPartnerId: string | null;
  onClose: () => void;
  onPick: (partnerId: string | null) => void;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lockedWith = (id: string): string | null => {
    for (const [a, b] of lockedPairs) {
      if (a === id) return b;
      if (b === id) return a;
    }
    return null;
  };

  const candidates = players.filter((p) => {
    if (p.id === player.id) return false;
    const partner = lockedWith(p.id);
    if (!partner) return true;
    if (partner === player.id) return true;
    return false;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl transition-transform duration-200 ${
          entered ? "translate-y-0 scale-100" : "translate-y-2 scale-95"
        }`}
      >
        <h2 className="text-lg font-bold text-foreground mb-1">Locked partner</h2>
        <p className="text-sm text-muted mb-4">
          <span className="font-semibold text-foreground">{player.name}</span> will always play on the same team as their partner.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => onPick(null)}
            className={`w-full rounded-lg border px-4 py-2.5 text-sm font-semibold text-left transition-colors ${
              currentPartnerId === null
                ? "border-accent bg-accent text-background"
                : "border-border text-foreground hover:bg-accent/10 hover:border-accent"
            }`}
          >
            No partner
            {currentPartnerId === null && <span className="ml-2 text-xs opacity-80">· current</span>}
          </button>
          {candidates.map((p) => {
            const active = p.id === currentPartnerId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-semibold text-left transition-colors ${
                  active
                    ? "border-accent bg-accent text-background"
                    : "border-border text-foreground hover:bg-accent/10 hover:border-accent"
                }`}
                aria-pressed={active}
              >
                <span>{p.name}</span>
                <span className="ml-1.5 text-xs opacity-70 capitalize font-normal">({p.skill})</span>
                {active && <span className="ml-2 text-xs opacity-80">· current</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  players: Player[];
  lockedPairs: [string, string][];
  readOnly?: boolean;
  onAdd: (name: string, skill: SkillLevel) => void;
  onRemove: (id: string) => void;
  onToggleActive: (id: string) => void;
  onChangeSkill: (id: string, skill: SkillLevel) => void;
  onSetPartner: (id: string, partnerId: string | null) => void;
};

export function PlayerList({
  players,
  lockedPairs,
  readOnly,
  onAdd,
  onRemove,
  onToggleActive,
  onChangeSkill,
  onSetPartner,
}: Props) {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<SkillLevel>("rookie");
  const [editingSkill, setEditingSkill] = useState<Player | null>(null);
  const [editingPartner, setEditingPartner] = useState<Player | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, skill);
    setName("");
  };

  function getPartnerId(playerId: string): string | null {
    for (const [a, b] of lockedPairs) {
      if (a === playerId) return b;
      if (b === playerId) return a;
    }
    return null;
  }

  function partnerName(playerId: string): string | null {
    const partnerId = getPartnerId(playerId);
    if (!partnerId) return null;
    return players.find((p) => p.id === partnerId)?.name ?? null;
  }

  return (
    <section className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-3">
        Players <span className="opacity-60 font-normal">({players.length})</span>
      </h2>

      {!readOnly && (
        <form onSubmit={submit} className="space-y-2 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value as SkillLevel)}
              className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              aria-label="Skill level"
            >
              {SKILL_LEVELS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-accent text-background px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {editingSkill && (
        <SkillModal
          player={editingSkill}
          onClose={() => setEditingSkill(null)}
          onPick={(s) => { onChangeSkill(editingSkill.id, s); setEditingSkill(null); }}
        />
      )}

      {editingPartner && (
        <PartnerModal
          player={editingPartner}
          players={players}
          lockedPairs={lockedPairs}
          currentPartnerId={getPartnerId(editingPartner.id)}
          onClose={() => setEditingPartner(null)}
          onPick={(partnerId) => { onSetPartner(editingPartner.id, partnerId); setEditingPartner(null); }}
        />
      )}

      {players.length === 0 ? (
        <p className="text-sm text-muted opacity-80">
          No players yet. Add at least 4 to start.
        </p>
      ) : (
        <ul className="divide-y divide-border max-h-96 overflow-y-auto">
          {players.map((p) => {
            const active = isActive(p);
            const partner = partnerName(p.id);
            return (
              <li
                key={p.id}
                className={`py-2 space-y-1.5 ${active ? "" : "opacity-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {readOnly ? (
                      <span className="text-sm font-medium text-foreground truncate block">{p.name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingSkill(p)}
                        title="Change skill level"
                        className="text-sm font-medium text-foreground truncate block hover:text-accent underline-offset-2 hover:underline text-left"
                      >
                        {p.name}
                      </button>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted capitalize">
                        {p.skill}
                        {!active && (
                          <span className="ml-2 rounded bg-muted/15 text-muted px-1.5 py-0.5">resting</span>
                        )}
                      </span>
                      {partner && (
                        <span className="text-[10px] rounded-full bg-accent/15 text-accent px-2 py-0.5 font-semibold">
                          🔗 {partner}
                        </span>
                      )}
                    </div>
                  </div>
                  {!readOnly && (
                    <span className="flex gap-1 shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => setEditingPartner(p)}
                        className="text-xs rounded px-2 py-1 border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                        title="Set locked partner"
                      >
                        {partner ? "Partner ✓" : "Partner"}
                      </button>
                      <button
                        onClick={() => onToggleActive(p.id)}
                        className="text-xs rounded px-2 py-1 border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                        aria-pressed={active}
                      >
                        {active ? "Rest" : "Resume"}
                      </button>
                      <button
                        onClick={() => onRemove(p.id)}
                        className="text-xs rounded px-2 py-1 border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
