import { createHash, randomBytes, randomUUID } from "crypto";

/**
 * Calculates SHA-256 hash of a string or buffer.
 */
export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Generates an opaque random UUID.
 */
export function generateOpaqueId(): string {
  return randomUUID();
}

/**
 * Generates a cryptographically strong session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Produces a canonical string representation for audit event hashing.
 * Deterministic format: sequenceNumber:timestamp:actorId:action:resourceType:resourceId:outcome:correlationId:metadataHash:previousEventHash
 */
export function computeAuditEventHash(event: {
  sequenceNumber: number;
  timestamp: string | Date;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  correlationId: string | null;
  metadata: string | null;
  previousEventHash: string;
}): string {
  const ts = event.timestamp instanceof Date ? event.timestamp.toISOString() : new Date(event.timestamp).toISOString();
  const metaHash = event.metadata ? sha256(event.metadata) : "NO_METADATA";

  const canonicalPayload = [
    event.sequenceNumber.toString(),
    ts,
    event.actorId || "ANONYMOUS",
    event.action,
    event.resourceType,
    event.resourceId || "NONE",
    event.outcome,
    event.correlationId || "NONE",
    metaHash,
    event.previousEventHash,
  ].join("|");

  return sha256(canonicalPayload);
}

export const GENESIS_AUDIT_HASH = "GENESIS_HASH_TRUSTVAULT_V1_0000000000000000000000000000000000000000";
