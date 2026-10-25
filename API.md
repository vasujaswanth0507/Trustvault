# TrustVault REST API Specification (API.md)

This document provides complete documentation for the TrustVault REST API, including endpoint specifications, server authorization policies, permission matrices, request schemas, example responses, and audit events generated.

---

## 1. Global Security Policies

- **Authentication**: All endpoints (except `/api/auth/login` and `/api/health`) require a valid server session transmitted via the HTTP-only `trustvault_session` cookie or `Authorization: Bearer <token>` header.
- **Authorization**: Deny-by-default. Endpoints enforce role and per-document permission checks strictly on the server.
- **Error Responses**:
  - `401 Unauthorized`: Missing, expired, or invalid session.
  - `403 Forbidden`: Authenticated user lacks required global role, document permission, or account is deactivated.
  - `404 Not Found`: Returned when a document does not exist OR when the user is not authorized to access it (IDOR protection).
  - `400 Bad Request`: Validation failure on input schema or file signature.
  - `500 Internal Server Error`: Generic internal server error (no stack traces leaked).

---

## 2. Endpoint Permission Matrix

| HTTP Method | Route | Description | Required Role / Permission | Audit Event Generated |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health & storage status | Public / None | None |
| `POST` | `/api/auth/login` | Authenticate user credentials | Public / None | `LOGIN_SUCCESS` or `LOGIN_FAILURE` |
| `POST` | `/api/auth/logout` | Invalidate current session | Authenticated user | `LOGOUT` |
| `GET` | `/api/auth/me` | Fetch active user profile | Active user (`isActive: true`) | None |
| `POST` | `/api/documents` | Upload and ingest document | Active user (`isActive: true`) | `DOCUMENT_UPLOAD` or `SECURITY_VALIDATION_FAILURE` |
| `GET` | `/api/documents` | Search & list authorized docs | Active user (scoped to owned/granted) | None |
| `GET` | `/api/documents/:id` | Get document details | `OWNER`, `EDIT`, or `READ` grant | `DOCUMENT_VIEW` or `ACCESS_DENIED` |
| `PATCH` | `/api/documents/:id` | Update document metadata | `OWNER` or `EDIT` grant | `DOCUMENT_UPDATE` (fail-closed) |
| `DELETE` | `/api/documents/:id` | Delete document from vault | `OWNER` strictly | `DOCUMENT_DELETE` (fail-closed) |
| `GET` | `/api/documents/:id/download` | Stream protected file bytes | `OWNER`, `EDIT`, or `READ` grant | `DOCUMENT_DOWNLOAD` or `ACCESS_DENIED` |
| `GET` | `/api/documents/:id/permissions` | List document user grants | `OWNER` strictly | None |
| `POST` | `/api/documents/:id/permissions` | Grant READ/EDIT to user | `OWNER` strictly | `PERMISSION_GRANT` (fail-closed) |
| `DELETE` | `/api/documents/:id/permissions/:permId` | Revoke user permission | `OWNER` strictly | `PERMISSION_REVOKE` (fail-closed) |
| `GET` | `/api/documents/:id/audit` | View document audit trail | `OWNER` strictly | None |
| `GET` | `/api/admin/overview` | System metrics & summary | `ADMINISTRATOR` strictly | None (denied logged as `ACCESS_DENIED`) |
| `GET` | `/api/admin/users` | List user accounts & status | `ADMINISTRATOR` strictly | None |
| `PATCH` | `/api/admin/users/:id` | Toggle active status / role | `ADMINISTRATOR` strictly | `USER_STATUS_CHANGE` |
| `GET` | `/api/admin/audit` | Query full audit trail | `ADMINISTRATOR` strictly | None |
| `GET` | `/api/admin/audit/verify` | Verify cryptographic hash chain | `ADMINISTRATOR` strictly | None |

---

## 3. Detailed Endpoint Reference

### 3.1 Authentication

#### `POST /api/auth/login`
- **Body**:
  ```json
  {
    "email": "owner-a@example.test",
    "password": "Password123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "e8a939f4-1234-4567-89ab-cdef01234567",
      "email": "owner-a@example.test",
      "fullName": "Alice Owner",
      "role": "OWNER"
    }
  }
  ```
