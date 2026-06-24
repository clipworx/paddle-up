const MUTE_KEY = "paddle-up-voice-muted-v1";

function supported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isVoiceMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
}

// Cancel any in-flight utterance first so a rapid string of point changes
// doesn't queue up announcements that talk over each other — only the most
// recent score should ever be heard.
export function speak(text: string) {
  if (!supported()) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export function announceMatchComplete(scoreA: number, scoreB: number) {
  speak(`Game complete. Final score, ${scoreA} to ${scoreB}.`);
}

export function announceFault() {
  speak("Fault. Second serve.");
}

export function announceDoubleFault() {
  speak("Double fault.");
}
