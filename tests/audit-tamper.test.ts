import { describe, it, expect } from "vitest";
import { logAuditEvent, verifyAuditChain } from "@/lib/audit/audit-service";
import { prisma } from "@/lib/db/prisma";

describe("Audit Trail & Cryptographic Hash Chain Integrity", () => {
  it("maintains a valid hash chain under normal event logging", async () => {
    // 1. Verify chain is initially valid
    const initialCheck = await verifyAuditChain();
    expect(initialCheck.isValid).toBe(true);

    // 2. Append new audit events
    await logAuditEvent({
      action: "DOCUMENT_VIEW",
      resourceType: "DOCUMENT",
      resourceId: "test-doc-id",
      outcome: "SUCCESS",
      metadata: { viewer: "test" },
    });

    await logAuditEvent({
      action: "ACCESS_DENIED",
      resourceType: "DOCUMENT",
      resourceId: "unauthorized-doc-id",
      outcome: "DENIED",
      metadata: { reason: "Missing grant" },
    });

    // 3. Verify chain remains completely valid
    const postCheck = await verifyAuditChain();
    expect(postCheck.isValid).toBe(true);
    expect(postCheck.verifiedEvents).toBe(initialCheck.verifiedEvents + 2);
  });

  it("detects tampering when an existing audit event's metadata or action is modified in the database", async () => {
    // 1. Create a known test event
    const event = await logAuditEvent({
      action: "DOCUMENT_DOWNLOAD",
      resourceType: "DOCUMENT",
      resourceId: "tamper-target-doc",
      outcome: "SUCCESS",
      metadata: { note: "original value" },
    });

    // 2. Directly tamper with the database record (simulating an attacker modifying DB rows)
    await prisma.auditEvent.update({
      where: { id: event.id },
      data: {
        outcome: "DENIED", // Tampered value!
      },
    });

    // 3. Chain verification MUST report invalid and pinpoint the tampered event ID!
    const tamperedCheck = await verifyAuditChain();
    expect(tamperedCheck.isValid).toBe(false);
    expect(tamperedCheck.tamperedEventId).toBe(event.id);
    expect(tamperedCheck.error).toContain("Tampered event detected");

    // Revert the tamper so subsequent tests operate cleanly
    await prisma.auditEvent.update({
      where: { id: event.id },
      data: { outcome: "SUCCESS" },
    });

    const revertedCheck = await verifyAuditChain();
    expect(revertedCheck.isValid).toBe(true);
  });

  it("detects event deletion or sequence gaps in the hash chain", async () => {
    // 1. Log two consecutive events
    const event1 = await logAuditEvent({
      action: "DOCUMENT_VIEW",
      resourceType: "DOCUMENT",
      resourceId: "gap-test-1",
      outcome: "SUCCESS",
    });

    const event2 = await logAuditEvent({
      action: "DOCUMENT_VIEW",
      resourceType: "DOCUMENT",
      resourceId: "gap-test-2",
      outcome: "SUCCESS",
    });

    // 2. Delete the first event directly from the database (simulating log deletion)
    await prisma.auditEvent.delete({
      where: { id: event1.id },
    });

    // 3. Verification must fail
    const deletionCheck = await verifyAuditChain();
    expect(deletionCheck.isValid).toBe(false);
    expect(deletionCheck.error).toBeDefined();

    // 4. Restore chain integrity: clean up trailing event and reset head to state before the test
    await prisma.auditEvent.delete({ where: { id: event2.id } });
    await prisma.auditChainHead.update({
      where: { id: "singleton" },
      data: {
        latestSequenceNumber: event1.sequenceNumber - 1,
        latestHash: event1.previousEventHash,
      },
    });

    const restoredCheck = await verifyAuditChain();
    expect(restoredCheck.isValid).toBe(true);
  });
});
