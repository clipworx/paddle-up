export const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// "00:00" as an end time means midnight at the end of the day, not the start of it.
export function normEndTime(t: string): string {
  return t.startsWith("00:00") ? "24:00" : t;
}
