"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  ShieldCheck,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Search,
  Lock,
} from "lucide-react";

interface AuditEvent {
  id: string;
  sequenceNumber: number;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  correlationId: string | null;
  metadata: string | null;
  previousEventHash: string;
  currentEventHash: string;
  actor?: { id: string; fullName: string; email: string; role: string } | null;
}

export default function AuditTrailPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAuditEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        ...(actionFilter !== "ALL" ? { action: actionFilter } : {}),
        ...(outcomeFilter !== "ALL" ? { outcome: outcomeFilter } : {}),
      });

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, [page, actionFilter, outcomeFilter]);

  return (
    <AppLayout title="System Audit Log Explorer" subtitle="Cryptographically chained, immutable security event trail">
      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Admin Console</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <span className="text-slate-400">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN_SUCCESS">Login Success</option>
              <option value="LOGIN_FAILURE">Login Failure</option>
              <option value="DOCUMENT_UPLOAD">Document Upload</option>
              <option value="DOCUMENT_VIEW">Document View</option>
              <option value="DOCUMENT_DOWNLOAD">Document Download</option>
              <option value="PERMISSION_GRANT">Permission Grant</option>
              <option value="PERMISSION_REVOKE">Permission Revoke</option>
              <option value="ACCESS_DENIED">Access Denied</option>
              <option value="USER_STATUS_CHANGE">User Status Change</option>
              <option value="SECURITY_VALIDATION_FAILURE">Validation Failure</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <span className="text-slate-400">Outcome:</span>
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success Only</option>
              <option value="DENIED">Denied Only</option>
            </select>
          </div>

          <Button variant="secondary" size="sm" onClick={fetchAuditEvents}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Seq</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Event Hash (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 font-sans text-xs">
                    Querying Cryptographic Audit Records...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center font-sans">
                    <History className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">No audit events match your selected filters</p>
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-500">#{ev.sequenceNumber}</td>

                    <td className="py-3 px-4 text-slate-400">{new Date(ev.timestamp).toISOString()}</td>

                    <td className="py-3 px-4 font-sans">
                      {ev.actor ? (
                        <div>
                          <span className="font-semibold text-slate-200 block">{ev.actor.fullName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{ev.actor.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Anonymous</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-slate-200 font-semibold">{ev.action}</span>
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant={ev.outcome === "SUCCESS" ? "success" : "danger"} className="text-[9px]">
                        {ev.outcome}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      <span className="text-[10px] text-slate-500 block uppercase font-sans">{ev.resourceType}</span>
                      <span className="text-[11px] select-all truncate block max-w-[120px]" title={ev.resourceId || "None"}>
                        {ev.resourceId || "N/A"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-teal-400/90 select-all font-mono truncate max-w-[160px]" title={ev.currentEventHash}>
                      {ev.currentEventHash.substring(0, 16)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <span>
            Displaying {events.length} of {totalCount} total audit records
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}
