import { AppState, Match, Player, Tier, TIERS } from "./types";

export type Transition = AppState | { error: string };

// Defensively reshapes whatever is in the DB row into a valid AppState.
// Needed because sessions created before the Open Play rewrite (or any
// future shape change) won't have a `courts` array at all — every
// transition below indexes into `courts`, so skipping this crashes on the
// very first action against a stale session. Both the server (sessionCas)
// and client (sharedState) paths must call this on the raw value they read.
export function normalizeAppState(raw: unknown): AppState {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<AppState>;
  const courtCount = Math.max(1, parsed.courtCount ?? 1);
  const courts = Array.isArray(parsed.courts) ? [...parsed.courts] : [];
  while (courts.length < courtCount) courts.push(null);
  return {
    players: Array.isArray(parsed.players) ? parsed.players : [],
    courtCount,
    courts: courts.slice(0, courtCount),
  };
}

function findPlayer(state: AppState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

// admitImmediately is true only when the caller presented a valid host
// password — used so the host's own first join skips the waiting room.
export function applyJoin(state: AppState, playerId: string, name: string, admitImmediately: boolean): Transition {
  const trimmed = name.trim().slice(0, 40) || "Player";
  const existing = findPlayer(state, playerId);
  if (existing) {
    // A declined player calling join again (e.g. tapping "Ask again") is a
    // fresh request — put them back in the waiting room. Anyone else
    // restoring an existing identity just gets their name refreshed.
    const status = existing.status === "declined" && !admitImmediately ? "pending" : existing.status;
    return {
      ...state,
      players: state.players.map((p) => (p.id === playerId ? { ...p, name: trimmed, status } : p)),
    };
  }
  const newPlayer: Player = {
    id: playerId,
    name: trimmed,
    status: admitImmediately ? "admitted" : "pending",
    tier: null,
    joined: false,
    joinedQueueAt: null,
    inMatchOnCourt: null,
    connectedAt: Date.now(),
  };
  return { ...state, players: [...state.players, newPlayer] };
}

export function applyAdmit(state: AppState, playerId: string): Transition {
  if (!findPlayer(state, playerId)) return { error: "player_not_found" };
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, status: "admitted" } : p)),
  };
}

export function applyDecline(state: AppState, playerId: string): Transition {
  const player = findPlayer(state, playerId);
  if (!player) return { error: "player_not_found" };
  // If they were already in the queue/a match, declining pulls them out —
  // same cleanup as a kick, just without removing them from the roster.
  const courts = player.inMatchOnCourt !== null
    ? state.courts.map((c, i) => (i === player.inMatchOnCourt ? null : c))
    : state.courts;
  const match = player.inMatchOnCourt !== null ? state.courts[player.inMatchOnCourt] : null;
  const clearedIds = match ? new Set([...match.teamA, ...match.teamB]) : new Set([playerId]);
  return {
    ...state,
    courts,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, status: "declined", tier: null, joined: false, joinedQueueAt: null, inMatchOnCourt: null }
        : clearedIds.has(p.id)
        ? { ...p, inMatchOnCourt: null, joined: false, joinedQueueAt: null }
        : p
    ),
  };
}

export function applyRename(state: AppState, playerId: string, name: string): Transition {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { error: "name_required" };
  if (!findPlayer(state, playerId)) return { error: "player_not_found" };
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, name: trimmed } : p)),
  };
}

export function applySetTier(state: AppState, playerId: string, tier: Tier): Transition {
  if (!TIERS.includes(tier)) return { error: "invalid_tier" };
  const player = findPlayer(state, playerId);
  if (!player) return { error: "player_not_found" };
  if (player.status !== "admitted") return { error: "not_admitted" };
  if (player.inMatchOnCourt !== null) return { error: "in_match" };
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, tier, joined: false, joinedQueueAt: null } : p
    ),
  };
}

export function applyQueueJoin(state: AppState, playerId: string): Transition {
  const player = findPlayer(state, playerId);
  if (!player) return { error: "player_not_found" };
  if (player.status !== "admitted") return { error: "not_admitted" };
  if (!player.tier) return { error: "tier_required" };
  if (player.inMatchOnCourt !== null) return { error: "in_match" };
  const next: AppState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, joined: true, joinedQueueAt: Date.now() } : p
    ),
  };
  return tryFormMatches(next);
}

export function applyQueueLeave(state: AppState, playerId: string): Transition {
  const player = findPlayer(state, playerId);
  if (!player) return { error: "player_not_found" };
  if (player.inMatchOnCourt !== null) return { error: "in_match" };
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, joined: false, joinedQueueAt: null } : p
    ),
  };
}

export function applyAdjustScore(state: AppState, courtIndex: number, team: "A" | "B", delta: 1 | -1): Transition {
  if (courtIndex < 0 || courtIndex >= state.courts.length) return { error: "invalid_court" };
  const match = state.courts[courtIndex];
  if (!match) return { error: "no_match" };
  const key = team === "A" ? "scoreA" : "scoreB";
  const nextScore = Math.max(0, (match[key] ?? 0) + delta);
  return {
    ...state,
    // Every point (won or corrected) starts the next one fresh at a 1st serve.
    courts: state.courts.map((c, i) => (i === courtIndex ? { ...c!, [key]: nextScore, serveNumber: 1 } : c)),
  };
}

