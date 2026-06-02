"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applyTheme, clearTheme } from "@/lib/themes";
import type { Me, LocationInfo } from "@/lib/admin-types";

export type { Me, LocationInfo };

export function useLocationAdmin() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLocation = useCallback(async (locationId: string) => {
    const res = await fetch("/api/admin/locations");
    const json = await res.json();
    const loc = (json.locations ?? []).find((l: LocationInfo) => l.id === locationId);
    if (loc) {
      setLocation(loc);
    }
    return loc as LocationInfo | undefined;
  }, []);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/admin/me");
    if (res.status === 401) { router.replace("/admin/login"); return; }
    const json = await res.json();
    if (json.role !== "location_admin") {
      router.replace("/admin");
      return;
    }
    setMe(json);
    return json as Me;
  }, [router]);

  useEffect(() => {
    setLoading(true);
    loadMe().then((m) => {
      if (m?.location_id) {
        loadLocation(m.location_id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [loadMe, loadLocation]);

  useEffect(() => {
    applyTheme(location?.accent_color ?? null);
    return () => clearTheme();
  }, [location?.accent_color]);

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return { me, location, onLogout, loading, loadLocation };
}
