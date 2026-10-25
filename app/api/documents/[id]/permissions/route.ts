import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDocumentOwner, AuthorizationError } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit/audit-service";

const grantPermissionSchema = z.object({
  email: z.string().email(),
  permissionLevel: z.enum(["READ", "EDIT"]),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const documentId = params.id;
    // Only the document owner can inspect the document's permission grants list
    await requireDocumentOwner(req, documentId);

    const permissions = await prisma.documentPermission.findMany({
      where: { documentId },
      include: {
        grantee: { select: { id: true, fullName: true, email: true, role: true } },
        grantedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ permissions });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const documentId = params.id;
    // Only the document owner can grant permissions!
    const { user, document } = await requireDocumentOwner(req, documentId);

    const body = await req.json();
    const parsed = grantPermissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid permission payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, permissionLevel } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Find grantee
    const grantee = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!grantee) {
      return NextResponse.json(
        { error: `User with email "${normalizedEmail}" was not found` },
        { status: 404 }
      );
    }

    if (!grantee.isActive) {
      return NextResponse.json(
        { error: "Cannot grant document access to an inactive or disabled user account" },
        { status: 400 }
      );
    }

    if (grantee.id === user.id) {
      return NextResponse.json(
        { error: "Document owner already has full administrative and edit access" },
        { status: 400 }
      );
    }

    // Atomic upsert of document grant and audit event
    const grant = await prisma.$transaction(async (tx) => {
      const existing = await tx.documentPermission.findUnique({
        where: {
          documentId_granteeId: {
            documentId,
            granteeId: grantee.id,
          },
        },
      });

      if (existing) {
        return await tx.documentPermission.update({
          where: { id: existing.id },
          data: {
            permissionLevel,
            grantedById: user.id,
          },
          include: {
            grantee: { select: { id: true, fullName: true, email: true } },
          },
        });
      }

      return await tx.documentPermission.create({
        data: {
          documentId,
          granteeId: grantee.id,
          permissionLevel,
          grantedById: user.id,
        },
        include: {
          grantee: { select: { id: true, fullName: true, email: true } },
        },
      });
    });

    // Fail-closed audit event logging
    await logAuditEvent({
      actorId: user.id,
      action: "PERMISSION_GRANT",
      resourceType: "PERMISSION",
      resourceId: grant.id,
      outcome: "SUCCESS",
      metadata: {
        documentId,
        documentTitle: document.title,
        granteeEmail: grantee.email,
        granteeId: grantee.id,
        permissionLevel,
      },
    });

    return NextResponse.json(
      {
        success: true,
        permission: grant,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
