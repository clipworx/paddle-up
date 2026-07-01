"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

type Props = {
  onLogout: () => void;
};

const NAV_ITEMS = [
  { label: "Sessions", href: "/admin" },
  { label: "Locations", href: "/admin/locations" },
  { label: "Bookings", href: "/admin/bookings" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Admins", href: "/admin/admins" },
  { label: "Settings", href: "/admin/settings" },
] as const;

export function AdminNav({ onLogout }: Props) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto max-w-5xl w-full px-4 h-14 flex items-center gap-4">
        {/* Brand */}
        <Link href="/admin" className="flex items-center gap-2 shrink-0 mr-2">
          <Logo size={28} />
          <span className="text-sm font-bold text-foreground hidden sm:block">ReZerve</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(({ label, href }) => {
            const active = href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-foreground hover:bg-accent/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Account + Log out */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/admin/account"
            className={`text-sm font-semibold transition-colors ${
              pathname === "/admin/account" ? "text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            Account
          </Link>
          <button
            onClick={onLogout}
            className="text-sm font-semibold text-muted hover:text-accent transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
