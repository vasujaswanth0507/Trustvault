"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  UploadCloud,
  LayoutDashboard,
  ShieldAlert,
  History,
  UserCheck,
  LogOut,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  } | null;
  onLogout?: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMINISTRATOR";

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Document Vault", href: "/documents", icon: FileText },
    { name: "Upload Document", href: "/documents/upload", icon: UploadCloud },
    ...(isAdmin
      ? [
          { name: "Admin Console", href: "/admin", icon: ShieldAlert },
          { name: "Audit Trail", href: "/admin/audit", icon: History },
        ]
      : []),
    { name: "Profile & Security", href: "/profile", icon: UserCheck },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:border-teal-400 transition-colors">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-100 tracking-tight block">
                Trust<span className="text-teal-400">Vault</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">
                Verifiable Vault
              </span>
            </div>
          </Link>
        </div>

        {/* User Mini Profile */}
        {user && (
          <div className="p-4 mx-3 my-3 bg-slate-900/70 border border-slate-800 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-200 truncate max-w-[130px]" title={user.fullName}>
                {user.fullName}
              </span>
              <Badge
                variant={
                  user.role === "ADMINISTRATOR"
                    ? "danger"
                    : user.role === "OWNER"
                    ? "owner"
                    : "info"
                }
                className="text-[10px] px-1.5 py-0"
              >
                {user.role}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate" title={user.email}>
              {user.email}
            </p>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/60"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-teal-400" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status & Logout */}
      <div className="p-3 border-t border-slate-800/80 space-y-3">
        <div className="bg-slate-900/60 border border-slate-800/70 rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
              Zero-Trust Protocol
            </span>
          </div>
          <p className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
            <Lock className="h-3 w-3 text-slate-500" />
            Deny-by-default active
          </p>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-colors border border-transparent hover:border-red-900/30"
          >
            <LogOut className="h-4 w-4" />
            <span>Terminate Session</span>
          </button>
        )}
      </div>
    </aside>
  );
}
