"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ShieldCheck,
  Share2,
  Lock,
  ArrowRight,
  UploadCloud,
  FileCheck2,
  Clock,
  ShieldAlert,
  HardDrive,
} from "lucide-react";

interface DocumentItem {
  id: string;
  title: string;
  originalFilename: string;
  category: string;
  fileSize: number;
  isOwner: boolean;
  permissionLevel: "OWNER" | "READ" | "EDIT";
  owner: { fullName: string; email: string };
  createdAt: string;
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const res = await fetch("/api/documents?limit=5");
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents);
        }
      } catch {
        // Handled via empty state
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const totalAccessible = documents.length;
  const ownedCount = documents.filter((d) => d.isOwner).length;
  const sharedWithMeCount = documents.filter((d) => !d.isOwner).length;

  const categoryCounts = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <AppLayout title="Security Dashboard" subtitle="Enterprise vault metrics and authorized document summary">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <Card className="border-teal-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accessible Docs</span>
            <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{loading ? "..." : totalAccessible}</div>
          <p className="text-[11px] text-teal-400/90 mt-1 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Server-authorized scope
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Owned Documents</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{loading ? "..." : ownedCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Full delegation control</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shared With You</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Share2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{loading ? "..." : sharedWithMeCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Named-user read/edit grants</p>
        </Card>

        <Card className="border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Integrity</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-emerald-400">SHA-256 Chained</div>
          <p className="text-[11px] text-slate-400 mt-1">Cryptographic tamper evidence</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Authorized Documents Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent Authorized Documents</CardTitle>
                <CardDescription>Documents you own or have explicit grants to discover</CardDescription>
              </div>
              <Link href="/documents">
                <Button variant="ghost" size="sm" className="text-xs text-teal-400 hover:text-teal-300">
                  <span>View All Vault Docs</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>

            {loading ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs">
                Querying Server Authorization Matrix...
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <FileText className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">No authorized documents found in your vault</p>
                <Link href="/documents/upload">
                  <Button size="sm" variant="outline">
                    <UploadCloud className="h-4 w-4 mr-1.5" />
                    Upload your first document
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="py-3.5 px-2 flex items-center justify-between hover:bg-slate-800/40 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="text-sm font-semibold text-slate-200 hover:text-teal-300 truncate block transition-colors"
                        >
                          {doc.title}
                        </Link>
                        <p className="text-xs text-slate-500 font-mono truncate">
                          {doc.originalFilename} • {Math.round(doc.fileSize / 1024)} KB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="neutral" className="text-[10px]">
                        {doc.category}
                      </Badge>
                      <Badge
                        variant={doc.isOwner ? "owner" : doc.permissionLevel === "EDIT" ? "warning" : "info"}
                        className="text-[10px]"
                      >
                        {doc.isOwner ? "OWNER" : `GRANT: ${doc.permissionLevel}`}
                      </Badge>
                      <Link href={`/documents/${doc.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs px-2 h-7 text-slate-400 hover:text-white">
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar Breakdown & Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardTitle className="mb-3">Vault Actions</CardTitle>
            <div className="space-y-2.5">
              <Link href="/documents/upload" className="block">
                <Button className="w-full justify-start gap-2" variant="primary">
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload Confidential File</span>
                </Button>
              </Link>
              <Link href="/documents" className="block">
                <Button className="w-full justify-start gap-2" variant="outline">
                  <FileText className="h-4 w-4" />
                  <span>Browse Document Library</span>
                </Button>
              </Link>
            </div>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardTitle className="mb-3">Category Distribution</CardTitle>
            {Object.keys(categoryCounts).length === 0 ? (
              <p className="text-xs text-slate-500">No categories indexed yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(categoryCounts).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-300 font-medium">{cat}</span>
                    <span className="font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[11px]">
                      {count} docs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Security Assurance Notice */}
          <Card className="border-slate-800 bg-slate-900/50">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-200">Zero-Bypass Architecture</p>
                <p className="leading-relaxed">
                  Every document read, download, metadata lookup, and permission change is cryptographically audited and
                  strictly authorized on the server.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
