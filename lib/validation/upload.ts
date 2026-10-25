import path from "path";

export interface FileValidationResult {
  isValid: boolean;
  sanitizedFilename: string;
  detectedMimeType: string;
  extension: string;
  error?: string;
}

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"];

export const MIME_TYPE_MAP: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/octet-stream",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/octet-stream",
  ],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
};

/**
 * Validates the file buffer header against known cryptographic file signatures (magic bytes).
 */
export function verifyMagicBytes(buffer: Buffer, extension: string): boolean {
  if (buffer.length < 4) return false;

  const hexHeader = buffer.subarray(0, 8).toString("hex").toUpperCase();

  switch (extension.toLowerCase()) {
    case ".pdf":
      // %PDF- => 25 50 44 46
      return hexHeader.startsWith("25504446");

    case ".png":
      // 89 50 4E 47 0D 0A 1A 0A
      return hexHeader.startsWith("89504E470D0A1A0A");

    case ".jpg":
    case ".jpeg":
      // FF D8 FF
      return hexHeader.startsWith("FFD8FF");

    case ".docx":
    case ".xlsx":
      // Standard ZIP container header: PK.. => 50 4B 03 04
      return hexHeader.startsWith("504B0304");

    default:
      return false;
  }
}

/**
 * Sanitizes a client-provided filename.
 * Strips directory traversal, null bytes, invalid characters, and double-extension masquerading.
 */
export function sanitizeFilename(originalFilename: string): string {
  // Strip null bytes and control characters
  let clean = originalFilename.replace(/[\x00-\x1f\x80-\x9f]/g, "");

  // Extract base filename (removes path separators)
  clean = path.basename(clean).trim();

  // Remove dangerous characters: / \ : * ? " < > |
  clean = clean.replace(/[/\s:*?"<>|\\]+/g, "_");

  // Prevent hidden dotfiles (.htaccess, etc.)
  clean = clean.replace(/^\.+/, "");

  if (!clean || clean === "_") {
    clean = "unnamed_document";
  }

  return clean;
}

/**
 * Performs full server-side upload validation.
 */
export function validateUploadedFile(
  buffer: Buffer,
  rawFilename: string,
  declaredMimeType: string,
  maxSizeBytes = 15728640 // Default 15 MB
): FileValidationResult {
  // 1. Check file size
  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      sanitizedFilename: "",
      detectedMimeType: "",
      extension: "",
      error: "Uploaded file is empty (0 bytes)",
    };
  }

  if (buffer.length > maxSizeBytes) {
    return {
      isValid: false,
      sanitizedFilename: "",
      detectedMimeType: "",
      extension: "",
      error: `File size exceeds the allowed limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
    };
  }

  // 2. Filename sanitization
  const sanitized = sanitizeFilename(rawFilename);
  const ext = path.extname(sanitized).toLowerCase();

  // 3. Extension allowlist check
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      sanitizedFilename: sanitized,
      detectedMimeType: declaredMimeType,
      extension: ext,
      error: `File type ${ext || "(none)"} is not allowed. Permitted types: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }

  // 4. Double-extension spoofing check (e.g. malware.pdf.exe)
  const nameWithoutLastExt = sanitized.slice(0, -ext.length);
  const secondExt = path.extname(nameWithoutLastExt).toLowerCase();
  const dangerousExecutables = [".exe", ".bat", ".cmd", ".sh", ".js", ".vbs", ".ps1", ".jar", ".dll"];
  if (dangerousExecutables.includes(secondExt)) {
    return {
      isValid: false,
      sanitizedFilename: sanitized,
      detectedMimeType: declaredMimeType,
      extension: ext,
      error: "Suspicious double-extension detected in filename",
    };
  }

  // 5. Magic bytes signature verification
  const magicValid = verifyMagicBytes(buffer, ext);
  if (!magicValid) {
    return {
      isValid: false,
      sanitizedFilename: sanitized,
      detectedMimeType: declaredMimeType,
      extension: ext,
      error: "File content does not match the expected cryptographic file signature (magic bytes mismatch)",
    };
  }

  // 6. MIME type validation
  const validMimes = MIME_TYPE_MAP[ext] || [];
  const normalizedMime = (declaredMimeType || "").toLowerCase().split(";")[0].trim();
  const mimeAccepted = validMimes.includes(normalizedMime) || validMimes.includes("application/octet-stream");

  const effectiveMime = mimeAccepted ? normalizedMime : validMimes[0];

  return {
    isValid: true,
    sanitizedFilename: sanitized,
    detectedMimeType: effectiveMime,
    extension: ext,
  };
}
