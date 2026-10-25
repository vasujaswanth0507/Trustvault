import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser, AuthorizationError } from "../../../../lib/auth/authorization";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireActiveUser(req);

    return NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        fullName: auth.user.fullName,
        role: auth.user.role,
        isActive: auth.user.isActive,
        createdAt: auth.user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
