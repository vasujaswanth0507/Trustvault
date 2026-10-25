import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator, AuthorizationError } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { verifyAuditChain } from "@/lib/audit/audit-service";

export async function GET(req: NextRequest) {
  try {
    // Only users with ADMINISTRATOR role can access admin metrics
    await requireAdministrator(req);

    const [
      totalUsers,
      activeUsers,
      totalDocuments,
      totalAuditEvents,
      deniedAttempts,
      categories,
      recentSecurityEvents,
      chainStatus,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.document.count({ where: { deletedAt: null } }),
      prisma.auditEvent.count(),
      prisma.auditEvent.count({ where: { outcome: "DENIED" } }),
      prisma.document.groupBy({
        by: ["category"],
        where: { deletedAt: null },
        _count: { category: true },
      }),
      prisma.auditEvent.findMany({
        where: {
          OR: [{ outcome: "DENIED" }, { action: { in: ["USER_STATUS_CHANGE", "SECURITY_VALIDATION_FAILURE"] } }],
        },
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { sequenceNumber: "desc" },
        take: 10,
      }),
      verifyAuditChain(),
    ]);

    return NextResponse.json({
      metrics: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalDocuments,
        totalAuditEvents,
        deniedAttempts,
        categoryBreakdown: categories.map((c) => ({ category: c.category, count: c._count.category })),
      },
      chainStatus: {
        isValid: chainStatus.isValid,
        verifiedEvents: chainStatus.verifiedEvents,
        totalEvents: chainStatus.totalEvents,
        latestHash: chainStatus.latestHash,
        error: chainStatus.error,
      },
      recentSecurityEvents,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
