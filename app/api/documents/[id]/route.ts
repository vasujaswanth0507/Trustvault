import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireDocumentReadAccess,
  requireDocumentEditAccess,
  requireDocumentOwner,
  AuthorizationError,
} from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit/audit-service";
import { storage } from "@/lib/storage";

const updateDocumentSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.enum(["FINANCIAL", "LEGAL", "COMPLIANCE", "TECHNICAL", "INTERNAL", "GENERAL"]).optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const documentId = params.id;
    const { user, document, permissionLevel } = await requireDocumentReadAccess(req, documentId);

    // Fetch owner details
    const owner = await prisma.user.findUnique({
      where: { id: document.ownerId },
      select: { id: true, fullName: true, email: true },
    });

    // If owner, include permission grants and document audit history
    let permissions = null;
    let auditHistory = null;

    if (permissionLevel === "OWNER") {
      permissions = await prisma.documentPermission.findMany({
        where: { documentId },
        include: {
          grantee: { select: { id: true, fullName: true, email: true, role: true } },
          grantedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      auditHistory = await prisma.auditEvent.findMany({
        where: {
          resourceType: "DOCUMENT",
          resourceId: documentId,
        },
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { sequenceNumber: "desc" },
        take: 20,
      });
    }

    // Log document view event in audit trail
    await logAuditEvent({
      actorId: user.id,
      action: "DOCUMENT_VIEW",
      resourceType: "DOCUMENT",
      resourceId: document.id,
      outcome: "SUCCESS",
      metadata: { permissionLevel },
    }).catch(() => {});

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        originalFilename: document.originalFilename,
        description: document.description,
        category: document.category,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        sha256Hash: document.sha256Hash,
        owner,
        permissionLevel,
        isOwner: permissionLevel === "OWNER",
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
      permissions,
      auditHistory,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const documentId = params.id;
    const { user, document } = await requireDocumentEditAccess(req, documentId);

    const body = await req.json();
    const parsed = updateDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid metadata payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.category !== undefined) updateData.category = parsed.data.category;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    // Update document and log audit in transaction
    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id: documentId },
        data: updateData,
      });

      return doc;
    });

    // Fail-closed audit event recording
    await logAuditEvent({
      actorId: user.id,
      action: "DOCUMENT_UPDATE",
      resourceType: "DOCUMENT",
      resourceId: document.id,
      outcome: "SUCCESS",
      metadata: { changes: updateData, previousTitle: document.title },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const documentId = params.id;
    // Only the document owner can delete the document!
    const { user, document } = await requireDocumentOwner(req, documentId);

    // Soft delete document and record audit
    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });
    });

    // Delete underlying file from private storage
    await storage.deleteFile(document.storageKey).catch(() => {});

    // Fail-closed audit recording
    await logAuditEvent({
      actorId: user.id,
      action: "DOCUMENT_DELETE",
      resourceType: "DOCUMENT",
      resourceId: document.id,
      outcome: "SUCCESS",
      metadata: { title: document.title, originalFilename: document.originalFilename },
    });

    return NextResponse.json({
      success: true,
      message: "Document successfully deleted",
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
