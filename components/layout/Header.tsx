"use client";

import { ShieldCheck, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title: string;
  subtitle?: string;
  user?: {
    fullName: string;
    role: string;
  } | null;
}

export function Header({ title, subtitle, user }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-bold text-slate-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
          <Lock className="h-3.5 w-3.5 text-teal-400" />
          <span>Server-Enforced Auth</span>
        </div>

        {user && (
          <Badge
            variant={user.role === "ADMINISTRATOR" ? "danger" : user.role === "OWNER" ? "owner" : "info"}
            className="text-xs"
          >
            {user.role}
          </Badge>
        )}
      </div>
    </header>
  );
}
