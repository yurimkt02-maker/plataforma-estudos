import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type CardVariant = "default" | "subtle" | "interactive" | "brand-hero";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: "bg-surface border border-border shadow-card",
  subtle: "bg-surface-subtle border border-border",
  interactive:
    "bg-surface border border-border shadow-subtle hover:border-border-strong transition-colors duration-150",
  "brand-hero":
    "bg-brand-gradient text-white border border-white/10 shadow-elevated",
};

export function Card({
  variant = "default",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn("rounded-lg", CARD_VARIANTS[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-5 py-4 border-b border-border/80", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-sm font-semibold tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-muted mt-0.5", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
