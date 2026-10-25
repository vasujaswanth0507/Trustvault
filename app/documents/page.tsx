"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Search,
  Filter,
  Download,
  Share2,
  Trash2,
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface DocumentItem {
  id: string;
  title: string;
  originalFilename: string;
  category: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  isOwner: boolean;
  permissionLevel: "OWNER" | "READ" | "EDIT";
  owner: { id: string; fullName: string; email: string };
  createdAt: string;
}

export default function DocumentLibraryPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        search,
        ...(category !== "ALL" ? { category } : {}),
      });

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } catch {
      // Handled via empty/error state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [page, category]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  const getFileIcon = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-400" />;
    if (lower.endsWith(".docx") || lower.endsWith(".doc")) return <FileText className="h-4 w-4 text-blue-400" />;
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return <FileSpreadsheet className="h-4 w-4 text-emerald-400" />;
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
      return <ImageIcon className="h-4 w-4 text-purple-400" />;
    return <FileCode className="h-4 w-4 text-slate-400" />;
  };

  return (
    <AppLayout title="Document Vault" subtitle="Strictly authorized confidential enterprise document library">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-96">
          <div className="relative w-full">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or filename..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="FINANCIAL">Financial</option>
              <option value="LEGAL">Legal</option>
              <option value="COMPLIANCE">Compliance</option>
              <option value="TECHNICAL">Technical</option>
              <option value="INTERNAL">Internal</option>
              <option value="GENERAL">General</option>
            </select>
          </div>

          <Link href="/documents/upload">
            <Button size="md" variant="primary">
              <UploadCloud className="h-4 w-4 mr-1.5" />
              Upload Document
            </Button>
          </Link>
        </div>
      </div>

      {/* Documents Table Card */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-5">Document</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Your Access</th>
                <th className="py-3 px-4">Uploaded</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 font-mono text-xs">
                    Executing Server-Side Authorization Query...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <FileText className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">No authorized documents match your query</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Zero-trust prevents discovery of documents without explicit ownership or grants.
                    </p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0">
                          {getFileIcon(doc.originalFilename)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="font-semibold text-slate-100 hover:text-teal-300 truncate block transition-colors"
                          >
                            {doc.title}
                          </Link>
                          <span className="text-xs text-slate-500 font-mono block truncate">
                            {doc.originalFilename} • {Math.round(doc.fileSize / 1024)} KB
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="neutral" className="text-[10px]">
                        {doc.category}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-mono text-slate-400 truncate max-w-[150px]">
                      {doc.isOwner ? (
                        <span className="text-teal-400 font-semibold">You (Owner)</span>
                      ) : (
                        doc.owner.fullName
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={doc.isOwner ? "owner" : doc.permissionLevel === "EDIT" ? "warning" : "info"}
                        className="text-[10px]"
                      >
                        {doc.isOwner ? "FULL OWNER" : doc.permissionLevel}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          download
                          title="Download Authorized Bytes"
                          className="p-1.5 text-slate-400 hover:text-teal-300 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Download className="h-4 w-4" />
                        </a>

                        <Link
                          href={`/documents/${doc.id}`}
                          title="View Details & Audit Timeline"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <span>
            Showing {documents.length} of {totalCount} authorized records
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
