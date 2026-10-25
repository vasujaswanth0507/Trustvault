import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/crypto/password";
import { createServerSession, setSessionCookie } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/audit-service";

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email or password format", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Look up user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Timing attack mitigation: always compute verification even if user does not exist
    const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQ$abcdefghijklmnopqrstuvwxyz0123456789";
    const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, dummyHash);

    if (!user || !passwordMatches) {
      await logAuditEvent({
        actorId: null,
        action: "LOGIN_FAILURE",
        resourceType: "AUTH",
        resourceId: null,
        outcome: "DENIED",
        ipAddress,
        userAgent,
        metadata: { attemptedEmail: normalizedEmail, reason: "Invalid credentials" },
      });

      // Constant error message to prevent account enumeration
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if account is active
    if (!user.isActive) {
      await logAuditEvent({
        actorId: user.id,
        action: "LOGIN_FAILURE",
        resourceType: "AUTH",
        resourceId: user.id,
        outcome: "DENIED",
        ipAddress,
        userAgent,
        metadata: { reason: "Account is inactive or disabled" },
      });

      return NextResponse.json(
        { error: "Account has been deactivated. Please contact your system administrator." },
        { status: 403 }
      );
    }

    // Create session in database
    const { token, expiresAt } = await createServerSession(user.id, ipAddress, userAgent);

    // Record successful login in audit trail
    await logAuditEvent({
      actorId: user.id,
      action: "LOGIN_SUCCESS",
      resourceType: "AUTH",
      resourceId: user.id,
      outcome: "SUCCESS",
      ipAddress,
      userAgent,
      metadata: { role: user.role },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });

    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "An unexpected error occurred during authentication" },
      { status: 500 }
    );
  }
}
