export type SkillLevel =
  | "beginner"
  | "rookie"
  | "novice"
  | "low intermediate"
  | "high intermediate"
  | "pro";

export const SKILL_LEVELS: SkillLevel[] = [
  "beginner",
  "rookie",
  "novice",
  "low intermediate",
  "high intermediate",
  "pro",
];

export type SkillTier = "casual" | "competitive";

export const CASUAL_LEVELS: ReadonlySet<SkillLevel> = new Set([
  "beginner",
  "rookie",
  "novice",
]);

export function skillTier(level: SkillLevel): SkillTier {
  return CASUAL_LEVELS.has(level) ? "casual" : "competitive";
}

export type Player = {
  id: string;
  name: string;
  skill: SkillLevel;
  active?: boolean;
};

export const isActive = (p: Player): boolean => p.active !== false;

export type Team = [string, string];

export type ServingTeam = "A" | "B";
export type ServerNumber = 1 | 2;

export type PendingMatch = {
  id: string;
  teamA: Team;
  teamB: Team;
  serving?: ServingTeam;
  serverNumber?: ServerNumber;
  liveScoreA?: number;
  liveScoreB?: number;
  createdAt: number;
};

export type CompletedMatch = PendingMatch & {
  scoreA: number;
  scoreB: number;
  completedAt: number;
};

export type AppState = {
  players: Player[];
  courtCount: number;
  courts: (PendingMatch | null)[];
  upcoming: PendingMatch[];
  history: CompletedMatch[];
  skillSeparation?: boolean;
};

export const MAX_COURTS = 4;

export const INITIAL_STATE: AppState = {
  players: [],
  courtCount: 1,
  courts: [null],
  upcoming: [],
  history: [],
  skillSeparation: false,
};
