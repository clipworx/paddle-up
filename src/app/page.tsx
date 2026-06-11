"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { CalendarDays, MapPin, Megaphone, Settings, Users, ChevronRight, Shield, Clock } from "lucide-react";

const FEATURES = [
  {
    Icon: CalendarDays,
    title: "Book in seconds",
    body: "Browse available courts, pick a time slot, and confirm your booking — all from your phone.",
  },
  {
    Icon: MapPin,
    title: "Multiple locations",
    body: "Find courts across all registered venues. Each location sets its own hours, rates, and policies.",
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
  {
    Icon: Users,
    title: "Open play rotation",
    body: "Run structured open play sessions with automatic partner rotation, skill separation, and live scoring.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Choose a venue",
    body: "Browse all available locations, see court availability, and compare rates.",
  },
  {
    n: "02",
    title: "Pick your slot",
    body: "Select your court and time on the live availability grid — no double-bookings, ever.",
  },
  {
    n: "03",
    title: "Confirm & play",
    body: "Fill in your details, complete payment if required, and you're ready to go.",
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
          <Link href="/play" className="text-sm font-semibold text-muted hover:text-foreground transition-colors hidden sm:block">
            Open Play
          </Link>
          <Link href="/admin" className="text-sm font-semibold text-muted hover:text-foreground transition-colors hidden sm:block">
            Admin
          </Link>
          <Link
            href="/book"
            className="rounded-full bg-accent text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Book a court
          </Link>
        </div>
      </nav>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Background accent blobs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute top-1/2 -left-32 w-80 h-80 rounded-full bg-accent/8 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 text-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-widest mb-6">
              Court booking platform
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-foreground tracking-tight leading-[1.05] mb-6">
              Reserve your court.<br />
              <span className="text-accent">Play your game.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
              ReZerve connects players with court facilities — browse availability, compare rates, and confirm your booking in seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/book"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-accent text-white px-8 py-3.5 text-[15px] font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-accent/25"
              >
                Find a court <ChevronRight size={16} />
              </Link>
              <Link
                href="/play"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-border text-foreground px-8 py-3.5 text-[15px] font-semibold hover:bg-background hover:border-accent/50 transition-colors"
              >
                Open play rotation
              </Link>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="bg-background border-y border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">How it works</h2>
              <p className="text-muted mt-2 text-sm">Book a court in three simple steps.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-8">
              {STEPS.map((step) => (
                <div key={step.n} className="relative text-center sm:text-left">
                  <div className="inline-block font-mono text-4xl font-black text-accent/20 leading-none mb-3 select-none">{step.n}</div>
                  <h3 className="text-[15px] font-bold text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-full bg-accent text-white px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Browse courts <ChevronRight size={15} />
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

        {/* ── Admin CTA ── */}
        <section className="bg-background border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <div className="rounded-2xl bg-accent/10 border border-accent/20 px-8 py-10 sm:py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-3">
                  For venue owners
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">Manage your facility</h2>
                <p className="text-sm text-muted mt-2 max-w-md leading-relaxed">
                  Set up courts, configure rates and hours, manage bookings, post announcements, and track revenue — all from one dashboard.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent text-white px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  <Settings size={15} /> Admin panel
                </Link>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
