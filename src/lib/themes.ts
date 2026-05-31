export type Theme = {
  key: string;
  name: string;
  vars: {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    surface: string;
    border: string;
  };
};

export const THEMES: Theme[] = [
  {
    key: "amber",
    name: "Amber",
    vars: {
      background: "#fdf4e8",
      foreground: "#4b2e2b",
      muted: "#8c5a3c",
      accent: "#c08552",
      surface: "#f0ede7",
      border: "#e4d8c8",
    },
  },
  {
    key: "blue",
    name: "Blue",
    vars: {
      background: "#e8f0ff",
      foreground: "#1e3a5f",
      muted: "#4a6fa5",
      accent: "#2563eb",
      surface: "#eef2f8",
      border: "#c8d9f5",
    },
  },
  {
    key: "emerald",
    name: "Emerald",
    vars: {
      background: "#e8f5ee",
      foreground: "#14532d",
      muted: "#166534",
      accent: "#059669",
      surface: "#eef4f0",
      border: "#b8e0cc",
    },
  },
  {
    key: "violet",
    name: "Violet",
    vars: {
      background: "#f0e8ff",
      foreground: "#3b0764",
      muted: "#6b21a8",
      accent: "#7c3aed",
      surface: "#f0eef8",
      border: "#d4c8f0",
    },
  },
  {
    key: "rose",
    name: "Rose",
    vars: {
      background: "#fee8ec",
      foreground: "#881337",
      muted: "#9f1239",
      accent: "#e11d48",
      surface: "#f5eff0",
      border: "#f0c4cc",
    },
  },
  {
    key: "orange",
    name: "Orange",
    vars: {
      background: "#feeee0",
      foreground: "#7c2d12",
      muted: "#c2410c",
      accent: "#ea580c",
      surface: "#f4ede6",
      border: "#f0cca8",
    },
  },
  {
    key: "teal",
    name: "Teal",
    vars: {
      background: "#e0f5f0",
      foreground: "#134e4a",
      muted: "#0f766e",
      accent: "#0d9488",
      surface: "#eef4f2",
      border: "#9ce0d4",
    },
  },
  {
    key: "slate",
    name: "Slate",
    vars: {
      background: "#e8eef6",
      foreground: "#0f172a",
      muted: "#475569",
      accent: "#3b82f6",
      surface: "#eef1f6",
      border: "#c8d5e5",
    },
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
  return Object.fromEntries(
    CSS_KEYS.map((k) => [`--${k}`, theme.vars[k]])
  ) as React.CSSProperties;
}
