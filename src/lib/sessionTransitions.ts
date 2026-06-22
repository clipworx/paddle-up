import { AppState, Match, Player, Tier, TIERS } from "./types";

export type Transition = AppState | { error: string };

function findPlayer(state: AppState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function applyJoin(state: AppState, playerId: string, name: string): Transition {
  const trimmed = name.trim().slice(0, 40) || "Player";
  if (findPlayer(state, playerId)) {
    return {
      ...state,
      players: state.players.map((p) => (p.id === playerId ? { ...p, name: trimmed } : p)),
    };
  }
  const newPlayer: Player = {
    id: playerId,
    name: trimmed,
    tier: null,
    joined: false,
    joinedQueueAt: null,
    inMatchOnCourt: null,
    connectedAt: Date.now(),
  };
  return { ...state, players: [...state.players, newPlayer] };
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
