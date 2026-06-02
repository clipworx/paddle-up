"use client";

import { createContext, useContext } from "react";
import type { Me, LocationInfo } from "@/lib/admin-types";

type Value = {
  me: Me | null;
  location: LocationInfo | null;
  onLogout: () => void;
  loadLocation: (locationId: string) => Promise<LocationInfo | undefined>;
};

export const LocationAdminContext = createContext<Value>({
  me: null,
  location: null,
  onLogout: () => {},
  loadLocation: async () => undefined,
});

export function useLocationAdminContext() {
  return useContext(LocationAdminContext);
}
