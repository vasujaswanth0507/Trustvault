import { describe, it, expect } from "vitest";
import { GET as getDocumentRoute, PATCH as patchDocumentRoute, DELETE as deleteDocumentRoute } from "@/app/api/documents/[id]/route";
import { GET as downloadRoute } from "@/app/api/documents/[id]/download/route";
import { GET as getPermissionsRoute, POST as postPermissionsRoute } from "@/app/api/documents/[id]/permissions/route";
import { GET as listDocumentsRoute } from "@/app/api/documents/route";
import { createMockRequest, getTestUserSession } from "./test-helpers";
import { prisma } from "@/lib/db/prisma";

describe("Document Isolation & IDOR Defense", () => {
  it("Owner A can read their own document", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const doc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    const req = createMockRequest(`/api/documents/${doc.id}`, { sessionToken: ownerA.sessionToken });
    const res = await getDocumentRoute(req, { params: { id: doc.id } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.document.id).toBe(doc.id);
    expect(body.document.permissionLevel).toBe("OWNER");
  });

  it("Owner B cannot read Owner A's unshared document (IDOR defense returns 404)", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const ownerB = await getTestUserSession("owner-b@example.test");

    // Doc 3 is strictly private to Owner A
    const privateDoc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    // Owner B directly requests Owner A's document ID
    const req = createMockRequest(`/api/documents/${privateDoc.id}`, { sessionToken: ownerB.sessionToken });
    const res = await getDocumentRoute(req, { params: { id: privateDoc.id } });

    // Must return 404 to avoid resource enumeration
    expect(res.status).toBe(404);
  });

  it("Viewer A cannot access a document without a grant", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const viewerA = await getTestUserSession("viewer-a@example.test");

    // Private doc owned by Owner A, unshared with Viewer A
    const privateDoc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    const req = createMockRequest(`/api/documents/${privateDoc.id}`, { sessionToken: viewerA.sessionToken });
    const res = await getDocumentRoute(req, { params: { id: privateDoc.id } });

    expect(res.status).toBe(404);
  });

  it("Unauthorized users cannot download confidential file bytes", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const viewerB = await getTestUserSession("viewer-b@example.test");

    const privateDoc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    const req = createMockRequest(`/api/documents/${privateDoc.id}/download`, { sessionToken: viewerB.sessionToken });
    const res = await downloadRoute(req, { params: { id: privateDoc.id } });

    expect(res.status).toBe(404);
    // Ensure 0 document bytes are streamed
    const bodyText = await res.text();
    expect(bodyText).not.toContain("RESTRICTED EXECUTIVE MEMO");
  });

  it("Unauthorized search results do not reveal private documents or leak counts", async () => {
    const viewerA = await getTestUserSession("viewer-a@example.test");

    // Viewer A searches for documents containing "Falcon" (Doc 3 is owned by Owner A and unshared)
    const req = createMockRequest("/api/documents?search=Falcon", { sessionToken: viewerA.sessionToken });
    const res = await listDocumentsRoute(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents.length).toBe(0);
    expect(body.pagination.total).toBe(0);
  });

  it("Non-owner cannot update document metadata", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const viewerB = await getTestUserSession("viewer-b@example.test");

    const doc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    const req = createMockRequest(`/api/documents/${doc.id}`, {
      method: "PATCH",
      sessionToken: viewerB.sessionToken,
      body: { title: "Malicious Tampered Title" },
    });
    const res = await patchDocumentRoute(req, { params: { id: doc.id } });

    expect(res.status).toBe(404);

    // Verify document was not modified
    const unchanged = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(unchanged.title).toBe(doc.title);
  });

  it("Non-owner cannot delete another user's document", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const ownerB = await getTestUserSession("owner-b@example.test");

    const doc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    const req = createMockRequest(`/api/documents/${doc.id}`, {
      method: "DELETE",
      sessionToken: ownerB.sessionToken,
    });
    const res = await deleteDocumentRoute(req, { params: { id: doc.id } });

    expect(res.status).toBe(404);

    const docStillExists = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(docStillExists?.deletedAt).toBeNull();
  });

  it("Non-owner cannot list or grant permissions on another owner's document", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const ownerB = await getTestUserSession("owner-b@example.test");

    const doc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    // 1. Attempt listing permissions
    const listReq = createMockRequest(`/api/documents/${doc.id}/permissions`, { sessionToken: ownerB.sessionToken });
    const listRes = await getPermissionsRoute(listReq, { params: { id: doc.id } });
    expect(listRes.status).toBe(404);

    // 2. Attempt granting permissions
    const grantReq = createMockRequest(`/api/documents/${doc.id}/permissions`, {
      method: "POST",
      sessionToken: ownerB.sessionToken,
      body: { email: "viewer-b@example.test", permissionLevel: "READ" },
    });
    const grantRes = await postPermissionsRoute(grantReq, { params: { id: doc.id } });
    expect(grantRes.status).toBe(404);
  });

  it("A viewer with READ cannot gain EDIT access or modify document metadata", async () => {
    const viewerA = await getTestUserSession("viewer-a@example.test");
    // Q3 Financial Report is shared with Viewer A with READ permission
    const readDoc = await prisma.document.findFirstOrThrow({
      where: { title: { contains: "Q3 Financial Audit Report" } },
    });

    const req = createMockRequest(`/api/documents/${readDoc.id}`, {
      method: "PATCH",
      sessionToken: viewerA.sessionToken,
      body: { title: "Hacked by Viewer" },
    });
    const res = await patchDocumentRoute(req, { params: { id: readDoc.id } });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Insufficient permission");
  });
});
