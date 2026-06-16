"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Circle, Settings, Megaphone, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { Me } from "@/lib/admin-types";

type TabDef = {
  id: string;
  label: string;
  href: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const TABS: TabDef[] = [
  { id: "dashboard",     label: "Dashboard",     href: "/admin/my-location",               Icon: LayoutDashboard },
  { id: "bookings",      label: "Bookings",      href: "/admin/my-location/bookings",      Icon: CalendarDays },
  { id: "courts",        label: "Courts",        href: "/admin/my-location/courts",        Icon: Circle },
  { id: "announcements", label: "Announcements", href: "/admin/my-location/announcements", Icon: Megaphone },
  { id: "settings",      label: "Settings",      href: "/admin/my-location/settings",      Icon: Settings },
];

function useActiveTab() {
  const pathname = usePathname();
  if (pathname === "/admin/my-location") return "dashboard";
  if (pathname.startsWith("/admin/my-location/bookings")) return "bookings";
  if (pathname.startsWith("/admin/my-location/courts")) return "courts";
  if (pathname.startsWith("/admin/my-location/announcements")) return "announcements";
  if (pathname.startsWith("/admin/my-location/settings")) return "settings";
  return "dashboard";
}

type Props = {
  me: Me | null;
  locationName: string | null;
  logoUrl: string | null;
  onLogout: () => void;
};

export function LocationAdminNav({ me, locationName, logoUrl, onLogout }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTab = useActiveTab();
  const avatarInitial = (me?.username?.[0] ?? "A").toUpperCase();

  return (
    <>
      {/* ── Top nav ── */}
      <nav className="sticky top-0 z-40 bg-background/92 backdrop-blur-md border-b border-border">
        <div className="max-w-335 mx-auto flex items-center gap-4 py-2.75 px-4 sm:px-6.5">
          {/* Brand */}
          <Link
            href="/admin/my-location"
            className="flex items-center gap-2.25 font-extrabold text-[19px] tracking-tight text-foreground shrink-0"
          >
            <Logo size={26} />
            <span className="hidden sm:block">ReZerve</span>
            <span className="font-mono text-[10px] font-bold tracking-[.12em] uppercase text-muted bg-surface px-1.75 py-0.75 rounded-full ml-0.5 hidden sm:block">
              Admin
            </span>
          </Link>

          {/* Tab nav — desktop */}
          <div className="hidden sm:flex items-center gap-0.5 ml-2 overflow-x-auto">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-1.75 px-3.25 py-2.25 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <tab.Icon size={15} />
                {tab.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            <Link
              href="/book"
              target="_blank"
              className="text-[13.5px] font-semibold text-muted hover:text-foreground transition-colors hidden sm:block"
            >
              Booking page ↗
            </Link>
            <Link
              href="/admin/my-location/account"
              className="text-[13.5px] font-semibold text-muted hover:text-foreground transition-colors hidden sm:block"
            >
              Account
            </Link>
            <button
              onClick={onLogout}
              className="text-[13.5px] font-semibold text-muted hover:text-accent transition-colors hidden sm:block"
            >
              Log out
            </button>
            {/* Avatar */}
            <div className="w-9.5 h-9.5 rounded-full bg-accent flex items-center justify-center text-white font-bold text-[14px] shrink-0 select-none overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : avatarInitial}
            </div>
            {/* Mobile burger */}
            <button
              onClick={() => setMenuOpen(true)}
              className="w-10.5 h-10.5 rounded-xl bg-background border border-border flex items-center justify-center text-foreground sm:hidden"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile drawer overlay ── */}
      <div
        className={`fixed inset-0 z-50 bg-[rgba(15,20,15,.4)] transition-opacity duration-200 ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMenuOpen(false)}
      />
      {/* ── Mobile drawer panel ── */}
      <div
        className={`fixed top-0 right-0 h-full w-[min(82vw,330px)] bg-background z-60 flex flex-col p-4.5 shadow-2xl transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between mb-4.5">
          <div>
            <div className="font-extrabold text-[17px] tracking-tight text-foreground">{locationName ?? "My Location"}</div>
            <div className="font-mono text-[10px] font-bold tracking-[.12em] uppercase text-muted mt-0.5">Admin console</div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="w-8.5 h-8.5 rounded-full border border-border flex items-center justify-center text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 w-full px-3.5 py-3.5 rounded-[14px] text-[15px] font-semibold transition-colors ${
                activeTab === tab.id ? "bg-accent/15 text-accent" : "text-foreground hover:bg-surface"
              }`}
            >
              <tab.Icon size={20} className={activeTab === tab.id ? "text-accent" : "text-muted"} />
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="pt-3.5 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9.5 h-9.5 rounded-full bg-accent flex items-center justify-center text-white font-bold text-[14px] shrink-0 overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : avatarInitial}
            </div>
            <span className="text-[13.5px] font-semibold text-foreground">{me?.username}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/my-location/account" className="text-[13.5px] font-semibold text-muted hover:text-foreground transition-colors">
              Account
            </Link>
            <button onClick={onLogout} className="text-[13.5px] font-semibold text-muted hover:text-accent transition-colors">
              Log out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
