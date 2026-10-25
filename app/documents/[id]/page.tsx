"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Download,
  Share2,
  Trash2,
  ShieldCheck,
  Lock,
  ArrowLeft,
  Clock,
  UserPlus,
  X,
  History,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Edit3,
} from "lucide-react";

interface DocumentDetail {
  id: string;
  title: string;
  originalFilename: string;
  description?: string;
  category: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  isOwner: boolean;
  permissionLevel: "OWNER" | "READ" | "EDIT";
  owner: { id: string; fullName: string; email: string };
  createdAt: string;
  updatedAt: string;
}

interface PermissionGrant {
  id: string;
  granteeId: string;
  permissionLevel: "READ" | "EDIT";
  grantee: { id: string; fullName: string; email: string; role: string };
  grantedBy: { id: string; fullName: string; email: string };
  createdAt: string;
}

interface AuditEventItem {
  id: string;
  sequenceNumber: number;
  timestamp: string;
  action: string;
  outcome: string;
  actor?: { fullName: string; email: string } | null;
  currentEventHash: string;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [permissions, setPermissions] = useState<PermissionGrant[]>([]);
  const [auditHistory, setAuditHistory] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // Sharing Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareLevel, setShareLevel] = useState<"READ" | "EDIT">("READ");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("GENERAL");
  const [editLoading, setEditLoading] = useState(false);

