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

// How many completed matches had idA and idB on the same team — used to
// prefer team splits that give players new partners instead of repeating
// the same pairing every time the same foursome comes up together.
function partnerRepeatCount(history: CompletedMatch[], idA: string, idB: string): number {
  let count = 0;
  for (const m of history) {
    if (
      (m.teamA.includes(idA) && m.teamA.includes(idB)) ||
      (m.teamB.includes(idA) && m.teamB.includes(idB))
    ) {
      count++;
    }
  }
  return count;
}

// A group of 4 is "exhausted" once all 3 possible internal pairings have
// already happened — there's no arrangement left where both teams are fresh.
function isGroupExhausted(four: Player[], history: CompletedMatch[]): boolean {
  for (const opt of arrangements(four)) {
    const repeats =
      partnerRepeatCount(history, opt.teamA[0].id, opt.teamA[1].id) +
      partnerRepeatCount(history, opt.teamB[0].id, opt.teamB[1].id);
    if (repeats === 0) return false;
  }
  return true;
}

// How many of the most recently completed matches to protect candidates
// from being swapped into. Just 1: for sequential single-court play, that's
// the match that was just appended to history as part of this same
// generation step — exactly the "don't play twice in a row" case. A wider
// window looks safer for multi-court at first glance, but for a single
// court it means "N rounds back," not "N simultaneous courts" — at 12
// players, a window of 4 rounds back already touches nearly the whole
// roster, leaving no safe swap candidates at all (confirmed by testing
// against the real implementation: 0 swaps ever fired). Concurrently
// active players are already excluded separately via `excluded`.
const SWAP_SAFETY_WINDOW = 1;

