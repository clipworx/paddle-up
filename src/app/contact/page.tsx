"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { CheckCircle2 } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  name_required:        "Please enter your name.",
  email_invalid:        "Please enter a valid email address.",
  message_required:     "Please enter a message.",
  message_too_long:     "Message must be under 2000 characters.",
  email_not_configured: "Email is not configured yet. Please try again later.",
};

export default function ContactPage() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [sent,    setSent]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, phone, message }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(ERROR_MESSAGES[json.error] ?? "Something went wrong. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-5xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo size={28} />
            <span className="text-[15px] font-extrabold text-foreground tracking-tight">
              Re<span className="text-accent">Z</span>erve
            </span>
          </Link>
        </div>
      </nav>

      <main className="flex-1 mx-auto max-w-lg w-full px-4 py-16 sm:py-24">
        {sent ? (
          <div className="text-center py-16 space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-accent" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground">Message sent!</h2>
            <p className="text-muted text-sm max-w-xs mx-auto">
              Thanks for reaching out. We&apos;ll get back to you as soon as we can.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-sm font-semibold text-accent hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-3">
                Get your booking page
              </h1>
              <p className="text-muted text-base max-w-sm mx-auto leading-relaxed">
                Tell us a bit about your facility and we&apos;ll get you set up — usually within 24 hours.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Your name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan dela Cruz"
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Email address <span className="text-accent">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@example.com"
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Phone number <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xx xxx xxxx"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Tell us about your facility <span className="text-accent">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How many courts do you have? What sport? Where are you located?"
                  required
                  rows={5}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none"
                />
                <p className="text-xs text-muted mt-1 text-right">{message.length}/2000</p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-accent text-white py-3.5 text-[15px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
