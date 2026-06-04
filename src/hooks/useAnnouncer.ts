"use client";

import { useEffect, useRef } from "react";

const PREFERRED_VOICES = [
  "Samantha", "Ava", "Allison", "Serena", "Karen", "Moira", "Tessa",
  "Fiona", "Daniel", "Google UK English Female", "Google US English",
  "Microsoft Aria", "Microsoft Jenny",
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (name.includes("natural")) score += 200;
  if (name.includes("neural")) score += 150;
  if (name.includes("premium") || name.includes("enhanced")) score += 120;
  const idx = PREFERRED_VOICES.findIndex((p) => v.name === p || v.name.includes(p));
  if (idx >= 0) score += 100 - idx;
  if (v.default) score -= 10;
  return score;
}

export type SpeakPart = { text: string; rate?: number; pitch?: number; volume?: number };

export function useAnnouncer() {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
      const pool = en.length > 0 ? en : voices;
      pool.sort((a, b) => scoreVoice(b) - scoreVoice(a));
      voiceRef.current = pool[0] ?? null;
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, []);

  function buildUtter(text: string, opts: Omit<SpeakPart, "text"> = {}) {
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) { utter.voice = voiceRef.current; utter.lang = voiceRef.current.lang; }
    utter.rate = opts.rate ?? 0.95;
    utter.pitch = opts.pitch ?? 1.05;
    utter.volume = opts.volume ?? 1;
    return utter;
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(buildUtter(text));
  }

  function speakSequence(parts: SpeakPart[]) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    for (const p of parts) window.speechSynthesis.speak(buildUtter(p.text, p));
  }

  return { speak, speakSequence };
}
