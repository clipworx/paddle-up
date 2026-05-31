import {
  CompletedMatch,
  PendingMatch,
  Player,
  SKILL_LEVELS,
  Team,
  isActive,
} from "./types";

type PairKey = string;
type MatchLike = { readonly teamA: Team; readonly teamB: Team };

function pairKey(a: string, b: string): PairKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

type Stats = {
  partnerCount: Map<PairKey, number>;
  opponentCount: Map<PairKey, number>;
};

function buildStats(players: Player[], matches: readonly MatchLike[]): Stats {
  const partnerCount = new Map<PairKey, number>();
  const opponentCount = new Map<PairKey, number>();

  const inc = (map: Map<PairKey, number>, a: string, b: string) => {
    const k = pairKey(a, b);
    map.set(k, (map.get(k) ?? 0) + 1);
  };

  for (const m of matches) {
    inc(partnerCount, m.teamA[0], m.teamA[1]);
    inc(partnerCount, m.teamB[0], m.teamB[1]);
    for (const a of m.teamA) for (const b of m.teamB) inc(opponentCount, a, b);
  }

  return { partnerCount, opponentCount };
}

function skillDiff(a: Player, b: Player): number {
  return Math.abs(SKILL_LEVELS.indexOf(a.skill) - SKILL_LEVELS.indexOf(b.skill));
}

type Arrangement = { teamA: [Player, Player]; teamB: [Player, Player] };

function arrangements(four: Player[]): Arrangement[] {
  const [p0, p1, p2, p3] = four;
  return [
    { teamA: [p0, p1], teamB: [p2, p3] },
    { teamA: [p0, p2], teamB: [p1, p3] },
    { teamA: [p0, p3], teamB: [p1, p2] },
  ];
}

function scoreArrangement(
  arr: Arrangement,
  stats: Stats,
  skillMode: boolean,
  lockedPairs: [string, string][] = []
): number {
  const partnersA = stats.partnerCount.get(pairKey(arr.teamA[0].id, arr.teamA[1].id)) ?? 0;
  const partnersB = stats.partnerCount.get(pairKey(arr.teamB[0].id, arr.teamB[1].id)) ?? 0;
  let score = 0;
  if (partnersA === 0) score += 10;
  if (partnersB === 0) score += 10;
  score -= partnersA + partnersB;

  for (const a of arr.teamA) {
    for (const b of arr.teamB) {
      const c = stats.opponentCount.get(pairKey(a.id, b.id)) ?? 0;
      if (c === 0) score += 5;
      score -= c;
    }
  }

  if (skillMode) {
    const avg = (t: [Player, Player]) =>
      (SKILL_LEVELS.indexOf(t[0].skill) + SKILL_LEVELS.indexOf(t[1].skill)) / 2;
    score -= Math.abs(avg(arr.teamA) - avg(arr.teamB)) * 3;
  }

  for (const [a, b] of lockedPairs) {
    const teamAIds = new Set([arr.teamA[0].id, arr.teamA[1].id]);
    const teamBIds = new Set([arr.teamB[0].id, arr.teamB[1].id]);
    score += (teamAIds.has(a) && teamAIds.has(b)) || (teamBIds.has(a) && teamBIds.has(b))
      ? 100
      : -200;
  }

  return score;
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

// Move played players to the back of the queue, preserving their relative order.
export function advanceQueue(queue: string[], playedIds: string[]): string[] {
  const playedSet = new Set(playedIds);
  const remaining = queue.filter((id) => !playedSet.has(id));
  const playedInOrder = queue.filter((id) => playedSet.has(id));
  return [...remaining, ...playedInOrder];
}

export function generateMatch(
  queue: string[],
  players: Player[],
  history: CompletedMatch[],
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
  const stats = buildStats(players, [...history, ...activeMatches, ...upcoming]);

  // Locked pair must always be on the same team
  const lockedInFour = lockedPairs.find(
    ([a, b]) => pickedIds.includes(a) && pickedIds.includes(b)
  );

  let opts: Arrangement[];
  if (lockedInFour) {
    const [idA, idB] = lockedInFour;
    const pA = playerMap.get(idA)!;
    const pB = playerMap.get(idB)!;
    const others = four.filter((p) => p.id !== idA && p.id !== idB);
    opts = [
      { teamA: [pA, pB], teamB: [others[0], others[1]] },
      { teamA: [others[0], others[1]], teamB: [pA, pB] },
    ];
  } else {
    opts = arrangements(four);
  }

  let best = opts[0];
  let bestScore = -Infinity;
  for (const opt of opts) {
    const s = scoreArrangement(opt, stats, skillBased, lockedPairs);
    if (s > bestScore) {
      bestScore = s;
      best = opt;
    }
  }

  return {
    id: crypto.randomUUID(),
    teamA: [best.teamA[0].id, best.teamA[1].id],
    teamB: [best.teamB[0].id, best.teamB[1].id],
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
