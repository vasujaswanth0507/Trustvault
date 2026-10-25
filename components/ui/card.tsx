import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          "bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm transition-all",
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx("mb-4 flex items-center justify-between", className))} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={twMerge(clsx("text-base font-semibold text-slate-100 tracking-tight", className))} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={twMerge(clsx("text-xs text-slate-400 mt-0.5", className))} {...props}>
      {children}
    </p>
  );
}
