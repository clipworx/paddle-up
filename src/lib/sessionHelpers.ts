import { generateMatch, advanceQueue } from "./rotation";
import { CompletedMatch, PendingMatch, Player, SkillTier, skillTier } from "./types";

export { advanceQueue };

export const QUEUE_SIZE = 3;

export function activeCourtMatches(
  courts: (PendingMatch | null)[]
): PendingMatch[] {
  return courts.filter((m): m is PendingMatch => m !== null);
}

// Simulate upcoming matches from the queue without advancing state.
// Uses accumulating exclusions so each slot picks a different set of players.
// When competitiveQueue is provided (skill separation mode), alternates between tiers.
export function fillQueue(
  queue: string[],
  players: Player[],
  history: CompletedMatch[],
  courts: (PendingMatch | null)[],
  skillBased = false,
  lockedPairs: [string, string][] = [],
  competitiveQueue?: string[],
): PendingMatch[] {
  const active = activeCourtMatches(courts);
  if (active.length === 0) return [];

  const result: PendingMatch[] = [];

  if (!competitiveQueue) {
    for (let i = 0; i < QUEUE_SIZE; i++) {
      const match = generateMatch(queue, players, history, active, result, skillBased, lockedPairs);
      if (!match) break;
      result.push(match);
    }
    return result;
  }

  // Two-queue mode: alternate between tiers.
  // With exactly 1 court configured and a match active, start with the opposite
  // of what's currently playing so the upcoming queue always shows the next tier.
  let startTier: SkillTier = "casual";
  if (courts.length === 1 && active.length === 1) {
    const p = players.find((pl) => pl.id === active[0].teamA[0]);
    const activeTier = p ? skillTier(p.skill) : "casual";
    startTier = activeTier === "casual" ? "competitive" : "casual";
  }

  const casualPlayers = players.filter((p) => skillTier(p.skill) === "casual");
  const competitivePlayers = players.filter((p) => skillTier(p.skill) === "competitive");
  const tiers: SkillTier[] = startTier === "competitive"
    ? ["competitive", "casual"]
    : ["casual", "competitive"];
  let tierIdx = 0;
  const exhausted = new Set<SkillTier>();

  while (result.length < QUEUE_SIZE && exhausted.size < 2) {
    const tier = tiers[tierIdx % 2];
    tierIdx++;
    if (exhausted.has(tier)) continue;
    const tierQueue = tier === "casual" ? queue : competitiveQueue;
    const tierPlayers = tier === "casual" ? casualPlayers : competitivePlayers;
    const match = generateMatch(tierQueue, tierPlayers, history, active, result, skillBased, lockedPairs);
    if (!match) exhausted.add(tier);
    else result.push(match);
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
