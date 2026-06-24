export type Theme = {
  key: string;
  name: string;
  emoji: string;
  vars: {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    surface: string;
    border: string;
  };
};

// Neutrals are constant across all themes — only the accent ramp changes.
const FG   = "#14171a"; // ink-900
const MUTED = "#5b636d"; // ink-500
const BG    = "#ffffff"; // card/modal bg

export const THEMES: Theme[] = [
  {
    key: "green",
    name: "Pickle Green",
    emoji: "🟢",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#24ae24", surface: "#eefbee", border: "#dff7df" },
  },
  {
    key: "blue",
    name: "Court Blue",
    emoji: "🟦",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#2a6fdb", surface: "#eef4fe", border: "#d8e6fd" },
  },
  {
    key: "orange",
    name: "Clay Orange",
    emoji: "🟧",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#e5642c", surface: "#fff2ec", border: "#ffe0d2" },
  },
  {
    key: "graphite",
    name: "Graphite",
    emoji: "⬛",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#3a434a", surface: "#f1f3f4", border: "#e2e6e8" },
  },
  {
    key: "indigo",
    name: "Baseline Indigo",
    emoji: "🟪",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#5b4fd6", surface: "#f0effe", border: "#e0defc" },
  },
  {
    key: "lime",
    name: "Net Lime",
    emoji: "🟨",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#84b81a", surface: "#f6fce7", border: "#ebf8c4" },
  },
  {
    key: "pink",
    name: "Court Pink",
    emoji: "🩷",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#e5407e", surface: "#fef0f5", border: "#fcdde8" },
  },
  {
    key: "rose",
    name: "Soft Rose",
    emoji: "🌸",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#d94f63", surface: "#fdf1f3", border: "#fadee3" },
  },
  {
    key: "magenta",
    name: "Hot Magenta",
    emoji: "💖",
    vars: { background: BG, foreground: FG, muted: MUTED, accent: "#e12f9e", surface: "#feeff8", border: "#fcd7ee" },
  },
];

const CSS_KEYS = ["background", "foreground", "muted", "accent", "surface", "border"] as const;

export function applyTheme(themeKey: string | null) {
  const theme = THEMES.find((t) => t.key === themeKey);
  if (!theme) return;
  for (const key of CSS_KEYS) {
    document.documentElement.style.setProperty(`--${key}`, theme.vars[key]);
  }
}

export function clearTheme() {
  for (const key of CSS_KEYS) {
    document.documentElement.style.removeProperty(`--${key}`);
  }
}

export function themeVarsStyle(themeKey: string | null): React.CSSProperties {
  const theme = THEMES.find((t) => t.key === themeKey);
  if (!theme) return {};
  // Tailwind's @theme block resolves `--color-accent: var(--accent)` (and
  // background/foreground/muted/surface/border) exactly once, on :root —
  // that frozen value is what every `text-accent`/`bg-accent`/etc. utility
  // actually consumes. Setting only the raw `--accent` here (applyTheme's
  // approach, which mutates :root directly) never reaches a *descendant*
  // element like a single card, so the --color-* vars need setting too.
  return Object.fromEntries([
    ...CSS_KEYS.map((k) => [`--${k}`, theme.vars[k]]),
    ...CSS_KEYS.map((k) => [`--color-${k}`, `var(--${k})`]),
  ]) as React.CSSProperties;
}
