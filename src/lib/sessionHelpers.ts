import { generateMatch } from "./rotation";
import { CompletedMatch, PendingMatch, Player } from "./types";

export const QUEUE_SIZE = 3;

export function activeCourtMatches(
  courts: (PendingMatch | null)[]
): PendingMatch[] {
  return courts.filter((m): m is PendingMatch => m !== null);
}

export function fillQueue(
  players: Player[],
  history: CompletedMatch[],
  courts: (PendingMatch | null)[],
  upcoming: PendingMatch[],
  skillSeparation = false
): PendingMatch[] {
  const active = activeCourtMatches(courts);
  if (active.length === 0 && upcoming.length === 0) return [];
  const result = [...upcoming];
  while (result.length < QUEUE_SIZE) {
    const next = generateMatch(players, history, active, result, skillSeparation);
    if (!next) break;
    result.push(next);
  }
  return result.slice(0, QUEUE_SIZE);
}

export function resizeCourts(
  courts: (PendingMatch | null)[],
  desired: number
): (PendingMatch | null)[] {
  const out = [...courts];
  while (out.length < desired) out.push(null);
  return out.slice(0, desired);
}
