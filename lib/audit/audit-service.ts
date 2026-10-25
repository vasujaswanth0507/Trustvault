import { prisma } from "../db/prisma";
import { computeAuditEventHash, generateOpaqueId, GENESIS_AUDIT_HASH } from "../crypto/hash";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_VIEW"
  | "DOCUMENT_DOWNLOAD"
  | "DOCUMENT_UPDATE"
  | "DOCUMENT_DELETE"
  | "PERMISSION_GRANT"
  | "PERMISSION_REVOKE"
  | "ACCESS_DENIED"
  | "USER_STATUS_CHANGE"
  | "SECURITY_VALIDATION_FAILURE";

export type AuditResourceType = "DOCUMENT" | "PERMISSION" | "USER" | "AUTH" | "SYSTEM";
export type AuditOutcome = "SUCCESS" | "DENIED";

export interface LogAuditParams {
  actorId?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  outcome: AuditOutcome;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ChainVerificationResult {
  isValid: boolean;
  totalEvents: number;
  verifiedEvents: number;
  genesisHash: string;
  latestHash: string;
  brokenLinkIndex?: number;
  invalidHashIndex?: number;
  tamperedEventId?: string;
  error?: string;
}

/**
 * Sanitizes metadata to ensure no sensitive fields (passwords, tokens, auth headers, raw bytes)
 * are ever persisted to the audit trail.
 */
function sanitizeMetadata(rawMetadata?: Record<string, unknown> | null): string | null {
  if (!rawMetadata) return null;

  const forbiddenKeys = [
    "password",
    "passwordHash",
    "token",
    "sessionToken",
    "authorization",
    "secret",
    "key",
    "content",
    "buffer",
    "bytes",
    "cookie",
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(rawMetadata)) {
    const lowerKey = k.toLowerCase();
    if (forbiddenKeys.some((f) => lowerKey.includes(f))) {
      sanitized[k] = "[REDACTED_SENSITIVE_DATA]";
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      sanitized[k] = JSON.parse(sanitizeMetadata(v as Record<string, unknown>) || "{}");
    } else {
      sanitized[k] = v;
    }
  }

  return JSON.stringify(sanitized);
}

/**
 * Appends a new audit event to the cryptographic hash chain using an atomic transaction.
 * Concurrency is guarded by serializing head updates.
 */
export async function logAuditEvent(params: LogAuditParams) {
  const sanitizedMeta = sanitizeMetadata(params.metadata);
  const now = new Date();
  const eventId = generateOpaqueId();

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch or initialize the audit chain head
    let head = await tx.auditChainHead.findUnique({
      where: { id: "singleton" },
    });

    if (!head) {
      head = await tx.auditChainHead.create({
        data: {
          id: "singleton",
          latestSequenceNumber: 0,
          latestHash: GENESIS_AUDIT_HASH,
        },
      });
    }

    const nextSeq = head.latestSequenceNumber + 1;
    const previousHash = head.latestHash;

    // 2. Compute the canonical SHA-256 hash for the new event
    const currentEventHash = computeAuditEventHash({
      sequenceNumber: nextSeq,
      timestamp: now,
      actorId: params.actorId || null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      outcome: params.outcome,
      correlationId: params.correlationId || null,
      metadata: sanitizedMeta,
      previousEventHash: previousHash,
    });

    // 3. Persist the new audit event
    const auditRecord = await tx.auditEvent.create({
      data: {
        id: eventId,
        sequenceNumber: nextSeq,
        timestamp: now,
        actorId: params.actorId || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        outcome: params.outcome,
        correlationId: params.correlationId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: sanitizedMeta,
        previousEventHash: previousHash,
        currentEventHash,
      },
    });

    // 4. Update the chain head atomically
    await tx.auditChainHead.update({
      where: { id: "singleton" },
      data: {
        latestSequenceNumber: nextSeq,
        latestHash: currentEventHash,
      },
    });

    return auditRecord;
  });
}

/**
 * Verifies the integrity of the audit hash chain.
 * Traverses all events in sequence, recomputes canonical hashes, and checks chaining consistency.
 */
export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  const events = await prisma.auditEvent.findMany({
    orderBy: { sequenceNumber: "asc" },
  });

  const head = await prisma.auditChainHead.findUnique({
    where: { id: "singleton" },
  });

  if (events.length === 0) {
    return {
      isValid: true,
      totalEvents: 0,
      verifiedEvents: 0,
      genesisHash: GENESIS_AUDIT_HASH,
      latestHash: head ? head.latestHash : GENESIS_AUDIT_HASH,
    };
  }

  let expectedPreviousHash = GENESIS_AUDIT_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedSequence = i + 1;

    // 1. Verify sequence monotonicity
    if (event.sequenceNumber !== expectedSequence) {
      return {
        isValid: false,
        totalEvents: events.length,
        verifiedEvents: i,
        genesisHash: GENESIS_AUDIT_HASH,
        latestHash: head ? head.latestHash : "UNKNOWN",
        brokenLinkIndex: i,
        tamperedEventId: event.id,
        error: `Sequence discontinuity detected: event index ${i} has sequenceNumber ${event.sequenceNumber}, expected ${expectedSequence}`,
      };
    }

    // 2. Verify previous event link
    if (event.previousEventHash !== expectedPreviousHash) {
      return {
        isValid: false,
        totalEvents: events.length,
        verifiedEvents: i,
        genesisHash: GENESIS_AUDIT_HASH,
        latestHash: head ? head.latestHash : "UNKNOWN",
        brokenLinkIndex: i,
        tamperedEventId: event.id,
        error: `Broken hash chain at sequence ${event.sequenceNumber}: previousEventHash mismatch`,
      };
    }

    // 3. Recompute canonical hash and verify currentEventHash
    const recomputedHash = computeAuditEventHash({
      sequenceNumber: event.sequenceNumber,
      timestamp: event.timestamp,
      actorId: event.actorId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      outcome: event.outcome,
      correlationId: event.correlationId,
      metadata: event.metadata,
      previousEventHash: event.previousEventHash,
    });

    if (recomputedHash !== event.currentEventHash) {
      return {
        isValid: false,
        totalEvents: events.length,
        verifiedEvents: i,
        genesisHash: GENESIS_AUDIT_HASH,
        latestHash: head ? head.latestHash : "UNKNOWN",
        invalidHashIndex: i,
        tamperedEventId: event.id,
        error: `Tampered event detected at sequence ${event.sequenceNumber} (ID: ${event.id}): stored hash ${event.currentEventHash} does not match recomputed hash ${recomputedHash}`,
      };
    }

    expectedPreviousHash = event.currentEventHash;
  }

  // 4. Verify head consistency
  if (head && head.latestHash !== expectedPreviousHash) {
    return {
      isValid: false,
      totalEvents: events.length,
      verifiedEvents: events.length,
      genesisHash: GENESIS_AUDIT_HASH,
      latestHash: head.latestHash,
      error: `Chain head mismatch: head latestHash (${head.latestHash}) differs from final event hash (${expectedPreviousHash})`,
    };
  }

  return {
    isValid: true,
    totalEvents: events.length,
    verifiedEvents: events.length,
    genesisHash: GENESIS_AUDIT_HASH,
    latestHash: expectedPreviousHash,
  };
}
