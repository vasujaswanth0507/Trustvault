import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator, AuthorizationError } from "../../../../lib/auth/authorization";
import { prisma } from "../../../../lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAdministrator(req);
    const { searchParams } = new URL(req.url);

    const action = searchParams.get("action")?.trim() || "";
    const outcome = searchParams.get("outcome")?.trim() || "";
    const resourceType = searchParams.get("resourceType")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (action && action !== "ALL") whereClause.action = action;
    if (outcome && outcome !== "ALL") whereClause.outcome = outcome;
    if (resourceType && resourceType !== "ALL") whereClause.resourceType = resourceType;

    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where: whereClause }),
      prisma.auditEvent.findMany({
        where: whereClause,
        include: {
          actor: { select: { id: true, fullName: true, email: true, role: true } },
        },
        orderBy: { sequenceNumber: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
