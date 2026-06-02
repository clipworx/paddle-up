"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarCheck2, TrendingUp, BarChart2, BarChart3, Wallet, Clock, XCircle } from "lucide-react";
import { useLocationAdminContext } from "@/contexts/LocationAdminContext";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { fmtPeso, fmtTime, timeAgo, pctChange } from "@/lib/admin-utils";
import type { DashboardData } from "@/lib/admin-types";

export default function MyLocationPage() {
  const { location } = useLocationAdminContext();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    setDashboardLoading(true);
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((json) => { if (json.stats) setDashboardData(json); })
      .catch(() => {})
      .finally(() => setDashboardLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-4xl w-full px-4 py-6 sm:py-8 space-y-6">
        <SubscriptionBanner location={location} />

        {/* ── Dashboard section ── */}
        <section className="space-y-5">
          {/* Page header */}
          <div className="flex items-end justify-between gap-4 flex-wrap mb-1">
            <div className="flex items-center gap-4">
              {location?.logo_url && (
                <img
                  src={location.logo_url}
                  alt="Logo"
                  className="h-14 w-14 rounded-xl object-contain border border-border bg-surface shrink-0"
                />
              )}
              <div>
                <span className="font-mono text-[12px] font-bold tracking-[.2em] uppercase text-accent mb-2 block">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </span>
                <h2 className="text-[30px] font-extrabold tracking-tight text-foreground leading-none">
                  {location?.name ?? "My Location"}
                </h2>
                {(location?.address || location?.description) && (
                  <p className="text-[14.5px] text-muted mt-1.5 max-w-[62ch]">
                    {location?.address}
                    {location?.address && location?.description ? " · " : ""}
                    {location?.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* KPI cards */}
          {dashboardLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-[22px] border border-border bg-background p-4 sm:p-5 animate-pulse h-32" />
              ))}
            </div>
          ) : dashboardData ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Today's bookings — solid badge */}
                <div className="rounded-[22px] border border-border bg-background p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="w-[42px] h-[42px] rounded-[13px] bg-accent flex items-center justify-center shrink-0 shadow-[0_12px_28px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
                      <CalendarCheck2 size={20} className="text-white" />
                    </div>
                    {(() => {
                      const delta = dashboardData.stats.today_bookings - dashboardData.stats.yesterday_bookings;
                      return (
                        <span className={`text-[12.5px] font-bold flex items-center gap-1 ${delta >= 0 ? "text-accent" : "text-red-500"}`}>
                          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} vs yday
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[13px] text-muted font-semibold mt-4">Today&apos;s bookings</p>
                  <p className="text-3xl sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none mt-0.5">
                    {dashboardData.stats.today_bookings}
                  </p>
                </div>

                {/* Revenue today — soft badge */}
                <div className="rounded-[22px] border border-border bg-background p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="w-[42px] h-[42px] rounded-[13px] bg-accent/15 flex items-center justify-center shrink-0">
                      <TrendingUp size={20} className="text-accent" />
                    </div>
                    {(() => {
                      const label = pctChange(dashboardData.stats.today_revenue, dashboardData.stats.yesterday_revenue);
                      const positive = dashboardData.stats.today_revenue >= dashboardData.stats.yesterday_revenue;
                      return (
                        <span className={`text-[12.5px] font-bold ${positive ? "text-accent" : "text-red-500"}`}>
                          {label} yday
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[13px] text-muted font-semibold mt-4">Revenue · today</p>
                  <p className="text-3xl sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none mt-0.5">
                    {fmtPeso(dashboardData.stats.today_revenue)}
                  </p>
                </div>

                {/* This week — soft badge */}
                <div className="rounded-[22px] border border-border bg-background p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="w-[42px] h-[42px] rounded-[13px] bg-accent/15 flex items-center justify-center shrink-0">
                      <BarChart2 size={20} className="text-accent" />
                    </div>
                    {(() => {
                      const label = pctChange(dashboardData.stats.week_revenue, dashboardData.stats.prev_week_revenue);
                      const positive = dashboardData.stats.week_revenue >= dashboardData.stats.prev_week_revenue;
                      return (
                        <span className={`text-[12.5px] font-bold ${positive ? "text-accent" : "text-red-500"}`}>
                          {label} WoW
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[13px] text-muted font-semibold mt-4">Revenue · this week</p>
                  <p className="text-3xl sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none mt-0.5">
                    {fmtPeso(dashboardData.stats.week_revenue)}
                  </p>
                </div>

                {/* This month — soft badge */}
                <div className="rounded-[22px] border border-border bg-background p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="w-[42px] h-[42px] rounded-[13px] bg-accent/15 flex items-center justify-center shrink-0">
                      <BarChart3 size={20} className="text-accent" />
                    </div>
                    {(() => {
                      const label = pctChange(dashboardData.stats.month_revenue, dashboardData.stats.prev_month_revenue);
                      const positive = dashboardData.stats.month_revenue >= dashboardData.stats.prev_month_revenue;
                      return (
                        <span className={`text-[12.5px] font-bold ${positive ? "text-accent" : "text-red-500"}`}>
                          {label} MoM
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[13px] text-muted font-semibold mt-4">Revenue · this month</p>
                  <p className="text-3xl sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none mt-0.5">
                    {fmtPeso(dashboardData.stats.month_revenue)}
                  </p>
                </div>
              </div>

              {/* Utilization + activity — 1.5fr / 1fr */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
                {/* Court utilization */}
                <div className="rounded-[22px] border border-border bg-background p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2.5">
                      <span className="w-[30px] h-[30px] rounded-[9px] bg-accent/15 text-accent inline-flex items-center justify-center shrink-0">
                        <BarChart2 size={16} />
                      </span>
                      Court utilization · today
                    </h3>
                    {dashboardData.court_utilization.length > 0 && (
                      <span className="text-[13px] font-bold text-accent">
                        {Math.round(
                          dashboardData.court_utilization.reduce((s, c) => s + c.pct, 0) /
                          dashboardData.court_utilization.length
                        )}% overall
                      </span>
                    )}
                  </div>

                  {dashboardData.court_utilization.length === 0 ? (
                    <p className="text-sm text-muted">No courts configured.</p>
                  ) : (
                    <div>
                      {dashboardData.court_utilization.map((court) => (
                        <div
                          key={court.id}
                          className={`flex items-center gap-3 py-[9px] border-b border-border/40 last:border-b-0 ${!court.is_active ? "opacity-40" : ""}`}
                        >
                          <span className="text-[13.5px] font-semibold text-foreground w-16 shrink-0 truncate">{court.name}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-surface overflow-hidden">
                            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${court.pct}%` }} />
                          </div>
                          <span className="text-[13px] font-bold text-foreground w-10 text-right shrink-0">{court.pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-5 mt-2 border-t border-border">
                    <Link
                      href="/admin/my-location/bookings"
                      className="rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors flex items-center gap-1.5"
                    >
                      <CalendarDays size={14} /> Open schedule
                    </Link>
                    <Link
                      href="/admin/my-location/courts"
                      className="rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors flex items-center gap-1.5"
                    >
                      <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current" /> Manage courts
                    </Link>
                  </div>
                </div>

                {/* Recent activity */}
                <div className="rounded-[22px] border border-border bg-background p-6 shadow-sm">
                  <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2.5 mb-4">
                    <span className="w-[30px] h-[30px] rounded-[9px] bg-accent/15 text-accent inline-flex items-center justify-center shrink-0">
                      <Clock size={16} />
                    </span>
                    Recent activity
                  </h3>
                  {dashboardData.recent_activity.length === 0 ? (
                    <p className="text-sm text-muted">No recent bookings.</p>
                  ) : (
                    <div>
                      {dashboardData.recent_activity.map((a) => {
                        const isConfirmed = a.status === "confirmed";
                        const isPendingPay = a.status === "pending_payment";
                        const isCancelled = a.status === "cancelled";
                        const FeedIcon = isConfirmed ? CalendarCheck2 : isPendingPay ? Clock : isCancelled ? XCircle : Wallet;
                        const icBg = isConfirmed ? "bg-accent/15" : isPendingPay ? "bg-[#fdf0db]" : isCancelled ? "bg-[#fde8e6]" : "bg-[#e3f0ff]";
                        const icFg = isConfirmed ? "text-accent" : isPendingPay ? "text-[#a96a14]" : isCancelled ? "text-[#b23b32]" : "text-[#2b7bd6]";
                        const what = isConfirmed ? "booked" : isPendingPay ? "payment pending" : isCancelled ? "cancelled" : "refunded";
                        return (
                          <div key={a.id} className="flex items-start gap-3.5 py-3.5 border-b border-surface last:border-b-0">
                            <div className={`w-[38px] h-[38px] rounded-[11px] ${icBg} flex items-center justify-center shrink-0`}>
                              <FeedIcon size={17} className={icFg} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] leading-snug text-foreground">
                                <b className="font-bold">{a.booker_name}</b> {what}
                              </p>
                              <p className="text-[12.5px] text-muted mt-0.5 truncate">
                                {a.court_name} · {fmtTime(a.start_time)}–{fmtTime(a.end_time)}
                              </p>
                            </div>
                            <span className="text-[11.5px] text-muted/60 font-semibold whitespace-nowrap shrink-0 mt-0.5">
                              {timeAgo(a.created_at)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Failed to load dashboard data.</p>
          )}
        </section>
      </main>
  );
}
