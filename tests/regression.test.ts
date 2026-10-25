import { describe, it, expect } from "vitest";
import { requireDocumentReadAccess, AuthorizationError } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { createMockRequest, getTestUserSession } from "./test-helpers";

describe("Security Regression Verification", () => {
  it("REGRESSION TEST: Bypassing requireDocumentReadAccess allows unauthorized data leakage, whereas the secure service strictly throws 404", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const attackerViewer = await getTestUserSession("viewer-b@example.test");

    const confidentialDoc = await prisma.document.findFirstOrThrow({
      where: { ownerId: ownerA.id, title: { contains: "Project Falcon" } },
    });

    const mockReq = createMockRequest(`/api/documents/${confidentialDoc.id}`, {
      sessionToken: attackerViewer.sessionToken,
    });

    // 1. SECURE IMPLEMENTATION (centralized authorization)
    let caughtError: AuthorizationError | null = null;
    try {
      await requireDocumentReadAccess(mockReq, confidentialDoc.id);
    } catch (err) {
      if (err instanceof AuthorizationError) {
        caughtError = err;
      }
    }

    // In the secure system, access is strictly denied with 404
    expect(caughtError).not.toBeNull();
    expect(caughtError?.statusCode).toBe(404);
    expect(caughtError?.errorCode).toBe("DOCUMENT_NOT_FOUND");

    // 2. INSECURE REGRESSION SCENARIO:
    // If a developer had replaced requireDocumentReadAccess with a direct database query without permission check:
    const insecureDirectLookup = async (docId: string) => {
      // Flawed implementation: only fetches document by ID without verifying ownerId or permissions table
      return await prisma.document.findUnique({ where: { id: docId } });
    };

    const leakedDocument = await insecureDirectLookup(confidentialDoc.id);

    // Assert that without the authorization check, sensitive data WOULD leak
    expect(leakedDocument).not.toBeNull();
    expect(leakedDocument?.title).toBe(confidentialDoc.title);

    // This proves that removing the authorization check causes a direct object reference vulnerability (IDOR),
    // and our centralized authorization check is the indispensable barrier preventing it.
  });
});
