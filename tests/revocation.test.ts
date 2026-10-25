import { describe, it, expect } from "vitest";
import { GET as getDocumentRoute } from "@/app/api/documents/[id]/route";
import { GET as downloadRoute } from "@/app/api/documents/[id]/download/route";
import { DELETE as revokePermissionRoute } from "@/app/api/documents/[id]/permissions/[permissionId]/route";
import { createMockRequest, getTestUserSession } from "./test-helpers";
import { prisma } from "@/lib/db/prisma";

describe("Immediate Permission Revocation", () => {
  it("immediately denies access upon grant revocation with no stale authorization", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const viewerB = await getTestUserSession("viewer-b@example.test");

    // 1. Create a document owned by Owner A
    const doc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Security Compliance Matrix" } },
    });

    // 2. Grant Viewer B READ access
    const grant = await prisma.documentPermission.create({
      data: {
        documentId: doc.id,
        granteeId: viewerB.id,
        permissionLevel: "READ",
        grantedById: ownerA.id,
      },
    });

    // 3. Verify Viewer B CAN read and download the document
    const readReqBefore = createMockRequest(`/api/documents/${doc.id}`, { sessionToken: viewerB.sessionToken });
    const readResBefore = await getDocumentRoute(readReqBefore, { params: { id: doc.id } });
    expect(readResBefore.status).toBe(200);

    const downloadReqBefore = createMockRequest(`/api/documents/${doc.id}/download`, { sessionToken: viewerB.sessionToken });
    const downloadResBefore = await downloadRoute(downloadReqBefore, { params: { id: doc.id } });
    expect(downloadResBefore.status).toBe(200);

    // 4. Owner A revokes the grant via API
    const revokeReq = createMockRequest(`/api/documents/${doc.id}/permissions/${grant.id}`, {
      method: "DELETE",
      sessionToken: ownerA.sessionToken,
    });
    const revokeRes = await revokePermissionRoute(revokeReq, {
      params: { id: doc.id, permissionId: grant.id },
    });
    expect(revokeRes.status).toBe(200);

    // 5. The VERY NEXT request from Viewer B must be DENIED immediately (returns 404)
    const readReqAfter = createMockRequest(`/api/documents/${doc.id}`, { sessionToken: viewerB.sessionToken });
    const readResAfter = await getDocumentRoute(readReqAfter, { params: { id: doc.id } });
    expect(readResAfter.status).toBe(404);

    // 6. Direct download route also fails immediately with 404 and 0 bytes streamed
    const downloadReqAfter = createMockRequest(`/api/documents/${doc.id}/download`, { sessionToken: viewerB.sessionToken });
    const downloadResAfter = await downloadRoute(downloadReqAfter, { params: { id: doc.id } });
    expect(downloadResAfter.status).toBe(404);
  });
});
