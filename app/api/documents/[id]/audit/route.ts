import { NextRequest, NextResponse } from "next/server";
import { requireDocumentOwner, AuthorizationError } from "../../../../../lib/auth/authorization";
import { prisma } from "../../../../../lib/db/prisma";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const documentId = params.id;
    // Only the document owner can view document-specific audit history
    await requireDocumentOwner(req, documentId);

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        resourceType: "DOCUMENT",
        resourceId: documentId,
      },
      include: {
        actor: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { sequenceNumber: "desc" },
      take: 100,
    });

    return NextResponse.json({ auditEvents });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
