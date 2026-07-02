import Link from "next/link";
import { Hanken_Grotesk, Space_Mono } from "next/font/google";
import {
  CalendarCheck,
  Globe,
  Clock,
  CreditCard,
  Trophy,
  CheckCircle2,
  ArrowRight,
  Building2,
  Link2,
  CircleDollarSign,
} from "lucide-react";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hk",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-hk",
  display: "swap",
});

// ─── Design tokens ───────────────────────────────────────────────────────────
const P   = "#24AE24";
const I9  = "#1a1f24";
const I8  = "#2d3748";
const I6  = "#4b5563";
const I5  = "#5b636d";
const I4  = "#6b7280";
const I2  = "#e5e7eb";
const I1  = "#f1f4f1";
const I0  = "#f8faf8";
const SUB = "#f3f6f3";
const PSOFT = "#e8fce8";
const G1  = "#dff7df";
const G7  = "#15803d";

const SHADOW_MD  = "0 4px 24px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06)";
const SHADOW_SM  = "0 1px 6px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)";
const SHADOW_LG  = "0 12px 40px rgba(0,0,0,.11), 0 2px 8px rgba(0,0,0,.06)";
const SHADOW_P   = `0 6px 22px rgba(36,174,36,.32)`;
const SHADOW_FL  = "0 8px 28px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.08)";

// ─── Sports bar data ─────────────────────────────────────────────────────────
const SPORTS = ["Tennis", "Padel", "Pickleball", "Squash", "Badminton"];

