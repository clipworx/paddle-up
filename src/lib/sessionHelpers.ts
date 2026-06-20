import { generateMatch, advanceQueue, pickNextFour, pickSkillWindowFour, GenerateMatchResult } from "./rotation";
import {
  AppState,
  CompletedMatch,
  LadderPending,
  MatchingStyle,
  PendingMatch,
  Player,
  SkillTier,
  isActive,
  skillTier,
} from "./types";

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

function buildMatch(teamA: [string, string], teamB: [string, string]): PendingMatch {
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

// Winner/Loser Groups: try forming a match from winners first, then losers,
// then fall back to a combined pick so a court never sits empty just
// because one group is a few players short. Plain queue-order pairing —
// "winner plays winner" is already the fairness mechanism, no skill balancing.
function generateWinnerLoserMatch(
  winnerQueue: string[],
  loserQueue: string[],
  players: Player[],
  history: CompletedMatch[],
  activeCourts: PendingMatch[],
  upcoming: PendingMatch[],
  lockedPairs: [string, string][],
): GenerateMatchResult {
  let result = generateMatch(winnerQueue, players, history, activeCourts, upcoming, false, lockedPairs);
  if (result.match) return result;
  result = generateMatch(loserQueue, players, history, activeCourts, upcoming, false, lockedPairs);
  if (result.match) return result;
  return generateMatch([...winnerQueue, ...loserQueue], players, history, activeCourts, upcoming, false, lockedPairs);
}

type QueueFields = {
  queue?: string[];
  competitiveQueue?: string[];
  winnerQueue?: string[];
  loserQueue?: string[];
};

// Moves each displaced id (bumped by a group swap, see rotation.ts) to the
// front of whichever queue it's currently sitting in, guaranteeing it plays
// next round. Only returns the queue(s) that actually changed, so callers
// can spread the result over existing state without disturbing the rest.
function applyDisplaced(displaced: string[], queues: QueueFields): QueueFields {
  if (displaced.length === 0) return {};
  const updated: QueueFields = {};
  const keys = ["queue", "competitiveQueue", "winnerQueue", "loserQueue"] as const;
  for (const id of displaced) {
    for (const key of keys) {
      const current = updated[key] ?? queues[key];
      if (current && current.includes(id)) {
        updated[key] = [id, ...current.filter((x) => x !== id)];
        break;
      }
    }
  }
  return updated;
}

function withDisplaced(result: GenerateMatchResult, queues: QueueFields): GenerateForCourtResult {
  return { match: result.match, ...applyDisplaced(result.displaced, queues) };
}

// After a match completes under Winner/Loser Groups: pull the played ids out
// of wherever they currently sit (could be either queue from a prior round),
// then route winners to the back of winnerQueue and losers to the back of
// loserQueue. A tie sends both pairs to loserQueue — conservative default,
// a tie doesn't earn a promotion to "winners".
export function advanceWinnerLoser(
  teamA: [string, string],
  teamB: [string, string],
  winner: "A" | "B" | "tie",
  winnerQueue: string[],
  loserQueue: string[],
): { winnerQueue: string[]; loserQueue: string[] } {
  const played = new Set([...teamA, ...teamB]);
  const wq = winnerQueue.filter((id) => !played.has(id));
  const lq = loserQueue.filter((id) => !played.has(id));

  if (winner === "tie") {
    return { winnerQueue: wq, loserQueue: [...lq, ...teamA, ...teamB] };
  }
  const winners = winner === "A" ? teamA : teamB;
  const losers = winner === "A" ? teamB : teamA;
  return { winnerQueue: [...wq, ...winners], loserQueue: [...lq, ...losers] };
}

// ─── King/Queen of the Court ───────────────────────────────────────────────
// Court index IS the rank (0 = top court). After a match on court K:
// winners are recorded as pending promotion into court K-1 (or court K
// itself if K is already the top — i.e. they keep their seat); losers are
// recorded as pending relegation into court K+1, or sent back to the
// general challenger queue if K is the bottom court. A tie earns neither —
// both pairs return to the challenger queue.
export function advanceLadder(
  courtIndex: number,
  courtCount: number,
  teamA: [string, string],
  teamB: [string, string],
  winner: "A" | "B" | "tie",
  ladderPending: LadderPending,
  ladderQueue: string[],
): { ladderPending: LadderPending; ladderQueue: string[] } {
  const promote: Record<number, [string, string][]> = { ...ladderPending.promote };
  const relegate: Record<number, [string, string][]> = { ...ladderPending.relegate };

  if (winner === "tie") {
    return {
      ladderPending: { promote, relegate },
      ladderQueue: [...ladderQueue, ...teamA, ...teamB],
    };
  }

  const winners = (winner === "A" ? teamA : teamB) as [string, string];
  const losers = (winner === "A" ? teamB : teamA) as [string, string];

  if (courtCount === 1) {
    promote[0] = [...(promote[0] ?? []), winners];
    return { ladderPending: { promote, relegate }, ladderQueue: [...ladderQueue, ...losers] };
  }

  const upTarget = Math.max(0, courtIndex - 1);
  promote[upTarget] = [...(promote[upTarget] ?? []), winners];

  let ladderQueueNext = ladderQueue;
  if (courtIndex === courtCount - 1) {
    ladderQueueNext = [...ladderQueue, ...losers];
  } else {
    const downTarget = Math.min(courtCount - 1, courtIndex + 1);
    relegate[downTarget] = [...(relegate[downTarget] ?? []), losers];
  }

  return { ladderPending: { promote, relegate }, ladderQueue: ladderQueueNext };
}

function popEligiblePair(
  pairs: [string, string][],
  excluded: Set<string>,
  playerMap: Map<string, Player>,
): { pair: [string, string] | null; remaining: [string, string][] } {
  const remaining = [...pairs];
  while (remaining.length > 0) {
    const [a, b] = remaining[0];
    const pa = playerMap.get(a);
    const pb = playerMap.get(b);
    const eligible =
      pa && isActive(pa) && !excluded.has(a) && pb && isActive(pb) && !excluded.has(b);
    remaining.shift();
    if (eligible) return { pair: [a, b], remaining };
    // ineligible pair (e.g. someone went inactive while pending) — drop and keep looking
  }
  return { pair: null, remaining };
}

// Fill a freed ladder court from, in priority order: (1) pending promotion
// into this court, (2) pending relegation into this court, (3) overflow
// from the general challenger queue — used by ANY court, not just the
// bottom, so a thin promotion/relegation pipeline never leaves a court
// dark. Pairs pulled from promote/relegate stay partnered as the unit they
// earned/lost together; only individuals pulled from the challenger queue
// overflow get paired by queue order.
export function refillLadderCourt(
  courtIndex: number,
  courtCount: number,
  ladderPending: LadderPending,
  ladderQueue: string[],
  players: Player[],
  activeCourts: PendingMatch[],
  upcoming: PendingMatch[],
  lockedPairs: [string, string][],
): { match: PendingMatch | null; ladderPending: LadderPending; ladderQueue: string[] } {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const excluded = new Set<string>();
  for (const m of activeCourts) for (const id of [...m.teamA, ...m.teamB]) excluded.add(id);
  for (const m of upcoming) for (const id of [...m.teamA, ...m.teamB]) excluded.add(id);

  const promote: Record<number, [string, string][]> = { ...ladderPending.promote };
  const relegate: Record<number, [string, string][]> = { ...ladderPending.relegate };
  let queue = [...ladderQueue];

  const units: [string, string][] = [];

  const fromPromote = popEligiblePair(promote[courtIndex] ?? [], excluded, playerMap);
  promote[courtIndex] = fromPromote.remaining;
  if (fromPromote.pair) units.push(fromPromote.pair);

  const fromRelegate = popEligiblePair(relegate[courtIndex] ?? [], excluded, playerMap);
  relegate[courtIndex] = fromRelegate.remaining;
  if (fromRelegate.pair) units.push(fromRelegate.pair);

  if (units.length < 2) {
    const neededIds = (2 - units.length) * 2;
    const alreadyUsed = new Set([...excluded, ...units.flat()]);
    const picked = pickNextFour(queue, players, lockedPairs, alreadyUsed).slice(0, neededIds);
    queue = queue.filter((id) => !picked.includes(id));
    for (let i = 0; i + 1 < picked.length; i += 2) {
      units.push([picked[i], picked[i + 1]]);
    }
  }

  if (units.length < 2) {
    return { match: null, ladderPending: { promote, relegate }, ladderQueue: queue };
  }

  return {
    match: buildMatch(units[0], units[1]),
    ladderPending: { promote, relegate },
    ladderQueue: queue,
  };
}

export function removeFromLadder(ladderPending: LadderPending, playerId: string): LadderPending {
  const scrub = (bucket: Record<number, [string, string][]>) =>
    Object.fromEntries(
      Object.entries(bucket).map(([courtIdx, pairs]) => [
        courtIdx,
        pairs.filter(([a, b]) => a !== playerId && b !== playerId),
      ])
    );
  return { promote: scrub(ladderPending.promote), relegate: scrub(ladderPending.relegate) };
}

// ─── Unified court-generation dispatch ─────────────────────────────────────
// Single source of truth for "what's the next match for this court," shared
// by manual Generate and the auto-refill after a match completes so the two
// paths can never drift out of sync. King/Queen additionally returns
// updated ladder state since filling its court consumes from the
// promotion/relegation buckets and challenger queue as part of the same
// operation (there's no separate "pick" then "advance" step for that style).
export type GenerateForCourtContext = {
  matchingStyle: MatchingStyle;
  courtIndex: number;
  courtCount: number;
  courtTier: SkillTier | null;
  queue: string[];
  competitiveQueue?: string[];
  winnerQueue?: string[];
  loserQueue?: string[];
  ladderPending?: LadderPending;
  ladderQueue?: string[];
  players: Player[];
  history: CompletedMatch[];
  activeCourts: PendingMatch[];
  upcoming: PendingMatch[];
  skillBased: boolean;
  lockedPairs: [string, string][];
  casualMatchCount: number;
  competitiveMatchCount: number;
};

export type GenerateForCourtResult = {
  match: PendingMatch | null;
  queue?: string[];
  competitiveQueue?: string[];
  winnerQueue?: string[];
  loserQueue?: string[];
  ladderPending?: LadderPending;
  ladderQueue?: string[];
};

export function generateForCourt(ctx: GenerateForCourtContext): GenerateForCourtResult {
  if (ctx.matchingStyle === "skill-courts") {
    if (ctx.courtTier) {
      const tierQueue = ctx.courtTier === "casual" ? ctx.queue : (ctx.competitiveQueue ?? []);
      const result = generateMatch(tierQueue, ctx.players, ctx.history, ctx.activeCourts, ctx.upcoming, ctx.skillBased, ctx.lockedPairs);
      return withDisplaced(result, { queue: ctx.queue, competitiveQueue: ctx.competitiveQueue });
    }
    const casualPlayers = ctx.players.filter((p) => skillTier(p.skill) === "casual");
    const competitivePlayers = ctx.players.filter((p) => skillTier(p.skill) === "competitive");
    const next = pickNextTier(casualPlayers, competitivePlayers, ctx.casualMatchCount, ctx.competitiveMatchCount);
    const tryOrder: SkillTier[] = [next, next === "casual" ? "competitive" : "casual"];
    for (const tier of tryOrder) {
      const tq = tier === "casual" ? ctx.queue : (ctx.competitiveQueue ?? []);
      const fillQ = tier === "casual" ? (ctx.competitiveQueue ?? []) : ctx.queue;
      let result = generateMatch(tq, ctx.players, ctx.history, ctx.activeCourts, ctx.upcoming, ctx.skillBased, ctx.lockedPairs);
      if (!result.match) {
        result = generateMatch([...tq, ...fillQ], ctx.players, ctx.history, ctx.activeCourts, ctx.upcoming, ctx.skillBased, ctx.lockedPairs);
      }
      if (result.match) return withDisplaced(result, { queue: ctx.queue, competitiveQueue: ctx.competitiveQueue });
    }
    return { match: null };
  }

  if (ctx.matchingStyle === "skill-separated") {
    const result = generateMatch(
      ctx.queue, ctx.players, ctx.history, ctx.activeCourts, ctx.upcoming, ctx.skillBased, ctx.lockedPairs, pickSkillWindowFour
    );
    return withDisplaced(result, { queue: ctx.queue });
  }

  if (ctx.matchingStyle === "winner-loser-groups") {
    const result = generateWinnerLoserMatch(
      ctx.winnerQueue ?? [], ctx.loserQueue ?? [], ctx.players, ctx.history, ctx.activeCourts, ctx.upcoming, ctx.lockedPairs
    );
    return withDisplaced(result, { winnerQueue: ctx.winnerQueue, loserQueue: ctx.loserQueue });
  }

  if (ctx.matchingStyle === "king-of-court") {
    const { match, ladderPending, ladderQueue } = refillLadderCourt(
      ctx.courtIndex,
      ctx.courtCount,
      ctx.ladderPending ?? { promote: {}, relegate: {} },
      ctx.ladderQueue ?? [],
      ctx.players,
      ctx.activeCourts,
      ctx.upcoming,
      ctx.lockedPairs,
    );
    return { match, ladderPending, ladderQueue };
  }

  // auto-balanced (default — also covers the "mixed-doubles" placeholder, never actually set)
  const result = generateMatch(ctx.queue, ctx.players, ctx.history, ctx.activeCourts, ctx.upcoming, ctx.skillBased, ctx.lockedPairs);
  return withDisplaced(result, { queue: ctx.queue });
}

// ─── Upcoming-matches preview ───────────────────────────────────────────────
// Simulates the next QUEUE_SIZE matches without mutating state, for the
// "Upcoming Matches" panel. King/Queen is excluded — its matches are tied
// to specific courts via the promotion/relegation pipeline, not an
// interchangeable pool, and which court frees up next isn't knowable in
// advance (courts complete asynchronously), so no preview is computed for
// that style (a deliberate scope reduction, not an oversight).
export type FillQueueContext = {
  matchingStyle: MatchingStyle;
  queue: string[];
  competitiveQueue?: string[];
  winnerQueue?: string[];
  loserQueue?: string[];
  players: Player[];
  history: CompletedMatch[];
  courts: (PendingMatch | null)[];
  skillBased: boolean;
  lockedPairs: [string, string][];
  casualMatchCount: number;
  competitiveMatchCount: number;
};

export function fillQueue(ctx: FillQueueContext): PendingMatch[] {
  const active = activeCourtMatches(ctx.courts);
  if (active.length === 0) return [];
  if (ctx.matchingStyle === "king-of-court") return [];

  const matches: PendingMatch[] = [];

  if (ctx.matchingStyle === "winner-loser-groups") {
    for (let i = 0; i < QUEUE_SIZE; i++) {
      const { match } = generateWinnerLoserMatch(
        ctx.winnerQueue ?? [], ctx.loserQueue ?? [], ctx.players, ctx.history, active, matches, ctx.lockedPairs
      );
      if (!match) break;
      matches.push(match);
    }
    return matches;
  }

  if (ctx.matchingStyle === "skill-separated") {
    for (let i = 0; i < QUEUE_SIZE; i++) {
      const { match } = generateMatch(ctx.queue, ctx.players, ctx.history, active, matches, ctx.skillBased, ctx.lockedPairs, pickSkillWindowFour);
      if (!match) break;
      matches.push(match);
    }
    return matches;
  }

  if (ctx.matchingStyle !== "skill-courts" || !ctx.competitiveQueue) {
    for (let i = 0; i < QUEUE_SIZE; i++) {
      const { match } = generateMatch(ctx.queue, ctx.players, ctx.history, active, matches, ctx.skillBased, ctx.lockedPairs);
      if (!match) break;
      matches.push(match);
    }
    return matches;
  }

  const competitiveQueue = ctx.competitiveQueue;
  const casualPlayers = ctx.players.filter((p) => skillTier(p.skill) === "casual");
  const competitivePlayers = ctx.players.filter((p) => skillTier(p.skill) === "competitive");
  const exhausted = new Set<SkillTier>();
  let cmc = ctx.casualMatchCount;
  let compmc = ctx.competitiveMatchCount;

  while (matches.length < QUEUE_SIZE && exhausted.size < 2) {
    const preferred = pickNextTier(casualPlayers, competitivePlayers, cmc, compmc);
    const tier = exhausted.has(preferred) ? (preferred === "casual" ? "competitive" : "casual") : preferred;
    if (exhausted.has(tier)) break;
    const tierQ = tier === "casual" ? ctx.queue : competitiveQueue;
    const fillQ = tier === "casual" ? competitiveQueue : ctx.queue;
    let { match } = generateMatch(tierQ, ctx.players, ctx.history, active, matches, ctx.skillBased, ctx.lockedPairs);
    if (!match) {
      ({ match } = generateMatch([...tierQ, ...fillQ], ctx.players, ctx.history, active, matches, ctx.skillBased, ctx.lockedPairs));
    }
    if (!match) {
      exhausted.add(tier);
    } else {
      matches.push(match);
      const isMixed = [...match.teamA, ...match.teamB].some((id) => {
        const p = ctx.players.find((pl) => pl.id === id);
        return p ? skillTier(p.skill) !== tier : false;
      });
      if (isMixed) { cmc++; compmc++; }
      else if (tier === "casual") cmc++; else compmc++;
    }
  }
  return matches;
}

// Builds a FillQueueContext from current AppState, with overrides for any
// fields a handler has already computed locally (e.g. a queue that was just
// advanced) — saves every call site from re-spelling the whole shape.
export function buildFillQueueContext(
  s: AppState,
  courts: (PendingMatch | null)[],
  updates: {
    queue?: string[];
    competitiveQueue?: string[];
    winnerQueue?: string[];
    loserQueue?: string[];
    history?: CompletedMatch[];
    casualMatchCount?: number;
    competitiveMatchCount?: number;
  } = {}
): FillQueueContext {
  return {
    matchingStyle: s.matchingStyle ?? "auto-balanced",
    queue: updates.queue ?? (s.queue?.length ? s.queue : s.players.map((p) => p.id)),
    competitiveQueue: updates.competitiveQueue ?? s.competitiveQueue,
    winnerQueue: updates.winnerQueue ?? s.winnerQueue,
    loserQueue: updates.loserQueue ?? s.loserQueue,
    players: s.players,
    history: updates.history ?? s.history,
    courts,
    skillBased: s.skillBased === true,
    lockedPairs: s.lockedPairs ?? [],
    casualMatchCount: updates.casualMatchCount ?? s.casualMatchCount ?? 0,
    competitiveMatchCount: updates.competitiveMatchCount ?? s.competitiveMatchCount ?? 0,
  };
}

// Same idea for GenerateForCourtContext — courtIndex/activeCourts are always
// call-site-specific, everything else defaults from AppState unless overridden.
export function buildGenerateForCourtContext(
  s: AppState,
  courtIndex: number,
  activeCourts: PendingMatch[],
  updates: {
    queue?: string[];
    competitiveQueue?: string[];
    winnerQueue?: string[];
    loserQueue?: string[];
    ladderPending?: LadderPending;
    ladderQueue?: string[];
    history?: CompletedMatch[];
    casualMatchCount?: number;
    competitiveMatchCount?: number;
    upcoming?: PendingMatch[];
  } = {}
): GenerateForCourtContext {
  const matchingStyle = s.matchingStyle ?? "auto-balanced";
  return {
    matchingStyle,
    courtIndex,
    courtCount: s.courtCount,
    courtTier: matchingStyle === "skill-courts" ? (s.courtTiers?.[courtIndex] ?? null) : null,
    queue: updates.queue ?? (s.queue?.length ? s.queue : s.players.map((p) => p.id)),
    competitiveQueue: updates.competitiveQueue ?? s.competitiveQueue,
    winnerQueue: updates.winnerQueue ?? s.winnerQueue,
    loserQueue: updates.loserQueue ?? s.loserQueue,
    ladderPending: updates.ladderPending ?? s.ladderPending,
    ladderQueue: updates.ladderQueue ?? s.ladderQueue,
    players: s.players,
    history: updates.history ?? s.history,
    activeCourts,
    upcoming: updates.upcoming ?? [],
    skillBased: s.skillBased === true,
    lockedPairs: s.lockedPairs ?? [],
    casualMatchCount: updates.casualMatchCount ?? s.casualMatchCount ?? 0,
    competitiveMatchCount: updates.competitiveMatchCount ?? s.competitiveMatchCount ?? 0,
  };
}

export function resizeCourts(
  courts: (PendingMatch | null)[],
  desired: number
): (PendingMatch | null)[] {
  const out = [...courts];
  while (out.length < desired) out.push(null);
  return out.slice(0, desired);
}

// Gathers every active player's id, in the best-known current waiting order,
// regardless of which style's fields they're currently sitting in. Players
// who are mid-match on a court right now aren't in any queue (already
// "checked out" when their match was generated) — they fall through to the
// missing-players pass below and get appended at the back, which is an
// acceptable approximation for a mid-session style switch.
function currentRoster(prev: AppState): string[] {
  const allIds = prev.players.filter(isActive).map((p) => p.id);
  const prevStyle = prev.matchingStyle ?? "auto-balanced";

  let ids: string[];
  switch (prevStyle) {
    case "skill-courts":
      ids = [...(prev.queue ?? []), ...(prev.competitiveQueue ?? [])];
      break;
    case "winner-loser-groups":
      ids = [...(prev.winnerQueue ?? []), ...(prev.loserQueue ?? [])];
      break;
    case "king-of-court":
      ids = [
        ...(prev.ladderQueue ?? []),
        ...Object.values(prev.ladderPending?.promote ?? {}).flat().flat(),
        ...Object.values(prev.ladderPending?.relegate ?? {}).flat().flat(),
      ];
      break;
    default:
      ids = prev.queue ?? [];
  }

  const allSet = new Set(allIds);
  const seen = new Set<string>();
  const ordered = ids.filter((id) => allSet.has(id) && !seen.has(id) && seen.add(id));
  const missing = allIds.filter((id) => !seen.has(id));
  return [...ordered, ...missing];
}

// Builds the queue-shaped fields (and only those) for a style, seeded from
// a given roster — shared by transitionToStyle (roster = best-known current
// wait order) and resetSession (roster = full player list, fresh start).
function seedQueuesForStyle(style: MatchingStyle, roster: string[], players: Player[]): Partial<AppState> {
  const cleared: Partial<AppState> = {
    queue: undefined,
    competitiveQueue: undefined,
    casualMatchCount: undefined,
    competitiveMatchCount: undefined,
    winnerQueue: undefined,
    loserQueue: undefined,
    ladderQueue: undefined,
    ladderPending: undefined,
  };

  switch (style) {
    case "skill-courts": {
      const casual = roster.filter((id) => {
        const p = players.find((pl) => pl.id === id);
        return p ? skillTier(p.skill) === "casual" : true;
      });
      const competitive = roster.filter((id) => {
        const p = players.find((pl) => pl.id === id);
        return p ? skillTier(p.skill) === "competitive" : false;
      });
      return {
        ...cleared,
        queue: casual,
        competitiveQueue: competitive,
        casualMatchCount: 0,
        competitiveMatchCount: 0,
      };
    }
    case "winner-loser-groups":
      return { ...cleared, winnerQueue: roster, loserQueue: [] };
    case "king-of-court":
      return { ...cleared, ladderQueue: roster, ladderPending: { promote: {}, relegate: {} } };
    case "skill-separated":
    case "auto-balanced":
    default:
      return { ...cleared, queue: roster };
  }
}

// One-time state transformation when a host switches matching styles
// mid-session — each style needs its own queue shape seeded from whatever
// players currently exist, so switching is lossy by nature (e.g. leaving
// King/Queen discards ladder position). Best-effort: seed from the current
// roster (gathered from whichever fields the PREVIOUS style used) rather
// than resetting to empty, so nobody just vanishes from rotation on switch.
export function transitionToStyle(prev: AppState, next: MatchingStyle): Partial<AppState> {
  const roster = currentRoster(prev);
  return {
    matchingStyle: next,
    skillSeparation: next === "skill-courts",
    skillBased: next === "winner-loser-groups" || next === "king-of-court" ? false : true,
    courtTiers: undefined,
    ...seedQueuesForStyle(next, roster, prev.players),
  };
}

// Clears all match state (courts, upcoming, history, and every rotation
// queue) back to a fresh start, while keeping players and settings intact
// (roster, locked pairs, matching style, court count/tiers, result mode).
// Queues are reseeded from the full active player list in roster order,
// respecting whichever matching style is currently selected.
export function resetSession(s: AppState): Partial<AppState> {
  const style = s.matchingStyle ?? "auto-balanced";
  const roster = s.players.filter(isActive).map((p) => p.id);
  return {
    courts: Array.from({ length: s.courtCount }, () => null),
    upcoming: [],
    history: [],
    ...seedQueuesForStyle(style, roster, s.players),
  };
}
