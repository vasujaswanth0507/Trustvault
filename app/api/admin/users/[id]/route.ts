import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdministrator, AuthorizationError } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit/audit-service";

const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["ADMINISTRATOR", "OWNER", "VIEWER"]).optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const targetUserId = params.id;
    const { user: adminUser } = await requireAdministrator(req);

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid user update payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Lockout protection: prevent an admin from disabling their own account
    if (targetUser.id === adminUser.id && parsed.data.isActive === false) {
      return NextResponse.json(
        { error: "Administrators cannot deactivate their own active account" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: targetUserId },
        data: updateData,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      // If deactivated, revoke all active sessions immediately
      if (parsed.data.isActive === false) {
        await tx.session.deleteMany({
          where: { userId: targetUserId },
        });
      }

      return u;
    });

    // Fail-closed audit event logging
    await logAuditEvent({
      actorId: adminUser.id,
      action: "USER_STATUS_CHANGE",
      resourceType: "USER",
      resourceId: targetUserId,
      outcome: "SUCCESS",
      metadata: {
        targetEmail: targetUser.email,
        changes: updateData,
        previousState: { isActive: targetUser.isActive, role: targetUser.role },
      },
    });

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
