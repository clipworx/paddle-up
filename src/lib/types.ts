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

export type MatchingStyle =
  | "auto-balanced"
  | "skill-separated"
  | "winner-loser-groups"
  | "skill-courts"
  | "king-of-court"
  | "mixed-doubles"; // UI placeholder only — never actually settable

export const MATCHING_STYLES: {
  value: MatchingStyle;
  label: string;
  description: string;
  comingSoon?: boolean;
}[] = [
  { value: "auto-balanced", label: "Auto-balanced", description: "Everyone shares one queue. Teams are balanced each round." },
  { value: "skill-separated", label: "Skill-separated", description: "Keeps players within 2 skill levels and waits instead of forcing a wide-gap match." },
  { value: "winner-loser-groups", label: "Winner/Loser Groups", description: "Winners play winners. Losers play losers." },
  { value: "skill-courts", label: "Skill Courts", description: "Assign courts to skill groups, each with its own queue." },
  { value: "king-of-court", label: "King/Queen of the Court", description: "Winners move toward the top court while losers move down." },
  { value: "mixed-doubles", label: "Mixed Doubles", description: "Each game needs two men and two women.", comingSoon: true },
];

export type LadderPending = {
  promote: Record<number, [string, string][]>;
  relegate: Record<number, [string, string][]>;
};

export type Player = {
  id: string;
  name: string;
  skill: SkillLevel;
  active?: boolean;
  joinedAt?: number;
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
  scoreA?: number;
  scoreB?: number;
  winner: "A" | "B" | "tie";
  completedAt: number;
};

export type ResultMode = "score" | "winner";

export type AppState = {
  players: Player[];
  courtCount: number;
  courts: (PendingMatch | null)[];
  upcoming: PendingMatch[];
  history: CompletedMatch[];
  queue: string[];
  competitiveQueue?: string[];
  casualMatchCount?: number;
  competitiveMatchCount?: number;
  courtTiers?: (SkillTier | null)[];
  skillSeparation?: boolean;
  skillBased?: boolean;
  lockedPairs?: [string, string][];
  resultMode?: ResultMode;
  matchingStyle?: MatchingStyle;
  winnerQueue?: string[];
  loserQueue?: string[];
  ladderPending?: LadderPending;
  ladderQueue?: string[];
};

// Derives the matching style for sessions saved before the unified style
// picker existed. Old skillSeparation:true sessions degrade to
// auto-balanced (not remapped to skill-separated or skill-courts) since
// both would silently change a live host's gameplay rules to something
// they never picked — the host re-selects a style from the new picker.
export function deriveMatchingStyle(s: Partial<AppState>): MatchingStyle {
  if (s.matchingStyle) return s.matchingStyle;
  if ((s.courtTiers ?? []).some((t) => t !== null)) return "skill-courts";
  return "auto-balanced";
}

export const MAX_COURTS = 4;

// ─── Court booking types ───────────────────────────────────────────────────

export type Location = {
  id: string;
  name: string;
  slug: string;
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
  // Map
  latitude: number | null;
  longitude: number | null;
  // Branding
  logo_url: string | null;
  accent_color: string | null;
  photo_url: string | null;
  // Subscription
  subscription_due_date: string | null;   // YYYY-MM-DD, null = no subscription enforced
  subscription_grace_days: number;         // days after due before deactivation (default 7)
  // Booking policies
  require_downpayment: boolean;            // require 50% down for long bookings
  downpayment_min_hours: number;           // threshold in hours (default 3)
  no_split_rate_booking: boolean;          // block bookings spanning day/night boundary
  allow_half_hour_bookings: boolean;       // enable 30-min slot granularity
};

export type Court = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  location_id: string;
  custom_day_rate: number | null;    // null = use location rate
  custom_night_rate: number | null;  // null = use location rate
  custom_rate_unit: "hr" | "pax" | "flat"; // how the custom rate is charged
  parent_court_id: string | null;
};

export type BookingStatus = "confirmed" | "cancelled" | "pending_payment" | "refunded";

export type Booking = {
  id: string;
  court_id: string;
  date: string;       // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
  booker_name: string;
  booker_phone: string;
  booker_email: string | null;
  player_count: number;
  notes: string | null;
  status: BookingStatus;
  refund_reason: string | null;
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

// 30-minute slot grid — 48 slots of 30 minutes each.
export const HALF_HOUR_SLOTS: TimeSlot[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  const nextI = i + 1;
  const nextH = Math.floor(nextI / 2);
  const nextM = (nextI % 2) * 30;
  return {
    start: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    end: nextI >= 48 ? "00:00" : `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`,
    label: "",
  };
});

export const INITIAL_STATE: AppState = {
  players: [],
  courtCount: 1,
  courts: [null],
  upcoming: [],
  history: [],
  queue: [],
  skillSeparation: false,
  matchingStyle: "auto-balanced",
};
