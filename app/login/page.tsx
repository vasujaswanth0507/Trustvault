"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, ArrowRight, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const demoAccounts = [
    { label: "Admin", email: "admin@example.test", role: "ADMINISTRATOR", desc: "Audit & User Management" },
    { label: "Owner A", email: "owner-a@example.test", role: "OWNER", desc: "Finance & Compliance Docs" },
    { label: "Owner B", email: "owner-b@example.test", role: "OWNER", desc: "Operations & Key Inventory" },
    { label: "Viewer A", email: "viewer-a@example.test", role: "VIEWER", desc: "Internal Auditor" },
    { label: "Viewer B", email: "viewer-b@example.test", role: "VIEWER", desc: "External Auditor" },
    { label: "Deactivated", email: "deactivated-user@example.test", role: "DISABLED", desc: "Deactivated Account Test" },
  ];

  const handleSelectDemo = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setPassword("Password123!");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Authentication failed. Please check your credentials.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 mb-4 shadow-xl">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Trust<span className="text-teal-400">Vault</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono tracking-wide">
            Secure Document Platform • Verifiable Audit Trails
          </p>
        </div>

        {/* Authentication Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-100">Sign in to your Vault</h2>
            <p className="text-xs text-slate-400 mt-0.5">Zero-trust authentication enforced server-side</p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Organizational Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Master Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" isLoading={loading} className="w-full mt-2" size="md">
              <span>Authenticate & Enter Vault</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </form>

          {/* Quick-Fill Demo Evaluator Selector */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-teal-400" />
                Demo Credentials
              </span>
              <span className="text-[10px] text-slate-500 font-mono">1-Click Auto-Fill</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectDemo(acc.email)}
                  className="text-left p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-800/60 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-teal-300">
                      {acc.label}
                    </span>
                    <span
                      className={`text-[9px] px-1 rounded ${
                        acc.role === "ADMINISTRATOR"
                          ? "bg-red-950 text-red-300"
                          : acc.role === "OWNER"
                          ? "bg-teal-950 text-teal-300"
                          : acc.role === "DISABLED"
                          ? "bg-slate-800 text-slate-400"
                          : "bg-blue-950 text-blue-300"
                      }`}
                    >
                      {acc.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{acc.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-[11px] text-slate-500 mt-6 flex items-center justify-center gap-1.5 font-mono">
          <Lock className="h-3.5 w-3.5 text-slate-500" />
          Server-side session validation & Argon2id hashing active
        </p>
      </div>
    </div>
  );
}
