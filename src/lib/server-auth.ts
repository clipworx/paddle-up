import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME, type AdminClaims } from "./auth";

export async function getAdminClaims(): Promise<AdminClaims | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
