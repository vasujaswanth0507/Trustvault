import { NextRequest } from "next/server";
import { User, Document, DocumentPermission } from "@prisma/client";
import { extractSessionToken, validateSession } from "./session";
import { prisma } from "../db/prisma";
import { logAuditEvent } from "../audit/audit-service";

export class AuthorizationError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode = 403, errorCode = "FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export interface AuthContext {
  user: User;
  sessionToken: string;
}

export interface DocumentAuthContext {
  user: User;
  document: Document;
  permissionLevel: "OWNER" | "EDIT" | "READ";
  permission?: DocumentPermission;
}

/**
 * Ensures the request has a valid, unexpired server session.
 * Throws 401 Unauthorized if not authenticated.
 */
export async function requireAuthenticatedUser(req?: NextRequest): Promise<AuthContext> {
  const token = extractSessionToken(req);
  if (!token) {
    throw new AuthorizationError("Authentication required to access this resource", 401, "UNAUTHENTICATED");
  }

  const session = await validateSession(token);
  if (!session) {
    throw new AuthorizationError("Session is invalid or has expired", 401, "SESSION_EXPIRED");
  }

  return {
    user: session.user,
    sessionToken: session.sessionToken,
  };
}

/**
 * Ensures the authenticated user is currently active (not deactivated/disabled).
 * Throws 403 Forbidden if account is inactive.
 */
export async function requireActiveUser(req?: NextRequest): Promise<AuthContext> {
  const auth = await requireAuthenticatedUser(req);
  if (!auth.user.isActive) {
    await logAuditEvent({
      actorId: auth.user.id,
      action: "ACCESS_DENIED",
      resourceType: "AUTH",
      resourceId: auth.user.id,
      outcome: "DENIED",
      metadata: { reason: "Deactivated or inactive account access attempt" },
    }).catch(() => {});

    throw new AuthorizationError("Account is inactive or disabled", 403, "ACCOUNT_INACTIVE");
  }
  return auth;
}

/**
 * Ensures the authenticated user has the ADMINISTRATOR global role.
 * Throws 403 Forbidden if the user is not an administrator.
 */
export async function requireAdministrator(req?: NextRequest): Promise<AuthContext> {
  const auth = await requireActiveUser(req);
  if (auth.user.role !== "ADMINISTRATOR") {
    // Record denied access attempt
    await logAuditEvent({
      actorId: auth.user.id,
      action: "ACCESS_DENIED",
      resourceType: "SYSTEM",
      resourceId: "ADMIN_CONSOLE",
      outcome: "DENIED",
      metadata: { reason: "User lacks ADMINISTRATOR role", userRole: auth.user.role },
    }).catch(() => {});

    throw new AuthorizationError("Administrative privilege required", 403, "ADMINISTRATOR_REQUIRED");
  }
  return auth;
}

/**
 * Ensures the authenticated user is the explicit OWNER of the requested document.
 * Throws 404 Not Found to prevent enumeration by unauthorized users.
 */
export async function requireDocumentOwner(req: NextRequest | undefined, documentId: string): Promise<DocumentAuthContext> {
  const auth = await requireActiveUser(req);

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.deletedAt !== null) {
    throw new AuthorizationError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  if (document.ownerId !== auth.user.id) {
    // Log unauthorized attempt without leaking document title or metadata
    await logAuditEvent({
      actorId: auth.user.id,
      action: "ACCESS_DENIED",
      resourceType: "DOCUMENT",
      resourceId: document.id,
      outcome: "DENIED",
      metadata: { reason: "User is not the document owner", attemptedAction: "OWNER_OPERATION" },
    }).catch(() => {});

    // Return 404 rather than 403 to prevent document enumeration
    throw new AuthorizationError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  return {
    user: auth.user,
    document,
    permissionLevel: "OWNER",
  };
}

/**
 * Ensures the authenticated user has READ access to the document.
 * Permitted if:
 * 1. User is the document owner, OR
 * 2. User has an explicit READ or EDIT grant in DocumentPermission table.
 *
 * NOTE: Administrators DO NOT automatically have read access to confidential documents.
 * Returns 404 on access denial to prevent enumeration.
 */
export async function requireDocumentReadAccess(req: NextRequest | undefined, documentId: string): Promise<DocumentAuthContext> {
  const auth = await requireActiveUser(req);

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      permissions: {
        where: { granteeId: auth.user.id },
      },
    },
  });

  if (!document || document.deletedAt !== null) {
    throw new AuthorizationError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  // 1. Is user the owner?
  if (document.ownerId === auth.user.id) {
    return {
      user: auth.user,
      document,
      permissionLevel: "OWNER",
    };
  }

  // 2. Does user have an explicit grant?
  const grant = document.permissions[0];
  if (grant && (grant.permissionLevel === "READ" || grant.permissionLevel === "EDIT")) {
    return {
      user: auth.user,
      document,
      permissionLevel: grant.permissionLevel as "READ" | "EDIT",
      permission: grant,
    };
  }

  // 3. Deny by default: Log denied access attempt
  await logAuditEvent({
    actorId: auth.user.id,
    action: "ACCESS_DENIED",
    resourceType: "DOCUMENT",
    resourceId: document.id,
    outcome: "DENIED",
    metadata: {
      reason: "User lacks READ permission",
      userRole: auth.user.role,
      isOwner: false,
    },
  }).catch(() => {});

  // Return 404 to prevent resource existence disclosure (IDOR mitigation)
  throw new AuthorizationError("Document not found", 404, "DOCUMENT_NOT_FOUND");
}

/**
 * Ensures the authenticated user has EDIT access to the document.
 * Permitted if:
 * 1. User is the document owner, OR
 * 2. User has an explicit EDIT grant.
 */
export async function requireDocumentEditAccess(req: NextRequest | undefined, documentId: string): Promise<DocumentAuthContext> {
  const auth = await requireActiveUser(req);

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      permissions: {
        where: { granteeId: auth.user.id },
      },
    },
  });

  if (!document || document.deletedAt !== null) {
    throw new AuthorizationError("Document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  if (document.ownerId === auth.user.id) {
    return {
      user: auth.user,
      document,
      permissionLevel: "OWNER",
    };
  }

  const grant = document.permissions[0];
  if (grant && grant.permissionLevel === "EDIT") {
    return {
      user: auth.user,
      document,
      permissionLevel: "EDIT",
      permission: grant,
    };
  }

  // If user had READ, they know it exists, so 403 is appropriate; otherwise 404.
  const hasRead = grant && grant.permissionLevel === "READ";
  const statusCode = hasRead ? 403 : 404;

  await logAuditEvent({
    actorId: auth.user.id,
    action: "ACCESS_DENIED",
    resourceType: "DOCUMENT",
    resourceId: document.id,
    outcome: "DENIED",
    metadata: { reason: "User lacks EDIT permission", hadRead: !!hasRead },
  }).catch(() => {});

  throw new AuthorizationError(
    hasRead ? "Insufficient permission to edit document" : "Document not found",
    statusCode,
    hasRead ? "INSUFFICIENT_PERMISSIONS" : "DOCUMENT_NOT_FOUND"
  );
}

/**
 * Ensures the authenticated user has permission to download confidential document file bytes.
 * Governed by READ permission.
 * Never streams file bytes if check fails.
 */
export async function requireDocumentDownloadAccess(req: NextRequest | undefined, documentId: string): Promise<DocumentAuthContext> {
  return requireDocumentReadAccess(req, documentId);
}