// Once a selected foursome has used up every internal pairing (no fresh
// arrangement left), swap the 2 least-senior members for 2 fresh players
// further in the queue so the group doesn't just start repeating. Bounded
// and safe by construction:
//  - Only ever swaps out the LEAST-senior 2 of the 4 — the most-senior 2
//    (who've waited longest) always get to play.
//  - Candidates must not have played in one of the last few completed
//    matches, so nobody plays twice in a row because of a swap.
//  - Locked pairs are left alone entirely — they only ever have one valid
//    arrangement, so "exhausted" doesn't meaningfully apply to them.
//  - If no safe candidates exist (e.g. exactly 2 groups' worth of players
//    and no one else is free), no swap happens — a repeat is unavoidable
//    and forcing a swap would only risk a back-to-back repeat instead.
// Displaced players are returned so the caller can move them to the front
// of the queue, guaranteeing they play next round — the only fairness cost.
function applyGroupSwap(
  pickedIds: string[],
  queue: string[],
  players: Player[],
  history: CompletedMatch[],
  lockedPairs: [string, string][],
  excluded: Set<string>,
  enforceSkillWindow: boolean
): { pickedIds: string[]; displaced: string[] } {
  if (pickedIds.length < 4) return { pickedIds, displaced: [] };
  if (lockedPairs.some(([a, b]) => pickedIds.includes(a) && pickedIds.includes(b))) {
    return { pickedIds, displaced: [] };
  }

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const four = pickedIds.map((id) => playerMap.get(id)!);
  if (!isGroupExhausted(four, history)) return { pickedIds, displaced: [] };

  const recent = history.slice(-SWAP_SAFETY_WINDOW);
  const blocked = new Set<string>([...excluded, ...pickedIds]);
  for (const m of recent) for (const id of [...m.teamA, ...m.teamB]) blocked.add(id);

  const lockedMap = new Map<string, string>();
  for (const [a, b] of lockedPairs) {
    lockedMap.set(a, b);
    lockedMap.set(b, a);
  }

  const keep = pickedIds.slice(0, 2);
  const swappedOut = pickedIds.slice(2, 4);
  const windowIndices = keep.map((id) => SKILL_LEVELS.indexOf(playerMap.get(id)!.skill));

  const bringIn: string[] = [];
  for (const id of queue) {
    if (bringIn.length >= 2) break;
    if (blocked.has(id) || bringIn.includes(id)) continue;
    const player = playerMap.get(id);
    if (!player || !isActive(player)) continue;
    if (lockedMap.has(id)) continue; // don't pull in half of a locked pair via swap
    if (enforceSkillWindow) {
      const idx = SKILL_LEVELS.indexOf(player.skill);
      const trial = [...windowIndices, idx];
      if (Math.max(...trial) - Math.min(...trial) > 2) continue;
      windowIndices.push(idx);
    }
    bringIn.push(id);
  }

  if (bringIn.length < 2) return { pickedIds, displaced: [] };
  return { pickedIds: [...keep, ...bringIn], displaced: swappedOut };
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

// Like pickNextFour, but only accepts a candidate if adding them keeps the
// tentatively-picked group's skill levels mutually within 2 (max-min index
// gap <= 2 on SKILL_LEVELS) — every pair on court stays within the promised
// gap, not just "within 2 of whoever happened to be first" (gap isn't
// transitive, so that weaker rule could still seat two players 3+ levels
// apart).
//
// Tries each queue position in turn as the window's "seed" (the player the
// window is built around), scanning the whole queue for compatible
// additions each time. This matters: if the very first eligible player in
// queue were always treated as the fixed seed, one skill outlier sitting at
// the front would permanently anchor an unfillable window and deadlock the
// ENTIRE queue, not just themselves. Trying successive seeds means an
// incompatible player is skipped (they remain queued, reconsidered next
// time) while everyone else still gets matched normally.
export function pickSkillWindowFour(
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

  const isEligible = (id: string) => {
    if (excluded.has(id)) return false;
    const p = playerMap.get(id);
    return !!p && isActive(p);
  };

  for (let seedIdx = 0; seedIdx < queue.length; seedIdx++) {
    const seedId = queue[seedIdx];
    if (!isEligible(seedId)) continue;

    const result: string[] = [];
    const pulled = new Set<string>();
    const pickedIndices: number[] = [];
    const fitsWindow = (extra: number[]) => {
      const all = [...pickedIndices, ...extra];
      return Math.max(...all) - Math.min(...all) <= 2;
    };

    const tryAdd = (id: string): boolean => {
      if (pulled.has(id) || !isEligible(id)) return false;
      const player = playerMap.get(id)!;
      const idIndex = SKILL_LEVELS.indexOf(player.skill);

      const partnerId = lockedMap.get(id);
      if (partnerId) {
        const partner = playerMap.get(partnerId);
        const partnerActive = partner && isActive(partner);
        if (partnerActive && excluded.has(partnerId)) return false; // wait together
        if (partnerActive && !pulled.has(partnerId)) {
          if (result.length + 2 > 4) return false;
          const partnerIndex = SKILL_LEVELS.indexOf(partner!.skill);
          if (!fitsWindow([idIndex, partnerIndex])) return false;
          result.push(id, partnerId);
          pulled.add(id);
          pulled.add(partnerId);
          pickedIndices.push(idIndex, partnerIndex);
          return true;
        }
      }

      if (!fitsWindow([idIndex])) return false;
      result.push(id);
      pulled.add(id);
      pickedIndices.push(idIndex);
      return true;
    };

    tryAdd(seedId);
    for (const id of queue) {
      if (result.length >= 4) break;
      if (id === seedId) continue;
      tryAdd(id);
    }

    if (result.length >= 4) return result.slice(0, 4);
  }

  return [];
}

// Advance the rotation queue after a match completes: the just-played group
// goes to the absolute back, so the queue is a strict FIFO of "longest since
// last played". This is the simplest rule that's correct at any scale —
// nobody plays twice in a row (unless there genuinely aren't enough rested
// players to avoid it), wait time stays even across 200+ players, and a
// newly-added player inserted at the front gets picked up immediately.
export function advanceQueue(queue: string[], playedIds: string[]): string[] {
  const playedSet = new Set(playedIds);
  const remaining = queue.filter((id) => !playedSet.has(id));
  const playedInOrder = queue.filter((id) => playedSet.has(id));
  return [...remaining, ...playedInOrder];
}

export type GenerateMatchResult = {
  match: PendingMatch | null;
  // Players bumped out by a group swap (see applyGroupSwap) — empty unless
  // a swap happened. Caller should move these to the front of whichever
  // queue they came from so they're guaranteed to play next round.
  displaced: string[];
};

// Team arrangement prefers whichever split gives players the fewest repeat
// partners (using match history); ties are broken by skill balance when
// skillBased is on, or by queue order otherwise. Locked pairs always end up
// on the same team regardless of either.
export function generateMatch(
  queue: string[],
  players: Player[],
  history: CompletedMatch[],
  activeMatches: readonly MatchLike[] = [],
  upcoming: readonly PendingMatch[] = [],
  skillBased = false,
  lockedPairs: [string, string][] = [],
  pickFour: typeof pickNextFour = pickNextFour
): GenerateMatchResult {
  const excluded = new Set<string>();
  for (const m of activeMatches)
    for (const id of [...m.teamA, ...m.teamB]) excluded.add(id);
  for (const m of upcoming)
    for (const id of [...m.teamA, ...m.teamB]) excluded.add(id);

  // Prefer to also exclude whoever played the most recently completed match.
  // Normally a no-op (advanceQueue already pushes them to the back, out of
  // pickFour's reach), but pickSkillWindowFour can scan deep into the queue
  // when skill bands are clustered unevenly — without this, a displaced
  // skill outlier (moved to the front by a group swap) can become the next
  // seed and reach all the way back to someone who just played. Falls back
  // to the lenient set if that leaves fewer than 4 players, so a forced
  // repeat is still possible when there's truly no alternative.
  const lastMatch = history[history.length - 1];
  let pickedIds: string[] = [];
  if (lastMatch) {
    const strictExcluded = new Set([...excluded, ...lastMatch.teamA, ...lastMatch.teamB]);
    pickedIds = pickFour(queue, players, lockedPairs, strictExcluded);
  }
  if (pickedIds.length < 4) {
    pickedIds = pickFour(queue, players, lockedPairs, excluded);
  }
  if (pickedIds.length < 4) return { match: null, displaced: [] };

  const swapResult = applyGroupSwap(
    pickedIds, queue, players, history, lockedPairs, excluded, pickFour === pickSkillWindowFour
  );
  pickedIds = swapResult.pickedIds;
  const displaced = swapResult.displaced;

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
  } else {
    const avg = (t: [Player, Player]) =>
      (SKILL_LEVELS.indexOf(t[0].skill) + SKILL_LEVELS.indexOf(t[1].skill)) / 2;
    let best = arrangements(four)[0];
    let bestRepeats = Infinity;
    let bestSkillDiff = Infinity;
    for (const opt of arrangements(four)) {
      const repeats =
        partnerRepeatCount(history, opt.teamA[0].id, opt.teamA[1].id) +
        partnerRepeatCount(history, opt.teamB[0].id, opt.teamB[1].id);
      const skillDiff = skillBased ? Math.abs(avg(opt.teamA) - avg(opt.teamB)) : 0;
      if (repeats < bestRepeats || (repeats === bestRepeats && skillDiff < bestSkillDiff)) {
        best = opt;
        bestRepeats = repeats;
        bestSkillDiff = skillDiff;
      }
    }
    teamA = [best.teamA[0].id, best.teamA[1].id];
    teamB = [best.teamB[0].id, best.teamB[1].id];
  }

  return {
    match: {
      id: crypto.randomUUID(),
      teamA,
      teamB,
      serving: "A",
      serverNumber: 2,
      liveScoreA: 0,
      liveScoreB: 0,
      createdAt: Date.now(),
    },
    displaced,
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
