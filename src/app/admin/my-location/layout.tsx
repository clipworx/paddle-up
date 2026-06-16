"use client";

import React from "react";
import { useLocationAdmin } from "@/hooks/useLocationAdmin";
import { LocationAdminNav } from "@/components/LocationAdminNav";
import { LocationAdminContext } from "@/contexts/LocationAdminContext";

export default function LocationAdminLayout({ children }: { children: React.ReactNode }) {
  const { me, location, onLogout, loading, loadLocation } = useLocationAdmin();

  return (
    <LocationAdminContext.Provider value={{ me, location, onLogout, loadLocation }}>
      <div className="min-h-screen bg-surface">
        <LocationAdminNav me={me} locationName={location?.name ?? null} logoUrl={location?.logo_url ?? null} onLogout={onLogout} />
        {loading
          ? <main className="p-10 text-sm text-muted">Loading…</main>
          : children
        }
      </div>
    </LocationAdminContext.Provider>
  );
}
