import { generateMatch, advanceQueue } from "./rotation";
import { CompletedMatch, PendingMatch, Player } from "./types";

export { advanceQueue };

export const QUEUE_SIZE = 3;

export function activeCourtMatches(
  courts: (PendingMatch | null)[]
): PendingMatch[] {
  return courts.filter((m): m is PendingMatch => m !== null);
}

// Simulate upcoming matches from the queue without advancing state.
// Uses accumulating exclusions so each slot picks a different set of players.
export function fillQueue(
  queue: string[],
  players: Player[],
  history: CompletedMatch[],
  courts: (PendingMatch | null)[],
  skillBased = false,
  lockedPairs: [string, string][] = []
): PendingMatch[] {
  const active = activeCourtMatches(courts);
  if (active.length === 0) return [];

  const result: PendingMatch[] = [];
  for (let i = 0; i < QUEUE_SIZE; i++) {
    const match = generateMatch(queue, players, history, active, result, skillBased, lockedPairs);
    if (!match) break;
    result.push(match);
  }
  return result;
}

export function resizeCourts(
  courts: (PendingMatch | null)[],
  desired: number
): (PendingMatch | null)[] {
  const out = [...courts];
  while (out.length < desired) out.push(null);
  return out.slice(0, desired);
}
