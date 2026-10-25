import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser, AuthorizationError } from "../../../lib/auth/authorization";
import { validateUploadedFile } from "../../../lib/validation/upload";
import { storage } from "../../../lib/storage";
import { prisma } from "../../../lib/db/prisma";
import { sha256 } from "../../../lib/crypto/hash";
import { logAuditEvent } from "../../../lib/audit/audit-service";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireActiveUser(req);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const category = (formData.get("category") as string)?.trim() || "GENERAL";

    if (!file) {
      return NextResponse.json({ error: "No file was provided in the upload request" }, { status: 400 });
    }

    if (!title || title.length < 2 || title.length > 200) {
      return NextResponse.json({ error: "Document title must be between 2 and 200 characters" }, { status: 400 });
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Strict upload validation (size, extension, double extension, magic bytes, MIME)
    const validation = validateUploadedFile(buffer, file.name, file.type);
    if (!validation.isValid) {
      await logAuditEvent({
        actorId: auth.user.id,
        action: "SECURITY_VALIDATION_FAILURE",
        resourceType: "DOCUMENT",
        resourceId: null,
        outcome: "DENIED",
        metadata: {
          filename: file.name,
          error: validation.error,
          declaredMime: file.type,
        },
      }).catch(() => {});

      return NextResponse.json({ error: validation.error || "File validation failed" }, { status: 400 });
    }

    // Compute cryptographic SHA-256 hash of file content
    const fileHash = sha256(buffer);

    // Save to private storage with opaque UUID key
    let savedStorage: { storageKey: string; size: number } | null = null;
    try {
      savedStorage = await storage.saveFile(buffer, validation.extension);
    } catch {
      return NextResponse.json({ error: "Failed to securely store file on server" }, { status: 500 });
    }

    // Insert document record in database
    let document;
    try {
      document = await prisma.document.create({
        data: {
          title,
          originalFilename: validation.sanitizedFilename,
          description,
          category,
          mimeType: validation.detectedMimeType,
          fileSize: savedStorage.size,
          sha256Hash: fileHash,
          storageKey: savedStorage.storageKey,
          ownerId: auth.user.id,
        },
      });

      // Log successful upload in audit trail
      await logAuditEvent({
        actorId: auth.user.id,
        action: "DOCUMENT_UPLOAD",
        resourceType: "DOCUMENT",
        resourceId: document.id,
        outcome: "SUCCESS",
        metadata: {
          title: document.title,
          category: document.category,
          fileSize: document.fileSize,
          sha256Hash: document.sha256Hash,
        },
      });
    } catch (dbError) {
      // Cleanup orphaned file if DB insertion or audit fails
      if (savedStorage) {
        await storage.deleteFile(savedStorage.storageKey).catch(() => {});
      }
      throw dbError;
    }

    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          title: document.title,
          originalFilename: document.originalFilename,
          description: document.description,
          category: document.category,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          sha256Hash: document.sha256Hash,
          createdAt: document.createdAt,
          permissionLevel: "OWNER",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    const sortByParam = searchParams.get("sortBy") || "createdAt";
    const sortOrderParam = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const allowedSortFields = ["title", "createdAt", "fileSize", "category"];
    const sortBy = allowedSortFields.includes(sortByParam) ? sortByParam : "createdAt";

    // Strict access restriction query:
    // A document is visible ONLY IF user is the owner OR has an active permission grant.
    const accessFilter = {
      deletedAt: null,
      OR: [
        { ownerId: auth.user.id },
        { permissions: { some: { granteeId: auth.user.id } } },
      ],
    };

    // Combine with search and category filters
    const whereClause: any = {
      ...accessFilter,
    };

    if (search) {
      whereClause.AND = [
        {
          OR: [
            { title: { contains: search } },
            { originalFilename: { contains: search } },
            { description: { contains: search } },
          ],
        },
      ];
    }

    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    // Execute paginated query
    const [total, documents] = await Promise.all([
      prisma.document.count({ where: whereClause }),
      prisma.document.findMany({
        where: whereClause,
        include: {
          owner: {
            select: { id: true, fullName: true, email: true },
          },
          permissions: {
            where: { granteeId: auth.user.id },
            select: { permissionLevel: true },
          },
        },
        orderBy: { [sortBy]: sortOrderParam },
        skip,
        take: limit,
      }),
    ]);

    // Format results with user's effective permission
    const formatted = documents.map((doc) => {
      const isOwner = doc.ownerId === auth.user.id;
      const userGrant = doc.permissions[0]?.permissionLevel;
      const permissionLevel = isOwner ? "OWNER" : (userGrant as "READ" | "EDIT");

      return {
        id: doc.id,
        title: doc.title,
        originalFilename: doc.originalFilename,
        description: doc.description,
        category: doc.category,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        sha256Hash: doc.sha256Hash,
        owner: doc.owner,
        isOwner,
        permissionLevel,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    return NextResponse.json({
      documents: formatted,
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
