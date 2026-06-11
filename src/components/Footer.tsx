"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Logo } from "@/components/Logo";

type SiteSettings = {
  contact_email: string | null;
  contact_facebook: string | null;
  contact_instagram: string | null;
  contact_whatsapp: string | null;
};

export function Footer() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((j) => setSettings(j))
      .catch(() => {});
  }, []);

  const hasContact =
    settings &&
    (settings.contact_email || settings.contact_facebook || settings.contact_instagram || settings.contact_whatsapp);

  return (
    <footer className="border-t border-border bg-surface mt-auto">
      {/* Register your facility CTA */}
      {hasContact && (
        <div className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm font-bold text-foreground">Want to list your courts on ReZerve?</p>
              <p className="text-xs text-muted mt-0.5 max-w-sm">
                Register your facility and let players discover and book your courts instantly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {settings.contact_email && (
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:border-accent/50 hover:text-accent transition-colors"
                >
                  <Mail size={13} />
                  Email us
                </a>
              )}
              {settings.contact_facebook && (
                <a
                  href={settings.contact_facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:border-accent/50 hover:text-accent transition-colors"
                >
                  Facebook
                </a>
              )}
              {settings.contact_instagram && (
                <a
                  href={settings.contact_instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:border-accent/50 hover:text-accent transition-colors"
                >
                  Instagram
                </a>
              )}
              {settings.contact_whatsapp && (
                <a
                  href={`https://wa.me/${settings.contact_whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:border-accent/50 hover:text-accent transition-colors"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="mx-auto max-w-5xl px-4 py-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Logo size={22} />
          <span className="text-sm font-bold text-foreground">Re<span className="text-accent">Z</span>erve</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted">
          <Link href="/book" className="hover:text-foreground transition-colors">Book a court</Link>
          <Link href="/play" className="hover:text-foreground transition-colors">Open play</Link>
          <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
