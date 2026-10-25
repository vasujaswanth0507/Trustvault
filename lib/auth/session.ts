import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateSessionToken } from "@/lib/crypto/hash";
import { User } from "@prisma/client";

export const SESSION_COOKIE_NAME = "trustvault_session";
const DEFAULT_MAX_AGE_SECONDS = 86400; // 24 hours

export interface SessionWithUser {
  sessionToken: string;
  userId: string;
  expiresAt: Date;
  user: User;
}

/**
 * Creates a server-side session in the database and returns the opaque session token.
 */
export async function createServerSession(
  userId: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const maxAge = parseInt(process.env.SESSION_MAX_AGE_SECONDS || "", 10) || DEFAULT_MAX_AGE_SECONDS;
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  await prisma.session.create({
    data: {
      sessionToken: token,
      userId,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  return { token, expiresAt };
}

/**
 * Attaches the session cookie to an outgoing HTTP response.
 */
export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Clears the session cookie on an outgoing response.
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Extracts the raw session token from NextRequest or cookie jar.
 */
export function extractSessionToken(req?: NextRequest): string | null {
  if (req) {
    const cookie = req.cookies.get(SESSION_COOKIE_NAME);
    if (cookie?.value) return cookie.value;

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }
  }

  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    return cookie?.value || null;
  } catch {
    return null;
  }
}

/**
 * Validates the session token against the database.
 * Enforces expiration and account active status strictly.
 */
export async function validateSession(token: string | null): Promise<SessionWithUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Enforce session expiration
  if (session.expiresAt < new Date()) {
    // Delete expired session asynchronously
    prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // If user record is missing, session is invalid
  if (!session.user) {
    return null;
  }

  return {
    sessionToken: session.sessionToken,
    userId: session.userId,
    expiresAt: session.expiresAt,
    user: session.user,
  };
}

/**
 * Destroys a session in the database.
 */
export async function destroySession(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await prisma.session.delete({
      where: { sessionToken: token },
    });
  } catch {
    // Ignore if already deleted
  }
}
