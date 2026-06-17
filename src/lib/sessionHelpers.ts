import { generateMatch, advanceQueue } from "./rotation";
import { CompletedMatch, PendingMatch, Player, SkillTier, skillTier } from "./types";

export { advanceQueue };

export const QUEUE_SIZE = 3;

export function activeCourtMatches(
  courts: (PendingMatch | null)[]
): PendingMatch[] {
  return courts.filter((m): m is PendingMatch => m !== null);
}

// Returns the tier that is most "behind" proportionally so match frequency
// stays fair regardless of how many players are in each tier.
// Tie (equal rates) goes to the larger group to avoid starving it early on.
export function pickNextTier(
  casualPlayers: Player[],
  competitivePlayers: Player[],
  casualMatchCount: number,
  competitiveMatchCount: number,
): SkillTier {
  if (casualPlayers.length === 0) return "competitive";
  if (competitivePlayers.length === 0) return "casual";
  const casualRate = casualMatchCount / casualPlayers.length;
  const competitiveRate = competitiveMatchCount / competitivePlayers.length;
  return casualRate <= competitiveRate ? "casual" : "competitive";
}

// Simulate upcoming matches from the queue without advancing state.
// Uses accumulating exclusions so each slot picks a different set of players.
// When competitiveQueue is provided (skill separation mode), schedules tiers
// proportionally to player count so every player waits the same number of games.
export function fillQueue(
  queue: string[],
  players: Player[],
  history: CompletedMatch[],
  courts: (PendingMatch | null)[],
  skillBased = false,
  lockedPairs: [string, string][] = [],
  competitiveQueue?: string[],
  casualMatchCount = 0,
  competitiveMatchCount = 0,
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

  const casualPlayers = players.filter((p) => skillTier(p.skill) === "casual");
  const competitivePlayers = players.filter((p) => skillTier(p.skill) === "competitive");
  const exhausted = new Set<SkillTier>();
  let cmc = casualMatchCount;
  let compmc = competitiveMatchCount;

  while (result.length < QUEUE_SIZE && exhausted.size < 2) {
    const preferred = pickNextTier(casualPlayers, competitivePlayers, cmc, compmc);
    const tier = exhausted.has(preferred)
      ? (preferred === "casual" ? "competitive" : "casual")
      : preferred;
    if (exhausted.has(tier)) break;
    const tierQ = tier === "casual" ? queue : competitiveQueue;
    const fillQ = tier === "casual" ? competitiveQueue : queue;
    // Always pass the full player list so cross-tier locked partners are visible
    // to pickNextFour. The queue itself controls priority ordering.
    const match =
      generateMatch(tierQ, players, history, active, result, skillBased, lockedPairs) ??
      generateMatch([...tierQ, ...fillQ], players, history, active, result, skillBased, lockedPairs);
    if (!match) {
      exhausted.add(tier);
    } else {
      result.push(match);
      // If the match pulled players from both tiers, increment both counts
      const isMixed = [...match.teamA, ...match.teamB].some((id) => {
        const p = players.find((pl) => pl.id === id);
        return p ? skillTier(p.skill) !== tier : false;
      });
      if (isMixed) { cmc++; compmc++; }
      else if (tier === "casual") cmc++; else compmc++;
    }
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
