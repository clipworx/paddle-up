export function fmtH(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

export const ALL_HOURS_24 = Array.from({ length: 24 }, (_, h) => ({
  value: `${String(h).padStart(2, "0")}:00`,
  label: fmtH(h),
  h,
}));

export const CLOSE_HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i + 1,
  label: i + 1 === 24 ? "12:00 AM (midnight)" : fmtH(i + 1),
}));

export function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function displayDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export function displayMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function fmtPeso(n: number): string {
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function pctChange(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? "+∞%" : "—";
  const p = Math.round(((curr - prev) / prev) * 100);
  return (p >= 0 ? "+" : "") + p + "%";
}
