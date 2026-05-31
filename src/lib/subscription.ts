export type SubscriptionStatus =
  | { type: "none" }
  | { type: "active"; daysLeft: number }
  | { type: "due_soon"; daysLeft: number }
  | { type: "grace"; graceLeft: number }
  | { type: "expired" };

export function getSubscriptionStatus(
  dueDate: string | null,
  graceDays: number = 7
): SubscriptionStatus {
  if (!dueDate) return { type: "none" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const graceEnd = new Date(due);
  graceEnd.setDate(graceEnd.getDate() + graceDays);

  if (today > graceEnd) return { type: "expired" };
  if (today >= due) {
    const graceLeft = Math.ceil((graceEnd.getTime() - today.getTime()) / 86400000);
    return { type: "grace", graceLeft };
  }
  const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (daysLeft <= 7) return { type: "due_soon", daysLeft };
  return { type: "active", daysLeft };
}

export function isSubscriptionExpired(dueDate: string | null, graceDays: number = 7): boolean {
  return getSubscriptionStatus(dueDate, graceDays).type === "expired";
}
