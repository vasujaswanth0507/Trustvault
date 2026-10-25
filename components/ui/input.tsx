import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <div className="w-full">
      <input
        ref={ref}
        className={twMerge(
          clsx(
            "w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all disabled:opacity-50",
            error && "border-red-500 focus:ring-red-500",
            className
          )
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400 mt-1 font-medium">{error}</p>}
    </div>
  );
});
Input.displayName = "Input";
