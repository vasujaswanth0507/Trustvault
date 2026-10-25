# AI Development Log (PROMPTS.md)

This log records the genuine engineering decisions, design revisions, vulnerability analyses, and corrections made during the development of TrustVault. Every commit reference and test assertion documented here corresponds directly to the repository history and test suite.

---

### Entry 1: Database-Backed Session Validation vs. Inactive Account Deactivation

- **Date**: 2026-10-25
- **Task**: Implement session management and server-side authentication in `lib/auth/session.ts` and `lib/auth/authorization.ts`.
- **Summary of Solution**: Built a server-side session store using opaque 256-bit random tokens stored in the database and HTTP-only cookies.
- **Specific Error / Weakness Discovered**: During test execution of `tests/auth.test.ts`, the test `inactive accounts cannot access protected resources` failed with `expected 401 to be 403`. Investigation revealed that `validateSession` checked `if (!session.user.isActive) return null;`. When an authenticated user whose account had been deactivated made a request, `requireAuthenticatedUser` treated `null` as an invalid/expired session and threw `401 Unauthorized` instead of `403 Forbidden` (`ACCOUNT_INACTIVE`). This conflated authentication (who you are) with authorization/status (what permissions you hold), preventing the system from specifically logging deactivated access attempts to the audit trail.
- **How Corrected**:
  1. Updated `validateSession` in `lib/auth/session.ts` to return the session and user record even if `isActive` is false.
  2. Updated `requireActiveUser` in `lib/auth/authorization.ts` to specifically check `if (!auth.user.isActive)`, log an explicit `ACCESS_DENIED` audit event with reason `"Account is inactive or disabled"`, and throw an `AuthorizationError` with HTTP status `403` and code `"ACCOUNT_INACTIVE"`.
- **Git Commit Reference**: Commit `73c40b5` (`feat(security): implement centralized authorization, private storage, hash-chain audit logs, and security test suite`)
- **Verification Test**: `tests/auth.test.ts` (`inactive accounts cannot access protected resources`)

---

### Entry 2: Cascading Foreign Key Deletion Mutating Audit Evidence

- **Date**: 2026-10-25
- **Task**: Maintain audit hash chain integrity across all lifecycle operations including user management and test teardown.
- **Summary of Solution**: Built a cryptographic hash chain using canonical SHA-256 serialization where each event hashes `[sequenceNumber, timestamp, actorId, action, resourceType, resourceId, outcome, correlationId, metadataHash, previousEventHash]`.
- **Specific Error / Weakness Discovered**: When running `npm test`, `tests/audit-tamper.test.ts` and `tests/sanity.test.ts` failed unexpectedly with a hash mismatch at sequence 32 (`LOGIN_FAILURE`). Debugging revealed that `tests/auth.test.ts` had created a temporary user and deleted it in a `finally` block using `prisma.user.delete()`. Because the Prisma schema defined `actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)`, SQLite/Prisma automatically executed `ON DELETE SET NULL` on all audit events referencing that user. Mutating `actorId` from the user's UUID to `null` silently changed the event's canonical hash from the actor's UUID to `"ANONYMOUS"`, corrupting the cryptographic chain.
- **How Corrected**:
  1. Recognized that audit records must never be subjected to database cascading mutations.
  2. Updated `prisma/seed.ts` and `prisma/seed.js` to seed a permanent `deactivated-user@example.test` with `isActive: false` instead of dynamically creating and deleting test users during test runs.
  3. Prohibited deletion of user records referenced in the audit chain, enforcing that accounts are deactivated rather than hard-deleted.
- **Git Commit Reference**: Commit `73c40b5` and Commit `105298f`
- **Verification Test**: `tests/audit-tamper.test.ts` and `tests/sanity.test.ts` (`verifies seeded audit hash-chain integrity`)

---

### Entry 3: Immediate Revocation vs. Insecure Direct Object Reference in Downloads

