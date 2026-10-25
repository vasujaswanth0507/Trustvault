import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator, AuthorizationError } from "@/lib/auth/authorization";
import { verifyAuditChain } from "@/lib/audit/audit-service";

export async function GET(req: NextRequest) {
  try {
    // Only administrators can trigger audit chain verification
    await requireAdministrator(req);

    const result = await verifyAuditChain();

    return NextResponse.json({
      verification: result,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
