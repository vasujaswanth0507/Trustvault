"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "../../components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { UserCheck, Shield, Key, LogOut, Lock, CheckCircle2 } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchMe();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <AppLayout title="Profile & Security Settings" subtitle="Server-managed session credentials and identity parameters">
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>User Identity</CardTitle>
              <CardDescription>Zero-trust organizational identity credentials</CardDescription>
            </div>
            {user && (
              <Badge
                variant={
                  user.role === "ADMINISTRATOR"
                    ? "danger"
                    : user.role === "OWNER"
                    ? "owner"
                    : "info"
                }
              >
                {user.role}
              </Badge>
            )}
          </CardHeader>

          {loading ? (
            <div className="py-8 text-center text-xs font-mono text-slate-500">Retrieving server session...</div>
          ) : user ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans mb-0.5">Full Name</span>
                  <span className="text-slate-100 font-sans text-sm font-semibold">{user.fullName}</span>
                </div>

                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans mb-0.5">Email Address</span>
                  <span className="text-slate-100">{user.email}</span>
                </div>

                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans mb-0.5">User UUID</span>
                  <span className="text-slate-300 select-all">{user.id}</span>
                </div>

                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans mb-0.5">Account Status</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5 font-sans">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active & Authorized
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        {/* Security & Password Card */}
        <Card>
          <CardTitle className="mb-2">Cryptographic Credentials</CardTitle>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Passwords in TrustVault are salted and hashed using Argon2id with 64MB memory cost, 3 time iterations, and 4
            parallel threads, in compliance with OWASP password storage guidelines.
          </p>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-400 font-mono space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-400" />
              <span className="font-semibold text-slate-200">Argon2id Memory Hardened</span>
            </div>
            <p className="text-[11px] text-slate-500 pl-6">
              Resistant to GPU and ASIC brute-force attacks.
            </p>
          </div>
        </Card>

        {/* Session Termination */}
        <Card className="border-red-900/30">
          <CardTitle className="text-red-400 mb-2">Session Invalidation</CardTitle>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Logging out deletes the server-side session token in PostgreSQL/SQLite immediately, clearing HTTP-only
            cookies and preventing any replay of subsequent requests.
          </p>

          <Button variant="danger" size="md" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1.5" />
            Terminate Current Session
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}