// 1st serve faults → 2nd serve. 2nd serve faults (double fault) → back to
// 1st serve for the next point; the score itself is left to the host's
// own +/− taps, this is purely the serve-attempt indicator.
export function applyFault(state: AppState, courtIndex: number): Transition {
  if (courtIndex < 0 || courtIndex >= state.courts.length) return { error: "invalid_court" };
  const match = state.courts[courtIndex];
  if (!match) return { error: "no_match" };
  const nextServe = (match.serveNumber ?? 1) === 1 ? 2 : 1;
  return {
    ...state,
    courts: state.courts.map((c, i) => (i === courtIndex ? { ...c!, serveNumber: nextServe } : c)),
  };
}

export function applySwitchServer(state: AppState, courtIndex: number): Transition {
  if (courtIndex < 0 || courtIndex >= state.courts.length) return { error: "invalid_court" };
  const match = state.courts[courtIndex];
  if (!match) return { error: "no_match" };
  const nextServer = match.servingTeam === "A" ? "B" : "A";
  return {
    ...state,
    courts: state.courts.map((c, i) => (i === courtIndex ? { ...c!, servingTeam: nextServer, serveNumber: 1 } : c)),
  };
}

export function applyCompleteMatch(state: AppState, courtIndex: number): Transition {
  if (courtIndex < 0 || courtIndex >= state.courts.length) return { error: "invalid_court" };
  const match = state.courts[courtIndex];
  if (!match) return { error: "no_match" };
  const playerIds = new Set<string>([...match.teamA, ...match.teamB]);
  const next: AppState = {
    ...state,
    courts: state.courts.map((c, i) => (i === courtIndex ? null : c)),
    players: state.players.map((p) =>
      playerIds.has(p.id) ? { ...p, inMatchOnCourt: null, joined: false, joinedQueueAt: null } : p
    ),
  };
  return tryFormMatches(next);
}

export function applySetCourtCount(state: AppState, courtCount: number, maxCourts: number): Transition {
  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > maxCourts) {
    return { error: "invalid_court_count" };
  }
  // Shrinking drops the trailing courts — if any held an active match, return
  // those 4 players to resting rather than silently stranding them as "in a
  // match" on a court that no longer exists.
  const droppedMatches = state.courts.slice(courtCount).filter((c): c is Match => c !== null);
  const droppedPlayerIds = new Set(droppedMatches.flatMap((m) => [...m.teamA, ...m.teamB]));
  const courts = state.courts.slice(0, courtCount);
  while (courts.length < courtCount) courts.push(null);
  return {
    ...state,
    courtCount,
    courts,
    players: state.players.map((p) =>
      droppedPlayerIds.has(p.id) ? { ...p, inMatchOnCourt: null, joined: false, joinedQueueAt: null } : p
    ),
  };
}

export function applyKickPlayer(state: AppState, playerId: string): Transition {
  const player = findPlayer(state, playerId);
  if (!player) return { error: "player_not_found" };
  const courts = player.inMatchOnCourt !== null
    ? state.courts.map((c, i) => (i === player.inMatchOnCourt ? null : c))
    : state.courts;
  // The kicked player's match partner/opponents return to resting too —
  // their match no longer has 4 players, so it can't continue.
  const match = player.inMatchOnCourt !== null ? state.courts[player.inMatchOnCourt] : null;
  const clearedIds = match ? new Set([...match.teamA, ...match.teamB]) : new Set([playerId]);
  return {
    ...state,
    courts,
    players: state.players
      .filter((p) => p.id !== playerId)
      .map((p) => (clearedIds.has(p.id) ? { ...p, inMatchOnCourt: null, joined: false, joinedQueueAt: null } : p)),
  };
}

// Scans every free court, in order, and fills it from whichever tier has
// >=4 players waiting (novice checked before intermediate). Re-run after
// every queue-join and every match completion so a freed court is refilled
// immediately and neither tier waits more than one match cycle.
function tryFormMatches(state: AppState): AppState {
  let players = state.players;
  let courts = state.courts;

  for (let courtIndex = 0; courtIndex < courts.length; courtIndex++) {
    if (courts[courtIndex] !== null) continue;
    for (const tier of TIERS) {
      const waiting = players
        .filter((p) => p.tier === tier && p.joined && p.inMatchOnCourt === null)
        .sort((a, b) => (a.joinedQueueAt ?? 0) - (b.joinedQueueAt ?? 0));
      if (waiting.length < 4) continue;

      const four = waiting.slice(0, 4);
      const fourIds = new Set(four.map((p) => p.id));
      const match: Match = {
        id: crypto.randomUUID(),
        tier,
        teamA: [four[0].id, four[1].id],
        teamB: [four[2].id, four[3].id],
        createdAt: Date.now(),
        scoreA: 0,
        scoreB: 0,
        servingTeam: "A",
        serveNumber: 1,
      };
      players = players.map((p) =>
        fourIds.has(p.id) ? { ...p, inMatchOnCourt: courtIndex, joined: false, joinedQueueAt: null } : p
      );
      courts = courts.map((c, i) => (i === courtIndex ? match : c));
      break; // this court is filled — move on to the next free court
    }
  }

  return { ...state, players, courts };
}
