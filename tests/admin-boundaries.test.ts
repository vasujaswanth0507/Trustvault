import { describe, it, expect } from "vitest";
import { GET as getOverviewRoute } from "@/app/api/admin/overview/route";
import { GET as getUsersRoute } from "@/app/api/admin/users/route";
import { PATCH as patchUserRoute } from "@/app/api/admin/users/[id]/route";
import { GET as getDocumentRoute } from "@/app/api/documents/[id]/route";
import { GET as downloadRoute } from "@/app/api/documents/[id]/download/route";
import { POST as grantPermissionRoute } from "@/app/api/documents/[id]/permissions/route";
import { createMockRequest, getTestUserSession } from "./test-helpers";
import { prisma } from "@/lib/db/prisma";

describe("Administrative Boundary Enforcement", () => {
  it("Administrator can view admin overview and user management lists", async () => {
    const admin = await getTestUserSession("admin@example.test");

    const overviewReq = createMockRequest("/api/admin/overview", { sessionToken: admin.sessionToken });
    const overviewRes = await getOverviewRoute(overviewReq);
    expect(overviewRes.status).toBe(200);

    const usersReq = createMockRequest("/api/admin/users", { sessionToken: admin.sessionToken });
    const usersRes = await getUsersRoute(usersReq);
    expect(usersRes.status).toBe(200);
    const usersBody = await usersRes.json();
    expect(usersBody.users.length).toBeGreaterThanOrEqual(5);
  });

  it("Non-administrator cannot access administrative endpoints", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");

    const overviewReq = createMockRequest("/api/admin/overview", { sessionToken: ownerA.sessionToken });
    const overviewRes = await getOverviewRoute(overviewReq);
    expect(overviewRes.status).toBe(403);

    const usersReq = createMockRequest("/api/admin/users", { sessionToken: ownerA.sessionToken });
    const usersRes = await getUsersRoute(usersReq);
    expect(usersRes.status).toBe(403);
  });

  it("ADMINISTRATOR CANNOT AUTOMATICALLY READ OR DOWNLOAD A CONFIDENTIAL DOCUMENT WITHOUT A GRANT", async () => {
    const admin = await getTestUserSession("admin@example.test");
    const ownerA = await getTestUserSession("owner-a@example.test");

    // Strictly confidential M&A strategy doc owned by Owner A
    const confidentialDoc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    // 1. Admin attempts to read confidential document details
    const readReq = createMockRequest(`/api/documents/${confidentialDoc.id}`, { sessionToken: admin.sessionToken });
    const readRes = await getDocumentRoute(readReq, { params: { id: confidentialDoc.id } });
    expect(readRes.status).toBe(404);

    // 2. Admin attempts to download confidential file bytes
    const downloadReq = createMockRequest(`/api/documents/${confidentialDoc.id}/download`, { sessionToken: admin.sessionToken });
    const downloadRes = await downloadRoute(downloadReq, { params: { id: confidentialDoc.id } });
    expect(downloadRes.status).toBe(404);
    const bodyText = await downloadRes.text();
    expect(bodyText).not.toContain("RESTRICTED EXECUTIVE MEMO");
  });

  it("Administrator cannot silently grant themselves access to an owner's document", async () => {
    const admin = await getTestUserSession("admin@example.test");
    const ownerA = await getTestUserSession("owner-a@example.test");

    const confidentialDoc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    const grantReq = createMockRequest(`/api/documents/${confidentialDoc.id}/permissions`, {
      method: "POST",
      sessionToken: admin.sessionToken,
      body: { email: admin.email, permissionLevel: "READ" },
    });
    const grantRes = await grantPermissionRoute(grantReq, { params: { id: confidentialDoc.id } });

    // Fails with 404 because Admin is not the owner
    expect(grantRes.status).toBe(404);
  });

  it("Administrator cannot deactivate their own account (lockout protection)", async () => {
    const admin = await getTestUserSession("admin@example.test");

    const patchReq = createMockRequest(`/api/admin/users/${admin.id}`, {
      method: "PATCH",
      sessionToken: admin.sessionToken,
      body: { isActive: false },
    });
    const patchRes = await patchUserRoute(patchReq, { params: { id: admin.id } });

    expect(patchRes.status).toBe(400);
    const body = await patchRes.json();
    expect(body.error).toContain("cannot deactivate their own active account");
  });
});
