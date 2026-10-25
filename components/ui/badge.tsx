import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "owner";
}

export function Badge({ className, variant = "neutral", children, ...props }: BadgeProps) {
  const styles = {
    success: "bg-emerald-950/80 text-emerald-400 border-emerald-800/60",
    warning: "bg-amber-950/80 text-amber-300 border-amber-800/60",
    danger: "bg-red-950/80 text-red-400 border-red-800/60",
    info: "bg-blue-950/80 text-blue-300 border-blue-800/60",
    neutral: "bg-slate-800/80 text-slate-300 border-slate-700/60",
    owner: "bg-teal-950/80 text-teal-300 border-teal-800/60 font-semibold",
  };

  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide",
          styles[variant],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
}
