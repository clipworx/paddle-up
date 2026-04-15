import {
  CompletedMatch,
  PendingMatch,
  Player,
  SKILL_LEVELS,
  SkillTier,
  Team,
  isActive,
  skillTier,
} from "./types";

type PairKey = string;
type MatchLike = { readonly teamA: Team; readonly teamB: Team };

function pairKey(a: string, b: string): PairKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

type Stats = {
  gamesPlayed: Map<string, number>;
  partnerCount: Map<PairKey, number>;
  opponentCount: Map<PairKey, number>;
};

function buildStats(players: Player[], matches: readonly MatchLike[]): Stats {
  const gamesPlayed = new Map<string, number>();
  const partnerCount = new Map<PairKey, number>();
  const opponentCount = new Map<PairKey, number>();

  for (const p of players) gamesPlayed.set(p.id, 0);

  for (const m of matches) {
    const ids = [...m.teamA, ...m.teamB];
    for (const id of ids) {
      if (gamesPlayed.has(id)) {
        gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1);
      }
    }
    const inc = (map: Map<PairKey, number>, a: string, b: string) => {
      const k = pairKey(a, b);
      map.set(k, (map.get(k) ?? 0) + 1);
    };
    inc(partnerCount, m.teamA[0], m.teamA[1]);
    inc(partnerCount, m.teamB[0], m.teamB[1]);
    for (const a of m.teamA) for (const b of m.teamB) inc(opponentCount, a, b);
  }

  return { gamesPlayed, partnerCount, opponentCount };
}

function tierGroups(players: Player[]): Map<SkillTier, Player[]> {
  const groups = new Map<SkillTier, Player[]>();
  for (const p of players) {
    const tier = skillTier(p.skill);
    const list = groups.get(tier) ?? [];
    list.push(p);
    groups.set(tier, list);
  }
  return groups;
}

function coverageCompleteInPool(
  pool: Player[],
  stats: Stats
): boolean {
  if (pool.length < 4) return false;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const k = pairKey(pool[i].id, pool[j].id);
      if ((stats.partnerCount.get(k) ?? 0) === 0) return false;
      if ((stats.opponentCount.get(k) ?? 0) === 0) return false;
    }
  }
  return true;
}

export function isCoverageComplete(
  players: Player[],
  history: CompletedMatch[],
  skillSeparation = false
): boolean {
  const active = players.filter(isActive);
  if (active.length < 4) return false;
  const stats = buildStats(players, history);
  if (!skillSeparation) {
    return coverageCompleteInPool(active, stats);
  }
  // In separated mode, coverage is per-tier: if ANY tier with >=4 players
  // has full same-tier coverage, skill-balancing kicks in for that tier.
  const groups = tierGroups(active);
  let anyTierEligible = false;
  for (const pool of groups.values()) {
    if (pool.length < 4) continue;
    anyTierEligible = true;
    if (!coverageCompleteInPool(pool, stats)) return false;
  }
  return anyTierEligible;
}

function skillDiff(a: Player, b: Player): number {
  const ia = SKILL_LEVELS.indexOf(a.skill);
  const ib = SKILL_LEVELS.indexOf(b.skill);
  return Math.abs(ia - ib);
}

function pickFourPlayers(
  players: Player[],
  stats: Stats,
  skillMode: boolean,
  excluded: Set<string>
): Player[] {
  const available = players.filter((p) => !excluded.has(p.id));
  const pool = available.length >= 4 ? available : players;

  const sorted = [...pool].sort((a, b) => {
    const ga = stats.gamesPlayed.get(a.id) ?? 0;
    const gb = stats.gamesPlayed.get(b.id) ?? 0;
    if (ga !== gb) return ga - gb;
    return Math.random() - 0.5;
  });

  if (!skillMode || sorted.length <= 4) return sorted.slice(0, 4);

  const minGames = stats.gamesPlayed.get(sorted[0].id) ?? 0;
  const eligible = sorted.filter(
    (p) => (stats.gamesPlayed.get(p.id) ?? 0) <= minGames + 1
  );
  if (eligible.length < 4) return sorted.slice(0, 4);

  let best: Player[] | null = null;
  let bestSpread = Infinity;
  const combos = kCombinations(eligible, 4);
  for (const combo of combos) {
    const spread = combo.reduce((acc, p, i) => {
      for (let j = i + 1; j < combo.length; j++) acc += skillDiff(p, combo[j]);
      return acc;
    }, 0);
    if (spread < bestSpread) {
      bestSpread = spread;
      best = combo;
    }
  }
  return best ?? sorted.slice(0, 4);
}

function kCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  const withHead = kCombinations(tail, k - 1).map((c) => [head, ...c]);
  const withoutHead = kCombinations(tail, k);
  return [...withHead, ...withoutHead];
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