- **Error Response (401 Unauthorized)**:
  ```json
  {
    "error": "Invalid email or password"
  }
  ```
- **Error Response (403 Forbidden - Inactive Account)**:
  ```json
  {
    "error": "Account has been deactivated. Please contact your system administrator."
  }
  ```

---

### 3.2 Documents

#### `POST /api/documents`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: Binary file (PDF, DOCX, XLSX, PNG, JPEG)
  - `title`: String (2 - 200 characters)
  - `category`: String (`FINANCIAL`, `LEGAL`, `COMPLIANCE`, `TECHNICAL`, `INTERNAL`, `GENERAL`)
  - `description`: Optional String
- **Validation**:
  - Server inspects magic bytes (cryptographic header signature).
  - Sanitizes filename to prevent directory traversal.
  - Saves file under random opaque UUID key outside web root.
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "document": {
      "id": "7b8a1c92-6d35-4362-962a-64e3ae865e61",
      "title": "Q3 Financial Audit Report",
      "originalFilename": "Q3_Financial_Audit_Report.pdf",
      "description": "Quarterly audit documentation",
      "category": "FINANCIAL",
      "mimeType": "application/pdf",
      "fileSize": 1048576,
      "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "createdAt": "2026-10-25T11:00:00.000Z",
      "permissionLevel": "OWNER"
    }
  }
  ```

#### `GET /api/documents/:id/download`
- **Security Check**: Enforces `requireDocumentDownloadAccess`. Verifies session, active status, and that user is owner or has active READ/EDIT grant.
- **Headers Returned**:
  ```http
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="Q3_Financial_Audit_Report.pdf"; filename*=UTF-8''Q3_Financial_Audit_Report.pdf
  X-Content-Type-Options: nosniff
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
  ```
- **Denied Response**: Returns HTTP 404 with 0 file bytes streamed.

---

### 3.3 Permissions

#### `POST /api/documents/:id/permissions`
- **Security Check**: Enforces `requireDocumentOwner`. Only the document owner can grant access.
- **Body**:
  ```json
  {
    "email": "viewer-a@example.test",
    "permissionLevel": "READ"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "permission": {
      "id": "perm-uuid-1234",
      "documentId": "7b8a1c92-6d35-4362-962a-64e3ae865e61",
      "granteeId": "user-uuid-5678",
      "permissionLevel": "READ",
      "grantedById": "owner-uuid-0001",
      "createdAt": "2026-10-25T11:15:00.000Z"
    }
  }
  ```

#### `DELETE /api/documents/:id/permissions/:permissionId`
- **Security Check**: Enforces `requireDocumentOwner`.
- **Immediate Effect**: Grant is deleted from the database. The grantee's very next request to view or download is denied instantly with HTTP 404.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Permission grant revoked immediately"
  }
  ```

---

### 3.4 Audit Trail & Verification

#### `GET /api/admin/audit/verify`
- **Security Check**: Enforces `requireAdministrator`.
- **Verification Logic**: Recomputes canonical SHA-256 hash for every event in sequential order and verifies that `event[i].previousEventHash === event[i-1].currentEventHash`.
- **Success Response (200 OK)**:
  ```json
  {
    "verification": {
      "isValid": true,
      "totalEvents": 42,
      "verifiedEvents": 42,
      "genesisHash": "GENESIS_HASH_TRUSTVAULT_V1_0000000000000000000000000000000000000000",
      "latestHash": "ae6e9e705acaf13136d541d2fba214e5fd9590ee3577b01263529b113fb85c0f"
    },
    "checkedAt": "2026-10-25T11:30:00.000Z"
  }
  ```
- **Tampered Chain Response (200 OK)**:
  ```json
  {
    "verification": {
      "isValid": false,
      "totalEvents": 42,
      "verifiedEvents": 34,
      "tamperedEventId": "event-uuid-bad",
      "error": "Tampered event detected at sequence 35: stored hash does not match recomputed hash"
    }
  }
  ```
