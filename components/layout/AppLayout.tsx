"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppLayout({ children, title = "Vault Overview", subtitle }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{
    id: string;
    email: string;
    fullName: string;
    role: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          if (pathname !== "/login") {
            router.push("/login");
          }
        }
      } catch {
        if (pathname !== "/login") {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="h-10 w-10 border-4 border-teal-500/20 border-t-teal-400 rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-mono tracking-wide">Validating Server-Side Credentials...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar user={user} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} subtitle={subtitle} user={user} />
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