- **Date**: 2026-10-25
- **Task**: Design the download route `app/api/documents/[id]/download/route.ts` and enforce immediate permission revocation.
- **Summary of Solution**: Implemented a server-side authenticated download proxy streaming private file buffers from `./storage/vault_data` with security headers (`Content-Disposition: attachment`, `nosniff`, `no-store`).
- **Specific Error / Weakness Discovered**: Initial architecture considered using pre-signed S3 URLs. However, threat modeling revealed that signed URLs cannot be immediately revoked: an issued signed URL remains valid in the wild until its expiration timestamp lapses, violating Core Guarantee #4 ("Revoking document access must immediately prevent future authorized operations"). Furthermore, simply returning `403 Forbidden` on unauthorized download requests leaks that a confidential document with that ID exists (IDOR enumeration).
- **How Corrected**:
  1. Rejected pre-signed URLs in favor of an authenticated streaming proxy that queries the database authorization state on every single request.
  2. Implemented HTTP 404 response masking on all unauthorized document requests in `requireDocumentReadAccess` and `requireDocumentDownloadAccess`, preventing attackers from probing valid document UUIDs.
  3. Ensured 0 file bytes are streamed when authorization fails.
- **Git Commit Reference**: Commit `73c40b5`
- **Verification Test**: `tests/revocation.test.ts` (`immediately denies access upon grant revocation with no stale authorization`) and `tests/document-isolation.test.ts` (`Unauthorized users cannot download confidential file bytes`)

---

### Entry 4: Next.js Webpack Native Node Addon Compilation Failure

- **Date**: 2026-10-25
- **Task**: Run `npm run build` to verify production compilation of Next.js 14 and `@node-rs/argon2`.
- **Summary of Solution**: Executed standard Next.js standalone build.
- **Specific Error / Weakness Discovered**: Next.js webpack bundler failed with:
  `Module parse failed: Unexpected character in ./node_modules/@node-rs/argon2-win32-x64-msvc/argon2.win32-x64-msvc.node. You may need an appropriate loader to handle this file type`.
  Webpack was attempting to bundle the native compiled C++ `.node` binary into client/server bundles instead of treating it as an external Node.js module.
- **How Corrected**:
  1. Created `next.config.mjs` with:
     ```js
     const nextConfig = {
       experimental: {
         serverComponentsExternalPackages: ["@node-rs/argon2", "@prisma/client", "prisma"],
       },
       webpack: (config, { isServer }) => {
         if (isServer) {
           config.externals = [...(config.externals || []), "@node-rs/argon2"];
         }
         return config;
       },
     };
     ```
  2. This instructed Next.js to preserve `@node-rs/argon2` as an external runtime dependency, resolving the webpack parsing error.
- **Git Commit Reference**: Commit `105298f` (`feat(ui): complete enterprise SaaS UI with dashboard, vault library, upload, details, admin console, and audit explorer`)
- **Verification Test**: `npm run build` successfully generating static and dynamic routes.

---

### Entry 5: TypeScript Ambient Const Enum and Web BodyInit Incompatibilities

- **Date**: 2026-10-25
- **Task**: Resolve TypeScript compilation errors during `next build` type-checking.
- **Summary of Solution**: Addressed strict type checks enforced by Next.js's production type-checking pipeline.
- **Specific Error / Weakness Discovered**: Two distinct TypeScript compiler errors were caught:
  1. In `lib/crypto/password.ts` and `prisma/seed.ts`: `Type error: Cannot access ambient const enums when 'isolatedModules' is enabled. algorithm: argon2.Algorithm.Argon2id`. TypeScript's `isolatedModules` flag forbids referencing ambient const enums from external type definitions without values.
  2. In `app/api/documents/[id]/download/route.ts`: `Type error: Argument of type 'Buffer' is not assignable to parameter of type 'BodyInit | null | undefined'`. In DOM/NextResponse typings, Node.js `Buffer` does not satisfy the global Web API `BodyInit` interface.
- **How Corrected**:
  1. Replaced `argon2.Algorithm.Argon2id` with the numerical constant `2` (the official Argon2id algorithm identifier in `@node-rs/argon2`), eliminating the ambient enum reference.
  2. Wrapped `fileBuffer` in `new Uint8Array(fileBuffer)` in `NextResponse`, which satisfies the Web API `BodyInit` typing and ensures cross-platform streaming without TypeScript errors.
- **Git Commit Reference**: Commit `105298f`
- **Verification Test**: `npm run build` completed with zero TypeScript errors.
