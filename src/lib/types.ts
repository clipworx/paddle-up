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

// ─── Court booking types ───────────────────────────────────────────────────

export type Location = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  is_active: boolean;
  court_count?: number;
  day_rate: number;
  night_rate: number;
  // Weekday schedule (Mon–Fri)
  night_start_time: string;         // "HH:MM:SS"
  open_hour: number;                // 0–23
  close_hour: number;               // 1–24 (24 = midnight end-of-day)
  // Weekend schedule (Sat–Sun)
  weekend_night_start_time: string; // "HH:MM:SS"
  weekend_open_hour: number;        // 0–23
  weekend_close_hour: number;       // 1–24
  // Payment
  payment_qr_url: string | null;
  payment_account_name: string | null;
  payment_account_number: string | null;
};

export type Court = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  location_id: string;
};

export type BookingStatus = "confirmed" | "cancelled" | "pending_payment";

export type Booking = {
  id: string;
  court_id: string;
  date: string;       // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
  booker_name: string;
  booker_email: string;
  player_count: number;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
};

export type TimeSlot = {
  start: string; // "07:00"
  end: string;   // "08:00"
  label: string; // "7:00 AM – 8:00 AM"
};

function fmtHour(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

// Full 24-hour grid — 12:00 AM through 11:00 PM–12:00 AM.
// Booking pages filter to the location's open_hour/close_hour window.
export const TIME_SLOTS: TimeSlot[] = Array.from({ length: 24 }, (_, h) => ({
  start: `${String(h).padStart(2, "0")}:00`,
  // Last slot ends at midnight; represent as "00:00" (handled in overlap logic).
  end: h + 1 === 24 ? "00:00" : `${String(h + 1).padStart(2, "0")}:00`,
  label: `${fmtHour(h)} – ${fmtHour((h + 1) % 24)}`,
}));

export const INITIAL_STATE: AppState = {
  players: [],
  courtCount: 1,
  courts: [null],
  upcoming: [],
  history: [],
  skillSeparation: false,
};
