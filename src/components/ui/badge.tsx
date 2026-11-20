import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "neutral" | "brand" | "success" | "warning" | "error";

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-surface-subtle text-muted border-border",
  brand: "bg-brand-tint text-brand-accent border-brand/25",
  success: "bg-semantic-success-bg text-semantic-success border-semantic-success/25",
  warning: "bg-semantic-warning-bg text-semantic-warning border-semantic-warning/30",
  error: "bg-semantic-error-bg text-semantic-error border-semantic-error/25",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border leading-tight",
        BADGE_VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
