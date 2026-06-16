import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { CalendarDays, MapPin, Users, Zap } from "lucide-react";

export const metadata = {
  title: "About – ReZerve",
  description: "Learn about ReZerve, the venue booking platform built for people and places.",
};

const VALUES = [
  {
    Icon: CalendarDays,
    title: "Effortless booking",
    body: "We built ReZerve so that reserving a venue takes seconds, not phone calls. Real-time availability means no double-bookings, ever.",
  },
  {
    Icon: MapPin,
    title: "Built for venues",
    body: "Every location gets its own booking page, custom rates, and admin tools — so facility owners stay in full control.",
  },
  {
    Icon: Users,
    title: "Community first",
    body: "From open play sessions to announcements, ReZerve keeps people connected to the venues they love.",
  },
  {
    Icon: Zap,
    title: "Simple by design",
    body: "No apps to download, no accounts required to book. Just pick a venue, pick a time, and go.",
  },
];

export default function AboutPage() {
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
            className="hidden sm:block text-sm font-semibold text-accent transition-colors"
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
              src="https://images.unsplash.com/photo-1665855031742-a87f5964adf1?q=80&w=2148&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt=""
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/55" />
          </div>
          <div className="relative mx-auto max-w-5xl px-4 pt-24 pb-24 sm:pt-32 sm:pb-28 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 text-white px-4 py-1.5 text-xs font-semibold uppercase tracking-widest mb-6">
              About ReZerve
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.08] mb-6">
              Venue booking,<br />
              <span className="text-accent">done right.</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/75 max-w-2xl mx-auto leading-relaxed">
              ReZerve is a platform that connects people with venues — making it easy to discover locations, check real-time availability, and confirm bookings in seconds.
            </p>
          </div>
        </section>

        {/* ── Mission ── */}
        <section className="bg-background border-y border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-4">Our mission</h2>
                <p className="text-base sm:text-lg text-muted leading-relaxed">
                  We believe everyone deserves a frictionless way to reserve a space. ReZerve gives venues the tools to manage bookings, set their own rules, and communicate with guests — while keeping the experience simple and transparent for everyone who books.
                </p>
              </div>
              <div className="rounded-2xl overflow-hidden aspect-4/3 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://plus.unsplash.com/premium_photo-1664391631217-d53431f0effd?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="Venue space"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Values ── */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground text-center mb-12">What we stand for</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALUES.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-background p-6 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-accent" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-background border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-3">Ready to book?</h2>
            <p className="text-muted text-base mb-8 max-w-md mx-auto">
              Browse available venues and make a booking in under a minute.
            </p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 rounded-full bg-accent text-white px-8 py-3.5 text-[15px] font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-accent/25"
            >
              Find a venue →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