  const fetchDocumentData = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`);
      if (!res.ok) {
        setErrorStatus(res.status);
        return;
      }
      const data = await res.json();
      setDocument(data.document);
      setPermissions(data.permissions || []);
      setAuditHistory(data.auditHistory || []);
      setEditTitle(data.document.title);
      setEditDesc(data.document.description || "");
      setEditCategory(data.document.category);
    } catch {
      setErrorStatus(500);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentData();
  }, [documentId]);

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareLoading(true);
    setShareError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: shareEmail, permissionLevel: shareLevel }),
      });

      const data = await res.json();
      if (!res.ok) {
        setShareError(data.error || "Failed to grant permission.");
      } else {
        setShareEmail("");
        fetchDocumentData();
        setShowShareModal(false);
      }
    } catch {
      setShareError("Network error occurred.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokePermission = async (permId: string) => {
    if (!confirm("Are you sure you want to revoke this user's access immediately?")) return;

    try {
      const res = await fetch(`/api/documents/${documentId}/permissions/${permId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchDocumentData();
      }
    } catch {
      alert("Failed to revoke permission.");
    }
  };

  const handleUpdateMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, description: editDesc, category: editCategory }),
      });

      if (res.ok) {
        fetchDocumentData();
        setShowEditModal(false);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!confirm("Are you sure you want to permanently delete this document from the vault? This action is audited."))
      return;

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/documents");
      }
    } catch {
      alert("Failed to delete document.");
    }
  };

  if (loading) {
    return (
      <AppLayout title="Document Details">
        <div className="py-20 text-center font-mono text-xs text-slate-500">
          Validating Server-Side Access Grants...
        </div>
      </AppLayout>
    );
  }

  if (errorStatus === 404 || !document) {
    return (
      <AppLayout title="Access Denied / Not Found">
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400 mx-auto">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">404 • Resource Inaccessible</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The requested document either does not exist or you lack server-side authorization to discover or view its
            metadata.
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            Zero-Trust IDOR Protection: Denied attempts return 404 to avoid resource enumeration.
          </p>
          <div className="pt-2">
            <Link href="/documents">
              <Button size="sm" variant="outline">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Return to Authorized Documents
              </Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const canEdit = document.isOwner || document.permissionLevel === "EDIT";

  return (
    <AppLayout title={document.title} subtitle={`Category: ${document.category} • Original: ${document.originalFilename}`}>
      <div className="space-y-6">
        {/* Navigation & Action Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Documents</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <a href={`/api/documents/${document.id}/download`} download>
              <Button variant="primary" size="md">
                <Download className="h-4 w-4 mr-1.5" />
                Download File
              </Button>
            </a>

            {canEdit && (
              <Button variant="outline" size="md" onClick={() => setShowEditModal(true)}>
                <Edit3 className="h-4 w-4 mr-1.5" />
                Edit Metadata
              </Button>
            )}

            {document.isOwner && (
              <>
                <Button variant="secondary" size="md" onClick={() => setShowShareModal(true)}>
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Manage Grants
                </Button>
                <Button variant="danger" size="md" onClick={handleDeleteDocument}>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Metadata Details Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Document Metadata & Cryptographic Fingerprint</CardTitle>
                  <CardDescription>SHA-256 content verification and immutable storage reference</CardDescription>
                </div>
                <Badge
                  variant={document.isOwner ? "owner" : document.permissionLevel === "EDIT" ? "warning" : "info"}
                >
                  {document.isOwner ? "OWNER" : `GRANT: ${document.permissionLevel}`}
                </Badge>
              </CardHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Document UUID</span>
                  <span className="text-slate-200 select-all">{document.id}</span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Original Filename</span>
                  <span className="text-slate-200">{document.originalFilename}</span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">File Size & MIME</span>
                  <span className="text-slate-200">
                    {(document.fileSize / 1024).toFixed(1)} KB ({document.fileSize} bytes) • {document.mimeType}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Ingestion Date</span>
                  <span className="text-slate-200">{new Date(document.createdAt).toUTCString()}</span>
                </div>

                <div className="col-span-full p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">SHA-256 Content Hash</span>
                  <span className="text-teal-400 select-all font-semibold break-all">{document.sha256Hash}</span>
                </div>
              </div>

              {document.description && (
                <div className="mt-4 p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-lg text-xs text-slate-300">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans mb-1 font-semibold">
                    Description / Scope
                  </span>
                  <p>{document.description}</p>
                </div>
              )}
            </Card>

            {/* Document Owner Section: Audit Timeline */}
            {document.isOwner && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-teal-400" />
                    <div>
                      <CardTitle>Document Audit History</CardTitle>
                      <CardDescription>Immutable record of all access and mutation events</CardDescription>
                    </div>
                  </div>
                </CardHeader>

                {auditHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No audit events recorded for this document yet.</p>
                ) : (
                  <div className="divide-y divide-slate-800 text-xs font-mono">
                    {auditHistory.map((ev) => (
                      <div key={ev.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-slate-500 text-[11px]">#{ev.sequenceNumber}</span>
                          <Badge variant={ev.outcome === "SUCCESS" ? "success" : "danger"} className="text-[9px]">
                            {ev.action}
                          </Badge>
                          <span className="text-slate-300 truncate">{ev.actor?.fullName || "Anonymous Actor"}</span>
                        </div>
                        <div className="text-right shrink-0 text-slate-500 text-[11px]">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Right Column: Owner & Grants Overview */}
          <div className="space-y-6">
            <Card>
              <CardTitle className="mb-3">Document Ownership</CardTitle>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1">
                <p className="text-slate-200 font-semibold">{document.owner.fullName}</p>
                <p className="text-slate-400 font-mono text-[11px]">{document.owner.email}</p>
                <p className="text-teal-400/90 text-[10px] pt-1">Authorized through explicit asset ownership</p>
              </div>
            </Card>

            {/* Permissions Grants List (Visible only to owner) */}
            {document.isOwner ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Active Access Grants</CardTitle>
                    <CardDescription>Named users authorized by owner</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowShareModal(true)} className="h-7 text-xs px-2 text-teal-400">
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Grant
                  </Button>
                </CardHeader>

                {permissions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <Lock className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                    <span>Strictly private. No other users have been granted access.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {permissions.map((grant) => (
                      <div
                        key={grant.id}
                        className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="text-slate-200 font-medium">{grant.grantee.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{grant.grantee.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={grant.permissionLevel === "EDIT" ? "warning" : "info"} className="text-[10px]">
                            {grant.permissionLevel}
                          </Badge>
                          <button
                            onClick={() => handleRevokePermission(grant.id)}
                            title="Revoke Access Immediately"
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Card>
                <CardTitle className="mb-2">Your Delegation Rights</CardTitle>
                <p className="text-xs text-slate-400 leading-relaxed">
                  You are accessing this document through a delegated <span className="text-teal-400 font-semibold">{document.permissionLevel}</span> grant.
                  Only the document owner can grant or revoke access to other users.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Share Modal Dialog */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-teal-400" />
                  Grant Document Access
                </h3>
                <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Grant named users access to <strong className="text-slate-200">{document.title}</strong>. Revocation
                takes effect immediately.
              </p>

              {shareError && (
                <div className="p-3 bg-red-950/60 border border-red-800 text-xs text-red-300 rounded-lg">
                  {shareError}
                </div>
              )}

              <form onSubmit={handleGrantPermission} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Grantee Email
                  </label>
                  <Input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="colleague@organization.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Permission Level
                  </label>
                  <select
                    value={shareLevel}
                    onChange={(e) => setShareLevel(e.target.value as "READ" | "EDIT")}
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer"
                  >
                    <option value="READ">READ (View details and download file bytes)</option>
                    <option value="EDIT">EDIT (Read, download, and update metadata)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowShareModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={shareLoading}>
                    Grant Access
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Metadata Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-teal-400" />
                  Edit Document Metadata
                </h3>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateMetadata} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Title
                  </label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="FINANCIAL">Financial</option>
                    <option value="LEGAL">Legal</option>
                    <option value="COMPLIANCE">Compliance</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={editLoading}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
