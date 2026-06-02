"use client";

import React from "react";
import { getSubscriptionStatus } from "@/lib/subscription";
import type { LocationInfo } from "@/lib/admin-types";

type Props = {
  location: LocationInfo | null;
};

export function SubscriptionBanner({ location }: Props) {
  if (!location) return null;
  const sub = getSubscriptionStatus(location.subscription_due_date, location.subscription_grace_days);

  if (sub.type === "expired") {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4">
        <p className="font-semibold text-red-800 text-sm">Subscription expired</p>
        <p className="text-sm text-red-700 mt-0.5">
          Customers can no longer book at your location. Contact the administrator to renew your subscription.
        </p>
      </div>
    );
  }
  if (sub.type === "grace") {
    return (
      <div className="rounded-xl border border-orange-300 bg-orange-50 px-5 py-4">
        <p className="font-semibold text-orange-800 text-sm">
          Subscription overdue · {sub.graceLeft} day{sub.graceLeft !== 1 ? "s" : ""} left
        </p>
        <p className="text-sm text-orange-700 mt-0.5">
          New bookings will be blocked in {sub.graceLeft} day{sub.graceLeft !== 1 ? "s" : ""}. Contact the administrator to renew.
        </p>
      </div>
    );
  }
  if (sub.type === "due_soon") {
    return (
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-5 py-4">
        <p className="font-semibold text-yellow-800 text-sm">
          Subscription due in {sub.daysLeft} day{sub.daysLeft !== 1 ? "s" : ""}
        </p>
        <p className="text-sm text-yellow-700 mt-0.5">
          Contact the administrator to renew before your subscription expires.
        </p>
      </div>
    );
  }
  return null;
}
