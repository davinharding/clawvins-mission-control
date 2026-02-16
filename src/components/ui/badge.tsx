import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline" | "success" | "warning" | "danger";
};

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-primary/15 text-primary border border-primary/30",
  outline: "border border-border/70 text-foreground/80",
  success: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40",
  warning: "bg-amber-500/15 text-amber-200 border border-amber-400/40",
  danger: "bg-rose-500/15 text-rose-200 border border-rose-400/40"
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
