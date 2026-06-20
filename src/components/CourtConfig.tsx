"use client";

import { MATCHING_STYLES, MAX_COURTS, MatchingStyle } from "@/lib/types";

type Props = {
  courtCount: number;
  readOnly?: boolean;
  matchingStyle: MatchingStyle;
  onChange: (n: number) => void;
  onSelectStyle: (next: MatchingStyle) => void;
};

const MIN = 1;
const MAX = MAX_COURTS;

export function CourtConfig({
  courtCount,
  readOnly,
  matchingStyle,
  onChange,
  onSelectStyle,
}: Props) {
  return (
    <section className="rounded-xl border border-border bg-background/60 p-4 shadow-sm space-y-4">
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

      <div className="pt-4 border-t border-border space-y-2">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Matching style
        </h3>
        <div className="space-y-2">
          {MATCHING_STYLES.map((opt) => {
            const selected = matchingStyle === opt.value;
            const disabled = readOnly || opt.comingSoon;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onSelectStyle(opt.value)}
                className={`w-full text-left rounded-lg border p-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/50 hover:bg-accent/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {opt.label}
                  </span>
                  {opt.comingSoon ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold text-muted bg-border/60 rounded-full px-2 py-0.5">
                      Coming soon
                    </span>
                  ) : selected ? (
                    <span className="shrink-0 text-accent">✓</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted mt-0.5">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
