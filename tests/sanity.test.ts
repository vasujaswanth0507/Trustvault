import { describe, it, expect } from "vitest";
import { verifyAuditChain } from "@/lib/audit/audit-service";
import { verifyPassword, hashPassword } from "@/lib/crypto/password";

describe("Sanity & Core Crypto", () => {
  it("verifies Argon2id password hashing", async () => {
    const hash = await hashPassword("TestSecurity123!");
    const match = await verifyPassword("TestSecurity123!", hash);
    const mismatch = await verifyPassword("WrongPassword!", hash);
    expect(match).toBe(true);
    expect(mismatch).toBe(false);
  });

  it("verifies seeded audit hash-chain integrity", async () => {
    const result = await verifyAuditChain();
    expect(result.isValid).toBe(true);
    expect(result.totalEvents).toBeGreaterThanOrEqual(12);
    expect(result.error).toBeUndefined();
  });
});