// ─── Dashboard mockup ─────────────────────────────────────────────────────────
function DashboardMockup() {
  const slots = [
    // court, [6PM, 7PM, 8PM, 9PM] — true=booked, false=open
    { name: "Tennis 1",  slots: [true,  true,  false, false] },
    { name: "Padel 2",   slots: [false, true,  true,  false] },
    { name: "Pickle 3",  slots: [false, false, true,  false] },
  ];
  return (
    <div style={{ position: "relative", flex: "0 0 auto", width: "100%", maxWidth: 500 }}>
      {/* Browser shell */}
      <div style={{
        background: "#fff",
        borderRadius: 20,
        boxShadow: SHADOW_LG,
        overflow: "visible",
        position: "relative",
      }}>
        {/* Browser chrome */}
        <div style={{ background: SUB, borderRadius: "20px 20px 0 0", padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{ background: "#fff", border: `1px solid ${I2}`, borderRadius: 20, padding: "4px 14px", fontSize: 12, color: I5, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: P }} />
              rezerve.today/book/riverside
            </div>
          </div>
        </div>

        {/* Dashboard body */}
        <div style={{ background: SUB, padding: "14px 16px 20px" }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Today's Bookings", value: "14" },
              { label: "Revenue", value: "₱8,400" },
              { label: "Active Courts", value: "3" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "12px 12px 10px", boxShadow: SHADOW_SM }}>
                <div style={{ fontSize: 9, color: I4, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: I9, letterSpacing: "-0.02em" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Booking grid */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "14px 14px 12px", boxShadow: SHADOW_SM }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: I9, marginBottom: 10 }}>Today</div>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "76px repeat(4,1fr)", gap: 4, marginBottom: 4 }}>
              <div />
              {["6 PM","7 PM","8 PM","9 PM"].map(t => (
                <div key={t} style={{ fontSize: 9, fontWeight: 600, color: I4, textAlign: "center" }}>{t}</div>
              ))}
            </div>
            {/* Rows */}
            {slots.map(({ name, slots: s }) => (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "76px repeat(4,1fr)", gap: 4, marginBottom: 4, alignItems: "center" }}>
                <div style={{ fontSize: 10, color: I8, fontWeight: 600 }}>{name}</div>
                {s.map((booked, i) => (
                  <div key={i} style={{
                    height: 24, borderRadius: 5,
                    background: booked ? G1 : I0,
                    display: "grid", placeItems: "center",
                  }}>
                    <span style={{ fontSize: 8, fontWeight: booked ? 700 : 400, color: booked ? G7 : I4 }}>
                      {booked ? "Booked" : "Open"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 4, background: "#fff", borderRadius: "0 0 20px 20px" }} />
      </div>

      {/* Floating notification */}
      <div style={{
        position: "absolute", bottom: -18, left: -28,
        background: "#fff", borderRadius: 15,
        boxShadow: SHADOW_FL,
        padding: "12px 14px", minWidth: 215, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: PSOFT, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <CalendarCheck size={16} color={G7} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: I9 }}>New booking!</div>
            <div style={{ fontSize: 11, color: I5, marginTop: 1 }}>Alex M. · Tennis 1 · Today, 8 PM</div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default function HomePage() {
  return (
    <div
      className={`${hanken.variable} ${mono.variable}`}
      style={{
        fontFamily: "var(--font-hk), system-ui, sans-serif",
        background: "linear-gradient(180deg, #ffffff 0%, #e6f6e6 100%)",
        minHeight: "100vh",
        color: I9,
      }}
    >
      {/* Radial glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 76% at 70% 50%, rgba(143,224,143,.4) 0%, transparent 60%)",
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── Floating pill nav ── */}
        <div style={{ position: "sticky", top: 16, zIndex: 100, maxWidth: 1160, margin: "16px auto 0", padding: "0 24px" }}>
          <div style={{
            display: "flex", alignItems: "center",
            background: "rgba(255,255,255,.92)",
            backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
            border: `1px solid ${I2}`, borderRadius: 9999,
            boxShadow: SHADOW_MD,
            padding: "8px 8px 8px 20px",
          }}>
            {/* Logo */}
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--font-hk)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em", textDecoration: "none", color: I9, flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg, #2ec02e 0%, ${P} 100%)`, display: "grid", placeItems: "center", boxShadow: SHADOW_P }}>
                <CalendarCheck size={15} color="#fff" />
              </div>
              rezerve<span style={{ color: P }}>.today</span>
            </Link>

            {/* Nav links */}
            <div style={{ display: "flex", gap: 2, marginLeft: 26 }} className="hidden sm:flex">
              {[["#how-it-works","How it works"],["#features","Features"],["#sports","Sports"]].map(([href, label]) => (
                <a key={href} href={href} style={{ fontSize: 14, fontWeight: 500, color: I6, padding: "8px 15px", borderRadius: 9999, transition: "all 180ms", textDecoration: "none" }}
                   className="hover:bg-gray-100 hover:text-gray-900">
                  {label}
                </a>
              ))}
            </div>

            {/* CTA */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <Link href="/contact" style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: P, color: "#fff",
                fontSize: 14, fontWeight: 600,
                padding: "10px 20px", borderRadius: 9999,
                boxShadow: SHADOW_P, transition: "all 220ms",
                textDecoration: "none",
              }}
                className="hover:opacity-90"
              >
                Request a demo <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Hero ── */}
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "80px 32px 100px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="flex flex-col lg:grid">
            {/* Left */}
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: PSOFT, border: `1px solid #c3f0c3`, borderRadius: 9999, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: G7, marginBottom: 28, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                For court &amp; sports facility owners
              </div>

              <h1 style={{ fontSize: "clamp(40px, 5vw, 58px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.08, color: I9, marginBottom: 20 }}>
                Your Own Booking Site.<br />
                <span style={{ color: P }}>Zero Setup Cost.</span>
              </h1>

              <p style={{ fontSize: 17, lineHeight: 1.7, color: I5, maxWidth: 460, marginBottom: 32 }}>
                No shared marketplace, no competing listings — just a booking site built entirely around your business.
              </p>

              {/* CTAs */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
                <Link href="/contact" style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: P, color: "#fff",
                  fontSize: 16, fontWeight: 600,
                  padding: "15px 28px", borderRadius: 9999,
                  boxShadow: SHADOW_P, transition: "all 220ms",
                  textDecoration: "none",
                }}
                  className="hover:opacity-90"
                >
                  Get your booking page <ArrowRight size={16} />
                </Link>
                <a href="#how-it-works" style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#fff", color: I8,
                  fontSize: 16, fontWeight: 600,
                  padding: "15px 28px", borderRadius: 9999,
                  border: `1.5px solid ${I2}`, transition: "all 220ms",
                  textDecoration: "none",
                }}
                  className="hover:bg-gray-50"
                >
                  See how it works
                </a>
              </div>

              {/* Bullets */}
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {[
                  ["100% Yours", "Your own link, your own courts. No other venues listed, no distractions."],
                  ["Zero Setup Cost", "No domain fees, no hosting, no developer needed."],
                  ["Just Share & Go", "Send your link and start taking bookings today."],
                ].map(([bold, rest]) => (
                  <div key={bold} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14.5, color: I5 }}>
                    <CheckCircle2 size={18} color={P} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span><strong style={{ color: I9, fontWeight: 600 }}>{bold}</strong> — {rest}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — dashboard mockup */}
            <div className="hidden lg:flex" style={{ justifyContent: "flex-end", paddingBottom: 32 }}>
              <DashboardMockup />
            </div>
          </div>
        </section>

        {/* ── Sports bar ── */}
        <section id="sports" style={{ borderTop: `1px solid ${I1}`, borderBottom: `1px solid ${I1}`, background: SUB, padding: "40px 0" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <p style={{ fontFamily: "var(--font-mono-hk), monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: I4, textTransform: "uppercase" }}>
              Courts for every sport
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              {SPORTS.map((s) => (
                <div key={s} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  background: "#fff", border: `1px solid ${I1}`,
                  borderRadius: 9999, padding: "8px 18px 8px 8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,.05)",
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: P, display: "grid", placeItems: "center", boxShadow: SHADOW_P }}>
                    <Trophy size={14} color="#fff" />
                  </div>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: I8 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" style={{ maxWidth: 1160, margin: "0 auto", padding: "96px 32px" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontFamily: "var(--font-mono-hk), monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: P, textTransform: "uppercase", marginBottom: 14 }}>
              How it works
            </p>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.025em", color: I9 }}>
              Up and running in <span style={{ color: P }}>three steps</span>
            </h2>
            <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.65, color: I5, maxWidth: 520, margin: "16px auto 0" }}>
              No developers. No complex setup. Just your club, your courts, and your members booking in seconds.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="grid grid-cols-1 sm:grid-cols-3">
            {/* Step 01 */}
            <div style={{ background: SUB, borderRadius: 20, padding: 34, display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "var(--font-mono-hk), monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: G7, textTransform: "uppercase", marginBottom: 16 }}>01</div>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: P, display: "grid", placeItems: "center", boxShadow: SHADOW_P, marginBottom: 20 }}>
                <Building2 size={22} color="#fff" />
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>Create your venue</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: I5, marginBottom: 20 }}>Sign up, add your club details and courts. Takes about 5 minutes — no credit card required.</p>
              {/* Club info mini-card */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 16px 14px", boxShadow: SHADOW_SM, marginTop: "auto" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: I4, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>Your club info</div>
                <div style={{ background: I0, border: `1px solid ${I2}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 500, color: I9, marginBottom: 9 }}>
                  Riverside Sports Club
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ background: PSOFT, border: `1.5px solid #c3f0c3`, color: G7, borderRadius: 9999, padding: "5px 14px", fontSize: 12, fontWeight: 700 }}>6 Courts</div>
                  <div style={{ background: I0, border: `1px solid ${I2}`, color: I5, borderRadius: 9999, padding: "5px 14px", fontSize: 12, fontWeight: 600 }}>3 Sports</div>
                </div>
              </div>
            </div>

            {/* Step 02 */}
            <div style={{ background: P, borderRadius: 20, padding: 34, boxShadow: SHADOW_P }}>
              <div style={{ fontFamily: "var(--font-mono-hk), monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,.65)", textTransform: "uppercase", marginBottom: 16 }}>02</div>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "grid", placeItems: "center", marginBottom: 20 }}>
                <Link2 size={22} color="#fff" />
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10, color: "#fff" }}>Share your link</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(255,255,255,.8)" }}>Your club gets its own URL. Share it with members and they can book immediately — no app download needed.</p>
              {/* Link mockup */}
              <div style={{ background: "rgba(255,255,255,.16)", borderRadius: 12, padding: 14, marginTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.65)", marginBottom: 9 }}>Your booking link</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.18)", borderRadius: 9, padding: "9px 12px" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.7)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", flex: 1 }}>rezerve.today/book/yourclub</span>
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                  {["Share", "Email", "IG"].map(ch => (
                    <div key={ch} style={{ flex: 1, height: 28, background: "rgba(255,255,255,.15)", borderRadius: 7, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.85)" }}>
                      {ch}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 03 */}
            <div style={{ background: SUB, borderRadius: 20, padding: 34, display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "var(--font-mono-hk), monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: G7, textTransform: "uppercase", marginBottom: 16 }}>03</div>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: P, display: "grid", placeItems: "center", boxShadow: SHADOW_P, marginBottom: 20 }}>
                <CircleDollarSign size={22} color="#fff" />
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>Watch it run itself</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: I5, marginBottom: 20 }}>Bookings confirmed, reminders sent, payments collected — automatically. You focus on the courts.</p>
              {/* Revenue mini-card */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 16px 14px", boxShadow: SHADOW_SM, marginTop: "auto" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: I4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>This month</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 13 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: I9, letterSpacing: "-0.03em" }}>$4,320</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: P }}>↑ 22%</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
                  {[0.22, 0.35, 0.28, 0.50, 0.42, 0.62, 0.80, 0.92].map((h, i) => (
                    <div key={i} style={{
                      flex: 1, height: `${h * 100}%`,
                      background: i >= 6 ? P : `rgba(36,174,36,${0.18 + i * 0.09})`,
                      borderRadius: "3px 3px 0 0",
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" style={{ background: SUB, borderTop: `1px solid ${I1}` }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "96px 32px" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <p style={{ fontFamily: "var(--font-mono-hk), monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: P, textTransform: "uppercase", marginBottom: 14 }}>
                Features
              </p>
              <h2 style={{ fontSize: "clamp(30px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.025em", color: I9 }}>
                Everything included
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="grid grid-cols-1 sm:grid-cols-2">
              {/* Feature 1 */}
              <div style={{ background: "#fff", borderRadius: 20, padding: 36, boxShadow: SHADOW_SM, transition: "transform 220ms, box-shadow 220ms" }} className="hover:-translate-y-1 hover:shadow-lg">
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: P, display: "grid", placeItems: "center", boxShadow: SHADOW_P, marginBottom: 22 }}>
                  <Globe size={22} color="#fff" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>Your own booking URL</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: I5, marginBottom: 16 }}>Every club gets a custom link. It looks like yours — <strong style={{ color: I8 }}>rezerve.today/book/yourclub</strong></p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: PSOFT, color: G7, borderRadius: 9999, padding: "6px 14px", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: P, display: "block" }} />
                  Unique to your venue
                </span>
              </div>

              {/* Feature 2 */}
              <div style={{ background: "#fff", borderRadius: 20, padding: 36, boxShadow: SHADOW_SM, transition: "transform 220ms, box-shadow 220ms" }} className="hover:-translate-y-1 hover:shadow-lg">
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: P, display: "grid", placeItems: "center", boxShadow: SHADOW_P, marginBottom: 22 }}>
                  <Clock size={22} color="#fff" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>Real-time availability</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: I5, marginBottom: 16 }}>Members always see live slots. No double-bookings, no phone calls, no spreadsheets. The schedule updates the moment a booking lands.</p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: PSOFT, color: G7, borderRadius: 9999, padding: "6px 14px", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: P, display: "block" }} />
                  Always live
                </span>
              </div>

              {/* Feature 3 */}
              <div style={{ background: "#fff", borderRadius: 20, padding: 36, boxShadow: SHADOW_SM, transition: "transform 220ms, box-shadow 220ms" }} className="hover:-translate-y-1 hover:shadow-lg">
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: P, display: "grid", placeItems: "center", boxShadow: SHADOW_P, marginBottom: 22 }}>
                  <CreditCard size={22} color="#fff" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>Payments, handled</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: I5, marginBottom: 22 }}>Accept payment when members book. No chasing, no cash. Funds land in your account automatically.</p>
                <div style={{ display: "flex", gap: 20 }}>
                  {[["0%","setup fee"],["Auto","reminders"],["Instant","confirmation"]].map(([val, lbl]) => (
                    <div key={lbl}>
                      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: val === "Auto" ? G7 : I9 }}>{val}</div>
                      <div style={{ fontSize: 12, color: I5, marginTop: 2 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature 4 — green card */}
              <div style={{ background: P, borderRadius: 20, padding: 36, boxShadow: SHADOW_P, transition: "transform 220ms" }} className="hover:-translate-y-1">
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "grid", placeItems: "center", marginBottom: 22 }}>
                  <Trophy size={22} color="#fff" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10, color: "#fff" }}>All sports, one platform</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(255,255,255,.82)", marginBottom: 22 }}>Tennis, padel, pickleball, squash, badminton — mix them all in one venue. Different courts, same seamless flow.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SPORTS.map(s => (
                    <span key={s} style={{ background: "rgba(255,255,255,.2)", color: "#fff", borderRadius: 9999, padding: "5px 14px", fontSize: 13, fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: `1px solid ${I1}` }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "52px 32px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 40, flexWrap: "wrap", marginBottom: 44 }}>
              {/* Brand */}
              <div style={{ maxWidth: 260 }}>
                <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "var(--font-hk)", fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em", marginBottom: 13, textDecoration: "none", color: I9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, #2ec02e 0%, ${P} 100%)`, display: "grid", placeItems: "center" }}>
                    <CalendarCheck size={13} color="#fff" />
                  </div>
                  rezerve<span style={{ color: P }}>.today</span>
                </Link>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: I5 }}>Your club&apos;s own court booking site. Zero setup cost. Live today.</p>
              </div>

              {/* Links */}
              <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
                {[
                  { heading: "Product", links: [["#how-it-works","How it works"],["#features","Features"],["/contact","Request a demo"]] },
                  { heading: "Sports", links: [["#sports","Tennis"],["#sports","Padel"],["#sports","Pickleball"],["#sports","Squash & Badminton"]] },
                  { heading: "Company", links: [["/about","About"],["/contact","Contact"]] },
                ].map(({ heading, links }) => (
                  <div key={heading}>
                    <h5 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: I9 }}>{heading}</h5>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {links.map(([href, label]) => (
                        <a key={label} href={href} style={{ fontSize: 14, color: I5, textDecoration: "none", transition: "color 150ms" }}
                           className="hover:text-green-600">
                          {label}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ paddingTop: 24, borderTop: `1px solid ${I1}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 13, color: I4 }}>© 2026 Rezerve. All rights reserved.</span>
              <span style={{ fontSize: 13, color: I4 }}>Made for club owners who have better things to do.</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
