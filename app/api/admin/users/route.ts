import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator, AuthorizationError } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAdministrator(req);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            ownedDocuments: { where: { deletedAt: null } },
            documentGrants: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        ownedDocumentsCount: u._count.ownedDocuments,
        grantsCount: u._count.documentGrants,
      })),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
