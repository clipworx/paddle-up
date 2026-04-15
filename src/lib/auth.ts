import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const ADMIN_COOKIE_NAME = "admin_token";
const ISSUER = "paddle-up-admin";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export type AdminClaims = JWTPayload & {
  sub: string;
  username: string;
};

export async function signAdminToken(
  adminId: string,
  username: string
): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyAdminToken(
  token: string
): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string"
    ) {
      return null;
    }
    return payload as AdminClaims;
  } catch {
    return null;
  }
}
