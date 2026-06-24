import { Player, Tier } from "./types";

export const TIER_LABEL: Record<Tier, string> = {
  novice: "NOVICE",
  intermediate: "INTERMEDIATE",
};

export const TIER_TEXT_CLASS: Record<Tier, string> = {
  novice: "text-accent",
  intermediate: "text-warning",
};

export const TIER_BG_CLASS: Record<Tier, string> = {
  novice: "bg-accent/12",
  intermediate: "bg-warning/15",
};

export const TIER_BORDER_CLASS: Record<Tier, string> = {
  novice: "border-accent",
  intermediate: "border-warning",
};

export const TIER_DOT_CLASS: Record<Tier, string> = {
  novice: "bg-accent",
  intermediate: "bg-warning",
};

export const TIER_BAR_CLASS: Record<Tier, string> = {
  novice: "bg-accent",
  intermediate: "bg-warning",
};

export type DisplayStatus = "pending" | "declined" | "playing" | "queued" | "resting";

export function derivePlayerDisplayStatus(player: Player): DisplayStatus {
  if (player.status === "pending") return "pending";
  if (player.status === "declined") return "declined";
  if (player.inMatchOnCourt !== null) return "playing";
  if (player.joined) return "queued";
  return "resting";
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  pending: "PENDING",
  declined: "DECLINED",
  playing: "PLAYING",
  queued: "QUEUED",
  resting: "RESTING",
};

export const STATUS_TEXT_CLASS: Record<DisplayStatus, string> = {
  pending: "text-muted",
  declined: "text-negative",
  playing: "text-warning",
  queued: "text-accent",
  resting: "text-muted",
};

export function sortByQueueOrder(players: Player[]): Player[] {
  return [...players].sort((a, b) => (a.joinedQueueAt ?? 0) - (b.joinedQueueAt ?? 0));
}

export function queuedInTier(players: Player[], tier: Tier): Player[] {
  return sortByQueueOrder(players.filter((p) => p.tier === tier && p.joined && p.inMatchOnCourt === null));
}
