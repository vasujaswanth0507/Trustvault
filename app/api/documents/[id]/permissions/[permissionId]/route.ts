import { NextRequest, NextResponse } from "next/server";
import { requireDocumentOwner, AuthorizationError } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit/audit-service";

interface RouteParams {
  params: { id: string; permissionId: string };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const documentId = params.id;
    const permissionId = params.permissionId;

    // Strict authorization: Only the document owner can revoke permissions!
    const { user, document } = await requireDocumentOwner(req, documentId);

    const existingPermission = await prisma.documentPermission.findUnique({
      where: { id: permissionId },
      include: { grantee: true },
    });

    if (!existingPermission || existingPermission.documentId !== documentId) {
      return NextResponse.json({ error: "Permission grant not found" }, { status: 404 });
    }

    // Revoke the grant atomically
    await prisma.$transaction(async (tx) => {
      await tx.documentPermission.delete({
        where: { id: permissionId },
      });
    });

    // Fail-closed audit event logging
    await logAuditEvent({
      actorId: user.id,
      action: "PERMISSION_REVOKE",
      resourceType: "PERMISSION",
      resourceId: permissionId,
      outcome: "SUCCESS",
      metadata: {
        documentId,
        documentTitle: document.title,
        revokedGranteeId: existingPermission.granteeId,
        revokedGranteeEmail: existingPermission.grantee.email,
        previousLevel: existingPermission.permissionLevel,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Permission grant revoked immediately",
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
