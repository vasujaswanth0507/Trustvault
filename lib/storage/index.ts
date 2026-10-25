import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { randomUUID } from "crypto";

export interface StorageDriver {
  saveFile(content: Buffer | Uint8Array, extension?: string): Promise<{ storageKey: string; size: number }>;
  getFileStream(storageKey: string): Promise<Readable>;
  getFileBuffer(storageKey: string): Promise<Buffer>;
  deleteFile(storageKey: string): Promise<void>;
  fileExists(storageKey: string): Promise<boolean>;
}

/**
 * Local private filesystem storage driver.
 * Stores files in an application-controlled directory strictly outside the web root.
 * Storage keys are opaque random UUIDs, completely preventing directory traversal.
 */
export class LocalStorageDriver implements StorageDriver {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    const rawDir = customBaseDir || process.env.STORAGE_LOCAL_ROOT || "./storage/vault_data";
    this.baseDir = path.resolve(process.cwd(), rawDir);

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Validates and safely resolves an internal storage key to an absolute path within baseDir.
   * Disallows path traversal sequences ('..', '/', '\\', null bytes).
   */
  private resolveKey(storageKey: string): string {
    // Storage keys must be UUID-based safe strings
    const sanitized = path.basename(storageKey);
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(sanitized) || sanitized.includes("..")) {
      throw new Error("Invalid or untrusted storage key format");
    }

    const fullPath = path.resolve(this.baseDir, sanitized);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error("Path traversal violation detected");
    }
    return fullPath;
  }

  async saveFile(content: Buffer | Uint8Array, extension = ""): Promise<{ storageKey: string; size: number }> {
    const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "");
    const storageKey = `${randomUUID()}${safeExt ? "." + safeExt : ""}`;
    const destination = this.resolveKey(storageKey);

    await fs.promises.writeFile(destination, content, { mode: 0o600 });
    const stats = await fs.promises.stat(destination);

    return {
      storageKey,
      size: stats.size,
    };
  }

  async getFileStream(storageKey: string): Promise<Readable> {
    const filePath = this.resolveKey(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found in secure storage");
    }
    return fs.createReadStream(filePath);
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const filePath = this.resolveKey(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found in secure storage");
    }
    return fs.promises.readFile(filePath);
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      const filePath = this.resolveKey(storageKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // Soft fail or log - never crash if file was already removed
    }
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const filePath = this.resolveKey(storageKey);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

/**
 * S3 Storage Driver stub / production configuration adapter.
 * Kept private; documents the production integration without faking it.
 */
export class S3StorageDriver implements StorageDriver {
  constructor() {
    if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID) {
      throw new Error("S3 credentials not configured. Please use STORAGE_DRIVER=local for local development.");
    }
  }

  async saveFile(): Promise<{ storageKey: string; size: number }> {
    throw new Error("S3 driver requires AWS SDK in production deployment");
  }
  async getFileStream(): Promise<Readable> {
    throw new Error("S3 driver requires AWS SDK in production deployment");
  }
  async getFileBuffer(): Promise<Buffer> {
    throw new Error("S3 driver requires AWS SDK in production deployment");
  }
  async deleteFile(): Promise<void> {
    throw new Error("S3 driver requires AWS SDK in production deployment");
  }
  async fileExists(): Promise<boolean> {
    throw new Error("S3 driver requires AWS SDK in production deployment");
  }
}

export const storage: StorageDriver =
  process.env.STORAGE_DRIVER === "s3" ? new S3StorageDriver() : new LocalStorageDriver();
