import * as argon2 from "@node-rs/argon2";

/**
 * Hash a password using Argon2id with secure OWASP parameters.
 */
export async function hashPassword(plainText: string): Promise<string> {
  return argon2.hash(plainText, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    algorithm: 2, // 2 corresponds to Argon2id in @node-rs/argon2
  });
}

/**
 * Verify a plain text password against an Argon2id hash.
 */
export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    return false;
  }
}
