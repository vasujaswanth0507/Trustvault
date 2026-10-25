"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  Users,
  ShieldCheck,
  FileCheck2,
  Lock,
  RefreshCw,
  AlertTriangle,
  History,
  CheckCircle2,
  UserX,
  UserCheck,
} from "lucide-react";

interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalDocuments: number;
  totalAuditEvents: number;
  deniedAttempts: number;
  categoryBreakdown: { category: string; count: number }[];
}

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  ownedDocumentsCount: number;
  grantsCount: number;
}

interface SecurityEvent {
  id: string;
  sequenceNumber: number;
  timestamp: string;
  action: string;
  outcome: string;
  metadata?: string | null;
  actor?: { fullName: string; email: string } | null;
}

interface VerificationStatus {
  isValid: boolean;
  totalEvents: number;
  verifiedEvents: number;
  latestHash: string;
  error?: string;
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      const [overviewRes, usersRes] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch("/api/admin/users"),
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setMetrics(data.metrics);
        setVerification(data.chainStatus);
        setSecurityEvents(data.recentSecurityEvents);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users);
      }
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/admin/audit/verify");
      if (res.ok) {
        const data = await res.json();
        setVerification(data.verification);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const actionName = currentStatus ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${actionName} this user account?`)) return;

    setUserActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update user status.");
      }
    } finally {
      setUserActionLoading(null);
    }
  };

  return (
    <AppLayout title="Administrator Security Console" subtitle="System-wide governance, user access management, and audit verification">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">User Directory</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{loading ? "..." : metrics?.totalUsers}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics?.activeUsers} Active • {metrics?.inactiveUsers} Deactivated
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System Documents</span>
            <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{loading ? "..." : metrics?.totalDocuments}</div>
          <p className="text-[11px] text-teal-400 mt-1 font-mono">Metadata Only • Zero File Bypass</p>
        </Card>

        <Card className="border-red-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Denied Access Events</span>
            <div className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-400">{loading ? "..." : metrics?.deniedAttempts}</div>
          <p className="text-[11px] text-slate-400 mt-1">IDOR & unauthorized attempts caught</p>
        </Card>

        <Card className="border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Head Chain</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-emerald-400">
            {verification?.isValid ? "Cryptographically Valid" : "Tampering Detected"}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {verification?.verifiedEvents} of {verification?.totalEvents} events verified
          </p>
        </Card>
      </div>

      {/* Audit Chain Verifier Widget */}
      <Card className="mb-8 border-teal-500/30 bg-slate-900/90">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">Cryptographic Audit Chain Integrity Verifier</h3>
                <Badge variant={verification?.isValid ? "success" : "danger"} className="text-[10px]">
                  {verification?.isValid ? "VERIFIED VALID" : "COMPROMISED"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Every audit event is canonically SHA-256 hashed and chained to the previous block.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              isLoading={verifying}
              onClick={handleVerifyChain}
              className="text-xs font-mono"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Re-Verify Cryptographic Links
            </Button>
            <Link href="/admin/audit">
              <Button variant="primary" size="sm" className="text-xs">
                <History className="h-3.5 w-3.5 mr-1.5" />
                Inspect Full Log
              </Button>
            </Link>
          </div>
        </div>

        {verification && (
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs font-mono grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-400">
            <div>
              <span className="text-slate-500">Current Chain Head Hash:</span>{" "}
              <span className="text-slate-200 select-all break-all">{verification.latestHash}</span>
            </div>
            <div>
              <span className="text-slate-500">Continuity Status:</span>{" "}
              <span className={verification.isValid ? "text-emerald-400" : "text-red-400 font-bold"}>
                {verification.isValid ? "No sequence gaps or broken links found." : verification.error}
              </span>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Account Management Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <CardTitle>User Account Governance</CardTitle>
                <CardDescription>Manage organizational roles and activate/deactivate compromised users</CardDescription>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Docs Owned</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-100 block">{u.fullName}</span>
                        <span className="text-[11px] text-slate-500 font-mono block">{u.email}</span>
                      </td>

                      <td className="py-3 px-3">
                        <Badge
                          variant={u.role === "ADMINISTRATOR" ? "danger" : u.role === "OWNER" ? "owner" : "info"}
                          className="text-[9px]"
                        >
                          {u.role}
                        </Badge>
                      </td>

                      <td className="py-3 px-3">
                        <Badge variant={u.isActive ? "success" : "danger"} className="text-[9px]">
                          {u.isActive ? "ACTIVE" : "DISABLED"}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-400">{u.ownedDocumentsCount}</td>

                      <td className="py-3 px-4 text-right">
                        <Button
                          variant={u.isActive ? "danger" : "secondary"}
                          size="sm"
                          isLoading={userActionLoading === u.id}
                          onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                          className="h-7 text-[11px] px-2.5"
                        >
                          {u.isActive ? (
                            <>
                              <UserX className="h-3 w-3 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Reactivate
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Security Alerts Column */}
        <div className="space-y-6">
          <Card>
            <CardTitle className="mb-3">Recent Security Events</CardTitle>
            {securityEvents.length === 0 ? (
              <p className="text-xs text-slate-500">No anomalous security events recorded</p>
            ) : (
              <div className="divide-y divide-slate-800 text-xs">
                {securityEvents.map((ev) => (
                  <div key={ev.id} className="py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={ev.outcome === "DENIED" ? "danger" : "warning"} className="text-[9px]">
                        {ev.action}
                      </Badge>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-300 font-medium truncate">
                      Actor: {ev.actor?.fullName || "Unauthenticated"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-slate-800 bg-slate-900/50">
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-200">Strict Administrative Boundary</p>
                <p className="leading-relaxed">
                  TrustVault enforces that administrators <strong>cannot automatically read or download</strong> confidential files.
                  Content access requires an explicit owner grant.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