function scoreArrangement(arr: Arrangement, stats: Stats, skillMode: boolean): number {
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
    const gap = Math.abs(avg(arr.teamA) - avg(arr.teamB));
    score -= gap * 3;
  }

  return score;
}

function pickTargetTierPool(
  activePlayers: Player[],
  stats: Stats,
  excluded: Set<string>
): Player[] {
  // Pick the tier with the least-played available player.
  const groups = tierGroups(activePlayers);
  let bestPool: Player[] | null = null;
  let bestMinGames = Infinity;
  for (const pool of groups.values()) {
    const available = pool.filter((p) => !excluded.has(p.id));
    const source = available.length >= 4 ? available : pool;
    if (source.length < 4) continue;
    const minGames = Math.min(
      ...source.map((p) => stats.gamesPlayed.get(p.id) ?? 0)
    );
    if (minGames < bestMinGames) {
      bestMinGames = minGames;
      bestPool = pool;
    }
  }
  return bestPool ?? [];
}

export function generateMatch(
  players: Player[],
  history: CompletedMatch[],
  activeMatches: readonly MatchLike[] = [],
  upcoming: readonly PendingMatch[] = [],
  skillSeparation = false
): PendingMatch | null {
  const activePlayers = players.filter(isActive);
  if (activePlayers.length < 4) return null;
  const scheduled: MatchLike[] = [...history, ...activeMatches, ...upcoming];
  const stats = buildStats(players, scheduled);
  const skillMode = isCoverageComplete(players, history, skillSeparation);

  const excluded = new Set<string>();
  for (const m of activeMatches) {
    for (const id of [...m.teamA, ...m.teamB]) excluded.add(id);
  }
  for (const m of upcoming) {
    for (const id of [...m.teamA, ...m.teamB]) excluded.add(id);
  }
  const lastCompleted = history[history.length - 1];
  if (lastCompleted) {
    for (const id of [...lastCompleted.teamA, ...lastCompleted.teamB])
      excluded.add(id);
  }

  const pool = skillSeparation
    ? pickTargetTierPool(activePlayers, stats, excluded)
    : activePlayers;
  if (pool.length < 4) return null;

  const four = pickFourPlayers(pool, stats, skillMode, excluded);
  if (four.length < 4) return null;

  const options = arrangements(four);
  let best = options[0];
  let bestScore = -Infinity;
  for (const opt of options) {
    const s = scoreArrangement(opt, stats, skillMode);
    if (s > bestScore) {
      bestScore = s;
      best = opt;
    }
  }

  const teamA: Team = [best.teamA[0].id, best.teamA[1].id];
  const teamB: Team = [best.teamB[0].id, best.teamB[1].id];
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

export function substituteInMatch(
  match: PendingMatch,
  oldId: string,
  players: Player[],
  history: CompletedMatch[],
  forbidden: Set<string>,
  skillSeparation = false
): PendingMatch | null {
  const taken = new Set<string>([...match.teamA, ...match.teamB]);
  const stats = buildStats(players, history);
  let tierLock: SkillTier | null = null;
  if (skillSeparation) {
    const remaining = [...match.teamA, ...match.teamB].find((id) => id !== oldId);
    const remainingPlayer = remaining
      ? players.find((p) => p.id === remaining)
      : undefined;
    if (remainingPlayer) tierLock = skillTier(remainingPlayer.skill);
  }
  const candidates = players
    .filter(
      (p) =>
        isActive(p) &&
        !taken.has(p.id) &&
        !forbidden.has(p.id) &&
        (tierLock === null || skillTier(p.skill) === tierLock)
    )
    .sort((a, b) => {
      const ga = stats.gamesPlayed.get(a.id) ?? 0;
      const gb = stats.gamesPlayed.get(b.id) ?? 0;
      if (ga !== gb) return ga - gb;
      return Math.random() - 0.5;
    });
  if (candidates.length === 0) return null;
  const replacementId = candidates[0].id;
  const replace = (team: Team): Team =>
    team.map((id) => (id === oldId ? replacementId : id)) as Team;
  return {
    ...match,
    teamA: replace(match.teamA),
    teamB: replace(match.teamB),
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
    const aWon = m.scoreA > m.scoreB;
    for (const id of m.teamA) {
      const s = stats.get(id);
      if (!s) continue;
      s.games += 1;
      s.pointsFor += m.scoreA;
      s.pointsAgainst += m.scoreB;
      if (aWon) s.wins += 1;
      else s.losses += 1;
    }
    for (const id of m.teamB) {
      const s = stats.get(id);
      if (!s) continue;
      s.games += 1;
      s.pointsFor += m.scoreB;
      s.pointsAgainst += m.scoreA;
      if (!aWon) s.wins += 1;
      else s.losses += 1;
    }
  }
  return stats;
}
