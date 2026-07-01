export const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// "00:00" as an end time means midnight at the end of the day, not the start of it.
export function normEndTime(t: string): string {
  return t.startsWith("00:00") ? "24:00" : t;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

// Monday of the week containing this date, as an ISO string — shared by the
// payouts grouping UI and the disbursement eligibility check so they always agree.
export function weekStartIso(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function addDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// A booking's payout becomes eligible for disbursement once its whole week has
// elapsed — i.e. once we're into the Monday after the booking's own week.
export function payoutEligibleFrom(bookingDateIso: string): string {
  return addDaysIso(weekStartIso(bookingDateIso), 7);
}

// Server-side mirror of the client's calcPrice() in book/page.tsx — operates on raw
// start/end time strings instead of slot indices. Needed so payment amounts (e.g. the
// Xendit invoice) are computed from trusted location/court rates, never a client-supplied price.
export function calcBookingPrice(params: {
  startTime: string;
  endTime: string;
  dayRate: number;
  nightRate: number;
  nightStartHour: number;
  customDayRate: number | null;
  customNightRate: number | null;
  customRateUnit: "hr" | "pax" | "flat" | null;
  allowHalfHour: boolean;
  playerCount: number;
}): number {
  const hasCustom = params.customDayRate != null || params.customNightRate != null;
  const unit = hasCustom ? (params.customRateUnit ?? "hr") : "hr";

  if (unit === "flat") {
    return params.customDayRate ?? params.dayRate;
  }

  const dayRate = params.customDayRate ?? params.dayRate;
  const nightRate = params.customNightRate ?? params.nightRate;

  if (unit === "pax") {
    const startH = parseInt(params.startTime.slice(0, 2), 10);
    const rate = startH >= params.nightStartHour ? nightRate : dayRate;
    return rate * params.playerCount;
  }

  const slotDuration = params.allowHalfHour ? 0.5 : 1;
  const stepMinutes = slotDuration * 60;
  const startMinutes = timeToMinutes(params.startTime);
  const endMinutes = timeToMinutes(normEndTime(params.endTime));

  let total = 0;
  for (let m = startMinutes; m < endMinutes; m += stepMinutes) {
    const hour = Math.floor(m / 60);
    total += (hour >= params.nightStartHour ? nightRate : dayRate) * slotDuration;
  }
  return Math.round(total * 100) / 100;
}
