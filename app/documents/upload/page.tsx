"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "../../../components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  ShieldCheck,
  Lock,
  ArrowLeft,
  X,
  FileText,
} from "lucide-react";
import Link from "next/link";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("FINANCIAL");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const allowedExtensions = [".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"];

  const handleFileChange = (selectedFile: File) => {
    setErrorMessage(null);
    const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      setErrorMessage(`File extension ${ext} is not allowed. Supported: ${allowedExtensions.join(", ")}`);
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMessage("File exceeds the 15 MB maximum size limit.");
      return;
    }

    setFile(selectedFile);
    if (!title) {
      // Auto-populate title from filename without extension
      const base = selectedFile.name.substring(0, selectedFile.name.lastIndexOf(".")) || selectedFile.name;
      setTitle(base.replace(/[-_]/g, " "));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Upload rejected by server security validation.");
      } else {
        setSuccessMessage("Document uploaded and cryptographically indexed into secure vault!");
        setTimeout(() => {
          router.push(`/documents/${data.document.id}`);
        }, 1200);
      }
    } catch {
      setErrorMessage("Network error occurred during document transmission.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Upload Confidential Document" subtitle="Server-side signature inspection, encryption, and audit trail generation">
      <div className="max-w-2xl mx-auto">
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300 mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Document Vault</span>
        </Link>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Vault Ingestion Gate</CardTitle>
              <CardDescription>
                Files are stored privately outside the web root with random opaque keys and SHA-256 verification.
              </CardDescription>
            </div>
          </CardHeader>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Drag & Drop File Zone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Confidential File
              </label>

              {!file ? (
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragActive
                      ? "border-teal-400 bg-teal-500/10"
                      : "border-slate-700/80 hover:border-slate-500 bg-slate-950/60"
                  }`}
                >
                  <UploadCloud className="h-10 w-10 text-teal-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-200">
                    Click to browse or drag & drop confidential file here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PDF, DOCX, XLSX, PNG, JPEG • Max 15 MB
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono mt-2 flex items-center justify-center gap-1">
                    <Lock className="h-3 w-3" /> Magic bytes cryptographic verification enforced on server
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                    onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{file.name}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {(file.size / 1024).toFixed(1)} KB • {file.type || "application/octet-stream"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Document Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Document Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Strategic Financial Audit Report"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Security Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all cursor-pointer"
              >
                <option value="FINANCIAL">Financial (Audits, Balance Sheets, Projections)</option>
                <option value="LEGAL">Legal (Contracts, M&A Agreements, IP)</option>
                <option value="COMPLIANCE">Compliance (SOC2, ISO 27001, HIPAA)</option>
                <option value="TECHNICAL">Technical (Architecture, Keys, Source Code)</option>
                <option value="INTERNAL">Internal (HR, Executive Strategy, Policies)</option>
                <option value="GENERAL">General Confidential Documents</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Description / Purpose
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional notes regarding the purpose or distribution scope of this document..."
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
              />
            </div>

            <Button type="submit" isLoading={loading} className="w-full" size="md">
              <UploadCloud className="h-4 w-4 mr-1.5" />
              Upload & Generate Audit Proof
            </Button>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
