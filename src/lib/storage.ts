"use client";

import { useEffect, useState } from "react";
import { AppState, INITIAL_STATE } from "./types";

const KEY = "paddle-up-state-v1";

export function useAppState() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...INITIAL_STATE, ...(JSON.parse(raw) as Partial<AppState>) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  return { state, setState, hydrated };
}
