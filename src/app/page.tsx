"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { CalendarDays, MapPin, Megaphone, ChevronRight, Shield, Clock } from "lucide-react";

const FEATURES = [
  {
    Icon: CalendarDays,
    title: "Book in seconds",
    body: "Browse available venues, pick a time slot, and confirm your booking — all from your phone.",
  },
  {
    Icon: MapPin,
    title: "Multiple locations",
    body: "Find venues across all registered locations. Each sets its own hours, rates, and booking policies.",
  },
  {
    Icon: Clock,
    title: "Day & night pricing",
    body: "Transparent pricing with separate day and night rates so you always know what you're paying.",
  },
  {
    Icon: Megaphone,
    title: "Stay in the loop",
    body: "Locations post announcements for tournaments, maintenance closures, and special events.",
  },
  {
    Icon: Shield,
    title: "Booking policies",
    body: "Down payment options and rate-boundary rules give venues full control over how bookings work.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-5xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo size={28} />
            <span className="text-[15px] font-extrabold text-foreground tracking-tight">
              Re<span className="text-accent">Z</span>erve
            </span>
          </Link>
          <div className="flex-1" />
          <Link
            href="/about"
            className="hidden sm:block text-sm font-semibold text-muted hover:text-foreground transition-colors"
          >
            About
          </Link>
          <Link
            href="/book"
            className="rounded-full bg-accent text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Book now
          </Link>
        </div>
      </nav>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1659318006095-4d44845f3a1b?q=80&w=3610&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt=""
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/55" />
          </div>

          <div className="relative mx-auto max-w-5xl px-4 pt-24 pb-28 sm:pt-32 sm:pb-36 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 text-white px-4 py-1.5 text-xs font-semibold uppercase tracking-widest mb-6">
              Venue booking platform
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
              Reserve your space.<br />
              <span className="text-accent">Make it yours.</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/75 max-w-2xl mx-auto mb-10 leading-relaxed">
              ReZerve connects people with venues — browse availability, compare rates, and confirm your booking in seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/book"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-accent text-white px-8 py-3.5 text-[15px] font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-accent/25"
              >
                Find a venue <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Everything you need</h2>
            <p className="text-muted mt-2 text-sm">Built for players and facility managers alike.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-background p-6 space-y-3 hover:border-accent/40 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                  <Icon size={18} className="text-accent" />
                </div>
                <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
