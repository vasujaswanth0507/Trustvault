import { describe, it, expect } from "vitest";
import { POST as uploadRoute } from "@/app/api/documents/route";
import { createMockRequest, getTestUserSession } from "./test-helpers";
import { validateUploadedFile, sanitizeFilename } from "@/lib/validation/upload";

describe("Upload Security & Server Validation", () => {
  it("rejects unsupported extensions", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");

    const formData = new FormData();
    const fakeExe = new Blob(["MZ\x90\x00\x03\x00\x00\x00"], { type: "application/x-msdownload" });
    formData.append("file", fakeExe, "malicious_script.exe");
    formData.append("title", "Executable File");
    formData.append("category", "TECHNICAL");

    const req = createMockRequest("/api/documents", {
      method: "POST",
      sessionToken: ownerA.sessionToken,
      body: formData,
    });

    const res = await uploadRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not allowed");
  });

  it("rejects MIME spoofing where file content does not match magic bytes", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");

    // Renamed script with .pdf extension, but body is plaintext JavaScript
    const formData = new FormData();
    const spoofedContent = new Blob(["console.log('malicious script executed')"], { type: "application/pdf" });
    formData.append("file", spoofedContent, "fake_document.pdf");
    formData.append("title", "Spoofed Document");

    const req = createMockRequest("/api/documents", {
      method: "POST",
      sessionToken: ownerA.sessionToken,
      body: formData,
    });

    const res = await uploadRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("magic bytes");
  });

  it("rejects oversized uploads exceeding the maximum configured limit", () => {
    // 10-byte buffer with max limit set to 5 bytes
    const smallBuffer = Buffer.from("%PDF-1.4 1234567890");
    const result = validateUploadedFile(smallBuffer, "large.pdf", "application/pdf", 5);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("exceeds the allowed limit");
  });

  it("sanitizes filenames and neutralizes path traversal attempts", () => {
    const dangerousName = "../../../../etc/passwd.pdf";
    const sanitized = sanitizeFilename(dangerousName);
    expect(sanitized).not.toContain("..");
    expect(sanitized).not.toContain("/");
    expect(sanitized).toBe("passwd.pdf");

    const traversalName = "..\\..\\Windows\\System32\\cmd.exe.pdf";
    const sanitized2 = sanitizeFilename(traversalName);
    expect(sanitized2).not.toContain("\\");
    expect(sanitized2).not.toContain("..");
  });

  it("rejects double extension tricks with dangerous second extension", () => {
    const buffer = Buffer.from("%PDF-1.4 dummy valid pdf content");
    const result = validateUploadedFile(buffer, "invoice.exe.pdf", "application/pdf");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("double-extension");
  });

  it("binds uploaded document strictly to the authenticated user ID and ignores client-provided owner fields", async () => {
    const ownerA = await getTestUserSession("owner-a@example.test");
    const ownerB = await getTestUserSession("owner-b@example.test");

    const formData = new FormData();
    // Valid PDF header
    const validPdfBuffer = Buffer.from("%PDF-1.4 valid test pdf document content");
    const blob = new Blob([validPdfBuffer], { type: "application/pdf" });
    formData.append("file", blob, "legitimate_report.pdf");
    formData.append("title", "Legitimate Report");
    formData.append("category", "LEGAL");
    // Attempting to spoof ownerId to Owner B
    formData.append("ownerId", ownerB.id);

    const req = createMockRequest("/api/documents", {
      method: "POST",
      sessionToken: ownerA.sessionToken,
      body: formData,
    });

    const res = await uploadRoute(req);
    expect(res.status).toBe(201);
    const body = await res.json();

    // Verify document was created with Owner A as the owner, ignoring the submitted ownerId
    expect(body.document.permissionLevel).toBe("OWNER");
  });
});
