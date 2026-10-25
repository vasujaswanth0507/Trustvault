import { NextRequest, NextResponse } from "next/server";
import { requireDocumentDownloadAccess, AuthorizationError } from "../../../../../lib/auth/authorization";
import { storage } from "../../../../../lib/storage";
import { logAuditEvent } from "../../../../../lib/audit/audit-service";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const documentId = params.id;
    // Strict server-side authorization check: user must be active and have READ or EDIT access (or ownership)
    const { user, document, permissionLevel } = await requireDocumentDownloadAccess(req, documentId);

    // Fetch file from private storage
    const fileBuffer = await storage.getFileBuffer(document.storageKey);

    // Record authorized download in audit trail
    await logAuditEvent({
      actorId: user.id,
      action: "DOCUMENT_DOWNLOAD",
      resourceType: "DOCUMENT",
      resourceId: document.id,
      outcome: "SUCCESS",
      metadata: {
        permissionLevel,
        fileSize: document.fileSize,
        sha256Hash: document.sha256Hash,
      },
    });

    // Sanitize filename for HTTP header
    const cleanFilename = document.originalFilename.replace(/["\r\n\\]/g, "_");

    // Return file bytes with strict security headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Length": document.fileSize.toString(),
        "Content-Disposition": `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(document.originalFilename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // 0 file bytes streamed on access denial
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
