import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "healthy",
      service: "TrustVault",
      timestamp: new Date().toISOString(),
      database: "connected",
      storageDriver: process.env.STORAGE_DRIVER || "local",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Database check failed",
      },
      { status: 503 }
    );
  }
}
