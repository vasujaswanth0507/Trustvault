import { NextRequest, NextResponse } from "next/server";
import { extractSessionToken, destroySession, clearSessionCookie, validateSession } from "../../../../lib/auth/session";
import { logAuditEvent } from "../../../../lib/audit/audit-service";

export async function POST(req: NextRequest) {
  const token = extractSessionToken(req);
  const session = await validateSession(token);

  if (session) {
    await logAuditEvent({
      actorId: session.userId,
      action: "LOGOUT",
      resourceType: "AUTH",
      resourceId: session.userId,
      outcome: "SUCCESS",
    }).catch(() => {});

    await destroySession(token);
  }

  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  clearSessionCookie(response);
  return response;
}
