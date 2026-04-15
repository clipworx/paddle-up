"use client";

import { MAX_COURTS } from "@/lib/types";

type Props = {
  courtCount: number;
  readOnly?: boolean;
  skillSeparation: boolean;
  onChange: (n: number) => void;
  onToggleSkillSeparation: (next: boolean) => void;
};

const MIN = 1;
const MAX = MAX_COURTS;

export function CourtConfig({
  courtCount,
  readOnly,
  skillSeparation,
  onChange,
  onToggleSkillSeparation,
}: Props) {
  return (
    <section className="rounded-lg border border-border bg-background/60 p-4 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Courts</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(Math.max(MIN, courtCount - 1))}
            disabled={readOnly || courtCount <= MIN}
            className="w-9 h-9 rounded border border-border text-foreground font-semibold hover:bg-accent/10 hover:border-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-border transition-colors"
            aria-label="Decrease courts"
          >
            −
          </button>
          <span
            className="text-2xl font-bold text-foreground w-10 text-center tabular-nums"
            aria-live="polite"
          >
            {courtCount}
          </span>
          <button
            type="button"
            onClick={() => onChange(Math.min(MAX, courtCount + 1))}
            disabled={readOnly || courtCount >= MAX}
            className="w-9 h-9 rounded border border-border text-foreground font-semibold hover:bg-accent/10 hover:border-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-border transition-colors"
            aria-label="Increase courts"
          >
            +
          </button>
        </div>
        <p className="text-xs text-muted mt-3">
          Up to {MAX} courts running in parallel.
        </p>
      </div>

      <div className="pt-4 border-t border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Skill separation
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {skillSeparation
                ? "Casual (beginner, rookie, novice) and competitive (low / high intermediate, pro) play in their own rotations."
                : "All players mix — everyone partners with everyone over time."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={skillSeparation}
            disabled={readOnly}
            onClick={() => onToggleSkillSeparation(!skillSeparation)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
              skillSeparation ? "bg-accent" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-background shadow transition-transform ${
                skillSeparation ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
