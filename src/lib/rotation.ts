import {
  CompletedMatch,
  PendingMatch,
  Player,
  SKILL_LEVELS,
  Team,
  isActive,
} from "./types";

type MatchLike = { readonly teamA: Team; readonly teamB: Team };

type Arrangement = { teamA: [Player, Player]; teamB: [Player, Player] };

function arrangements(four: Player[]): Arrangement[] {
  const [p0, p1, p2, p3] = four;
  return [
    { teamA: [p0, p1], teamB: [p2, p3] },
    { teamA: [p0, p2], teamB: [p1, p3] },
    { teamA: [p0, p3], teamB: [p1, p2] },
  ];
}

// Pick the next up-to-4 player IDs from the rotation queue.
// Locked pairs are pulled in together: when one partner is encountered the other
// is immediately included (even if they appear later in the queue). If one
// partner is excluded (e.g. on court), the other is also skipped so they always
// sit out and return together. If one partner is inactive the active one plays freely.
export function pickNextFour(
  queue: string[],
  players: Player[],
  lockedPairs: [string, string][],
  excluded: Set<string>
): string[] {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const lockedMap = new Map<string, string>();
  for (const [a, b] of lockedPairs) {
    lockedMap.set(a, b);
    lockedMap.set(b, a);
  }

  const result: string[] = [];
  const pulled = new Set<string>();

  for (const id of queue) {
    if (result.length >= 4) break;
    if (excluded.has(id) || pulled.has(id)) continue;

    const player = playerMap.get(id);
    if (!player || !isActive(player)) continue;

    const partnerId = lockedMap.get(id);
    if (partnerId) {
      const partner = playerMap.get(partnerId);
      const partnerActive = partner && isActive(partner);

      if (partnerActive && excluded.has(partnerId)) {
        // Partner is active but on court / just played — skip both, they wait together
        continue;
      }
      if (partnerActive && !pulled.has(partnerId)) {
        // Pull both in together
        result.push(id, partnerId);
        pulled.add(id);
        pulled.add(partnerId);
        continue;
      }
    }

    result.push(id);
    pulled.add(id);
  }

  return result;
}

// Advance the rotation queue after a match.
// "append"    — played players go to the back so waiting players play first.
// "interleave" — played players are woven back in so groups are reshuffled.
// Callers alternate between the two phases so waiting players always play
// before recently-played ones return, and groups change every other cycle.
export function advanceQueue(
  queue: string[],
  playedIds: string[],
  phase: "append" | "interleave" = "interleave"
): string[] {
  const playedSet = new Set(playedIds);
  const remaining = queue.filter((id) => !playedSet.has(id));
  const playedInOrder = queue.filter((id) => playedSet.has(id));
  if (phase === "append") {
    return [...remaining, ...playedInOrder];
  }
  const result: string[] = [];
  const maxLen = Math.max(remaining.length, playedInOrder.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < remaining.length) result.push(remaining[i]);
    if (i < playedInOrder.length) result.push(playedInOrder[i]);
  }
  return result;
}

// Team arrangement is determined purely by queue order.
// When skillBased is on, pick the split that most evenly balances skill levels.
// Locked pairs always end up on the same team regardless.
export function generateMatch(
  queue: string[],
  players: Player[],
  _history: CompletedMatch[],
  activeMatches: readonly MatchLike[] = [],
  upcoming: readonly PendingMatch[] = [],
  skillBased = false,
  lockedPairs: [string, string][] = []
): PendingMatch | null {
  const excluded = new Set<string>();
  for (const m of activeMatches)
    for (const id of [...m.teamA, ...m.teamB]) excluded.add(id);
  for (const m of upcoming)
    for (const id of [...m.teamA, ...m.teamB]) excluded.add(id);

  const pickedIds = pickNextFour(queue, players, lockedPairs, excluded);
  if (pickedIds.length < 4) return null;

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const four = pickedIds.map((id) => playerMap.get(id)!);

  const lockedInFour = lockedPairs.find(
    ([a, b]) => pickedIds.includes(a) && pickedIds.includes(b)
  );

  let teamA: [string, string];
  let teamB: [string, string];

  if (lockedInFour) {
    const [idA, idB] = lockedInFour;
    const others = four.filter((p) => p.id !== idA && p.id !== idB);
    teamA = [idA, idB];
    teamB = [others[0].id, others[1].id];
  } else if (skillBased) {
    const avg = (t: [Player, Player]) =>
      (SKILL_LEVELS.indexOf(t[0].skill) + SKILL_LEVELS.indexOf(t[1].skill)) / 2;
    let best = arrangements(four)[0];
    let bestDiff = Infinity;
    for (const opt of arrangements(four)) {
      const diff = Math.abs(avg(opt.teamA) - avg(opt.teamB));
      if (diff < bestDiff) { bestDiff = diff; best = opt; }
    }
    teamA = [best.teamA[0].id, best.teamA[1].id];
    teamB = [best.teamB[0].id, best.teamB[1].id];
  } else {
    teamA = [four[0].id, four[1].id];
    teamB = [four[2].id, four[3].id];
  }

  return {
    id: crypto.randomUUID(),
    teamA,
    teamB,
    serving: "A",
    serverNumber: 2,
    liveScoreA: 0,
    liveScoreB: 0,
    createdAt: Date.now(),
  };
}

export type PlayerStats = {
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

export function computePlayerStats(
  players: Player[],
  history: CompletedMatch[]
): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();
  for (const p of players) {
    stats.set(p.id, { games: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
  }
  for (const m of history) {
    const aWon = m.winner === "A";
    const tied = m.winner === "tie";
    for (const id of m.teamA) {
      const s = stats.get(id);
      if (!s) continue;
      s.games += 1;
      if (m.scoreA !== undefined) s.pointsFor += m.scoreA;
      if (m.scoreB !== undefined) s.pointsAgainst += m.scoreB;
      if (!tied) { if (aWon) s.wins += 1; else s.losses += 1; }
    }
    for (const id of m.teamB) {
      const s = stats.get(id);
      if (!s) continue;
      s.games += 1;
      if (m.scoreB !== undefined) s.pointsFor += m.scoreB;
      if (m.scoreA !== undefined) s.pointsAgainst += m.scoreA;
      if (!tied) { if (!aWon) s.wins += 1; else s.losses += 1; }
    }
  }
  return stats;
}
