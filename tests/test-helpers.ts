import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createServerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export interface TestUserContext {
  id: string;
  email: string;
  fullName: string;
  role: string;
  sessionToken: string;
  cookieHeader: string;
}

/**
 * Creates or retrieves a seeded user and generates an active server session for tests.
 */
export async function getTestUserSession(email: string): Promise<TestUserContext> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error(`Seeded test user ${email} not found in database`);
  }

  const { token } = await createServerSession(user.id);
  const cookieHeader = `${SESSION_COOKIE_NAME}=${token}`;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    sessionToken: token,
    cookieHeader,
  };
}

/**
 * Creates an authorized NextRequest for route handler testing.
 */
export function createMockRequest(
  url: string,
  options?: {
    method?: string;
    sessionToken?: string | null;
    body?: any;
    headers?: Record<string, string>;
  }
): NextRequest {
  const method = options?.method || "GET";
  const headers = new Headers(options?.headers || {});

  if (options?.sessionToken) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${options.sessionToken}`);
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (options?.body) {
    if (options.body instanceof FormData) {
      init.body = options.body;
    } else {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(options.body);
    }
  }

  return new NextRequest(new URL(url, "http://localhost:3000"), init as any);
}
