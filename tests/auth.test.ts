import { describe, it, expect, beforeEach } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { GET as documentsRoute } from "@/app/api/documents/route";
import { createMockRequest, getTestUserSession } from "./test-helpers";
import { prisma } from "@/lib/db/prisma";

describe("Authentication Security", () => {
  it("anonymous users cannot read protected documents", async () => {
    const unauthenticatedReq = createMockRequest("/api/documents");
    const res = await documentsRoute(unauthenticatedReq);
    expect(res.status).toBe(401);
  });

  it("invalid credentials are rejected with generic 401 without revealing account existence", async () => {
    // 1. Non-existent account
    const req1 = createMockRequest("/api/auth/login", {
      method: "POST",
      body: { email: "nonexistent@example.test", password: "Password123!" },
    });
    const res1 = await loginRoute(req1);
    expect(res1.status).toBe(401);
    const body1 = await res1.json();
    expect(body1.error).toBe("Invalid email or password");

    // 2. Existing account with wrong password
    const req2 = createMockRequest("/api/auth/login", {
      method: "POST",
      body: { email: "admin@example.test", password: "WrongPassword123!" },
    });
    const res2 = await loginRoute(req2);
    expect(res2.status).toBe(401);
    const body2 = await res2.json();
    expect(body2.error).toBe("Invalid email or password");
  });

  it("inactive accounts cannot access protected resources", async () => {
    // 1. Attempt login with inactive account using valid credentials -> must be rejected with 403
    const loginReq = createMockRequest("/api/auth/login", {
      method: "POST",
      body: { email: "deactivated-user@example.test", password: "Password123!" },
    });
    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(403);
    const loginBody = await loginRes.json();
    expect(loginBody.error).toContain("deactivated");

    // 2. Attempt authenticated request with existing session -> must be rejected with 403
    const { sessionToken } = await getTestUserSession("deactivated-user@example.test");
    const req = createMockRequest("/api/auth/me", { sessionToken });
    const res = await meRoute(req);
    expect(res.status).toBe(403);
  });

  it("logout invalidates the server session", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");

    // Before logout: session is valid
    const reqBefore = createMockRequest("/api/auth/me", { sessionToken: ownerA.sessionToken });
    const resBefore = await meRoute(reqBefore);
    expect(resBefore.status).toBe(200);

    // Call logout endpoint
    const logoutReq = createMockRequest("/api/auth/logout", {
      method: "POST",
      sessionToken: ownerA.sessionToken,
    });
    const logoutRes = await logoutRoute(logoutReq);
    expect(logoutRes.status).toBe(200);

    // After logout: session is destroyed
    const reqAfter = createMockRequest("/api/auth/me", { sessionToken: ownerA.sessionToken });
    const resAfter = await meRoute(reqAfter);
    expect(resAfter.status).toBe(401);
  });
});
