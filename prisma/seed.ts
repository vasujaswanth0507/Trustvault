import { PrismaClient } from "@prisma/client";
import * as argon2 from "@node-rs/argon2";
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";
const GENESIS_HASH = "GENESIS_HASH_TRUSTVAULT_V1_0000000000000000000000000000000000000000";

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function computeEventHash(event: {
  sequenceNumber: number;
  timestamp: string | Date;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  correlationId: string | null;
  metadata: string | null;
  previousEventHash: string;
}): string {
  const ts = event.timestamp instanceof Date ? event.timestamp.toISOString() : new Date(event.timestamp).toISOString();
  const metaHash = event.metadata ? sha256(event.metadata) : "NO_METADATA";

  const canonicalPayload = [
    event.sequenceNumber.toString(),
    ts,
    event.actorId || "ANONYMOUS",
    event.action,
    event.resourceType,
    event.resourceId || "NONE",
    event.outcome,
    event.correlationId || "NONE",
    metaHash,
    event.previousEventHash,
  ].join("|");

  return sha256(canonicalPayload);
}

async function main() {
  console.log("Seeding TrustVault database...");

  const storageDir = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_ROOT || "./storage/vault_data");
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true, mode: 0o700 });
  }

  // Clear existing data safely
  await prisma.auditEvent.deleteMany({});
  await prisma.auditChainHead.deleteMany({});
  await prisma.documentPermission.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Initialize Audit Chain Head
  await prisma.auditChainHead.create({
    data: {
      id: "singleton",
      latestSequenceNumber: 0,
      latestHash: GENESIS_HASH,
    },
  });

  let currentSeq = 0;
  let previousHash = GENESIS_HASH;

  async function appendAuditEvent(
    action: string,
    resourceType: string,
    resourceId: string | null,
    actorId: string | null,
    metadataObj?: Record<string, unknown>
  ) {
    currentSeq++;
    const now = new Date();
    const metaStr = metadataObj ? JSON.stringify(metadataObj) : null;

    const eventHash = computeEventHash({
      sequenceNumber: currentSeq,
      timestamp: now,
      actorId,
      action,
      resourceType,
      resourceId,
      outcome: "SUCCESS",
      correlationId: `seed-${currentSeq}`,
      metadata: metaStr,
      previousEventHash: previousHash,
    });

    await prisma.auditEvent.create({
      data: {
        id: randomUUID(),
        sequenceNumber: currentSeq,
        timestamp: now,
        actorId,
        action,
        resourceType,
        resourceId,
        outcome: "SUCCESS",
        correlationId: `seed-${currentSeq}`,
        metadata: metaStr,
        previousEventHash: previousHash,
        currentEventHash: eventHash,
      },
    });

    previousHash = eventHash;

    await prisma.auditChainHead.update({
      where: { id: "singleton" },
      data: {
        latestSequenceNumber: currentSeq,
        latestHash: previousHash,
      },
    });
  }

  // 2. Hash default password with Argon2id
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    algorithm: 2,
  });

  // 3. Create Seed Users
  const admin = await prisma.user.create({
    data: {
      email: "admin@example.test",
      passwordHash,
      fullName: "System Security Administrator",
      role: "ADMINISTRATOR",
      isActive: true,
    },
  });
  await appendAuditEvent("USER_STATUS_CHANGE", "USER", admin.id, null, { email: admin.email, role: admin.role });

  const ownerA = await prisma.user.create({
    data: {
      email: "owner-a@example.test",
      passwordHash,
      fullName: "Alice Owner (Finance & Compliance)",
      role: "OWNER",
      isActive: true,
    },
  });
  await appendAuditEvent("USER_STATUS_CHANGE", "USER", ownerA.id, admin.id, { email: ownerA.email, role: ownerA.role });

  const ownerB = await prisma.user.create({
    data: {
      email: "owner-b@example.test",
      passwordHash,
      fullName: "Bob Owner (Engineering & Operations)",
      role: "OWNER",
      isActive: true,
    },
  });
  await appendAuditEvent("USER_STATUS_CHANGE", "USER", ownerB.id, admin.id, { email: ownerB.email, role: ownerB.role });

  const viewerA = await prisma.user.create({
    data: {
      email: "viewer-a@example.test",
      passwordHash,
      fullName: "Victor Viewer (Internal Auditor)",
      role: "VIEWER",
      isActive: true,
    },
  });
  await appendAuditEvent("USER_STATUS_CHANGE", "USER", viewerA.id, admin.id, { email: viewerA.email, role: viewerA.role });

  const viewerB = await prisma.user.create({
    data: {
      email: "viewer-b@example.test",
      passwordHash,
      fullName: "Valerie Viewer (External Auditor)",
      role: "VIEWER",
      isActive: true,
    },
  });
  await appendAuditEvent("USER_STATUS_CHANGE", "USER", viewerB.id, admin.id, { email: viewerB.email, role: viewerB.role });

  const inactiveUser = await prisma.user.create({
    data: {
      email: "deactivated-user@example.test",
      passwordHash,
      fullName: "Disabled Former Employee",
      role: "VIEWER",
      isActive: false,
    },
  });
  await appendAuditEvent("USER_STATUS_CHANGE", "USER", inactiveUser.id, admin.id, {
    email: inactiveUser.email,
    reason: "Account deactivated by administrator",
  });

  // 4. Create Sample Documents & Files
  // Helper to create synthetic files with valid magic bytes
  function createSyntheticFile(filename: string, magicHeader: Buffer, bodyText: string): { storageKey: string; sha256Hash: string; size: number } {
    const storageKey = `${randomUUID()}${path.extname(filename)}`;
    const targetPath = path.resolve(storageDir, storageKey);
    const bodyBuffer = Buffer.from(bodyText, "utf-8");
    const fullBuffer = Buffer.concat([magicHeader, bodyBuffer]);

    fs.writeFileSync(targetPath, fullBuffer);
    const hash = sha256(fullBuffer);

    return { storageKey, sha256Hash: hash, size: fullBuffer.length };
  }

  // PDF magic bytes: %PDF-1.4
  const pdfHeader = Buffer.from("%PDF-1.4\n%synthetic-trustvault-pdf-header\n", "ascii");
  // ZIP/DOCX/XLSX magic bytes: PK\x03\x04
  const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

  // Document 1: Q3 Financial Audit Report (Owner A -> Shared with Viewer A: READ)
  const file1 = createSyntheticFile("Q3_Financial_Audit_Report.pdf", pdfHeader, "CONFIDENTIAL FINANCIAL AUDIT REPORT: Revenue, Expenses, EBITDA, Projections.");
  const doc1 = await prisma.document.create({
    data: {
      title: "Q3 Financial Audit Report",
      originalFilename: "Q3_Financial_Audit_Report.pdf",
      description: "Quarterly financial review prepared for regulatory compliance and audit committees.",
      category: "FINANCIAL",
      mimeType: "application/pdf",
      fileSize: file1.size,
      sha256Hash: file1.sha256Hash,
      storageKey: file1.storageKey,
      ownerId: ownerA.id,
    },
  });
  await appendAuditEvent("DOCUMENT_UPLOAD", "DOCUMENT", doc1.id, ownerA.id, { title: doc1.title, category: doc1.category });

  // Grant READ on doc1 to viewerA
  const grant1 = await prisma.documentPermission.create({
    data: {
      documentId: doc1.id,
      granteeId: viewerA.id,
      permissionLevel: "READ",
      grantedById: ownerA.id,
    },
  });
  await appendAuditEvent("PERMISSION_GRANT", "PERMISSION", grant1.id, ownerA.id, {
    documentId: doc1.id,
    granteeId: viewerA.id,
    permissionLevel: "READ",
  });

  // Document 2: Security Compliance Matrix (Owner A -> Shared with Owner B: EDIT)
  const file2 = createSyntheticFile("Security_Compliance_Matrix_2026.docx", zipHeader, "SOC2 Type II, ISO 27001, and HIPAA compliance mapping matrix.");
  const doc2 = await prisma.document.create({
    data: {
      title: "Security Compliance Matrix 2026",
      originalFilename: "Security_Compliance_Matrix_2026.docx",
      description: "Controls mapping and audit evidence index for enterprise certifications.",
      category: "COMPLIANCE",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSize: file2.size,
      sha256Hash: file2.sha256Hash,
      storageKey: file2.storageKey,
      ownerId: ownerA.id,
    },
  });
  await appendAuditEvent("DOCUMENT_UPLOAD", "DOCUMENT", doc2.id, ownerA.id, { title: doc2.title, category: doc2.category });

  // Grant EDIT on doc2 to ownerB
  const grant2 = await prisma.documentPermission.create({
    data: {
      documentId: doc2.id,
      granteeId: ownerB.id,
      permissionLevel: "EDIT",
      grantedById: ownerA.id,
    },
  });
  await appendAuditEvent("PERMISSION_GRANT", "PERMISSION", grant2.id, ownerA.id, {
    documentId: doc2.id,
    granteeId: ownerB.id,
    permissionLevel: "EDIT",
  });

  // Document 3: Merger & Acquisition Strategy (Owner A -> Strictly UNSHARED / Private)
  const file3 = createSyntheticFile("MA_Strategy_Strictly_Confidential.pdf", pdfHeader, "RESTRICTED EXECUTIVE MEMO: Target acquisitions, valuation multiples, integration timeline.");
  const doc3 = await prisma.document.create({
    data: {
      title: "M&A Strategy: Project Falcon",
      originalFilename: "MA_Strategy_Strictly_Confidential.pdf",
      description: "Board-level strategic acquisitions analysis. Highly confidential.",
      category: "LEGAL",
      mimeType: "application/pdf",
      fileSize: file3.size,
      sha256Hash: file3.sha256Hash,
      storageKey: file3.storageKey,
      ownerId: ownerA.id,
    },
  });
  await appendAuditEvent("DOCUMENT_UPLOAD", "DOCUMENT", doc3.id, ownerA.id, { title: doc3.title, category: doc3.category });

  // Document 4: Infrastructure Cryptographic Keys Inventory (Owner B -> Strictly UNSHARED / Private)
  const file4 = createSyntheticFile("Key_Inventory_2026.xlsx", zipHeader, "HARDWARE SECURITY MODULE & KMS ROTATION RECORDS: Master keys, key identifiers, validity intervals.");
  const doc4 = await prisma.document.create({
    data: {
      title: "Cryptographic Keys Rotation Schedule",
      originalFilename: "Key_Inventory_2026.xlsx",
      description: "Hardware Security Module (HSM) key rotation schedule and access control list.",
      category: "TECHNICAL",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSize: file4.size,
      sha256Hash: file4.sha256Hash,
      storageKey: file4.storageKey,
      ownerId: ownerB.id,
    },
  });
  await appendAuditEvent("DOCUMENT_UPLOAD", "DOCUMENT", doc4.id, ownerB.id, { title: doc4.title, category: doc4.category });

  // Document 5: Executive Compensation Review (Owner B -> Strictly UNSHARED / Private)
  const file5 = createSyntheticFile("Executive_Compensation_2026.pdf", pdfHeader, "CONFIDENTIAL HUMAN RESOURCES: Compensation committee benchmarks and equity allocations.");
  const doc5 = await prisma.document.create({
    data: {
      title: "Executive Compensation & Equity Plan",
      originalFilename: "Executive_Compensation_2026.pdf",
      description: "Confidential executive band reviews and equity incentive allocations.",
      category: "INTERNAL",
      mimeType: "application/pdf",
      fileSize: file5.size,
      sha256Hash: file5.sha256Hash,
      storageKey: file5.storageKey,
      ownerId: ownerB.id,
    },
  });
  await appendAuditEvent("DOCUMENT_UPLOAD", "DOCUMENT", doc5.id, ownerB.id, { title: doc5.title, category: doc5.category });

  console.log("Database seeded successfully!");
  console.log(`- Users: 5 (1 Admin, 2 Owners, 2 Viewers)`);
  console.log(`- Documents: 5 (2 Shared, 3 Strictly Unshared)`);
  console.log(`- Audit Events: ${currentSeq} (Chained with SHA-256)`);
  console.log(`- Chain Head Hash: ${previousHash}`);
  console.log(`- Default Demo Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
