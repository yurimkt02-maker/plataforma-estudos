import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant =
  | "primary"
  | "gradient"
  | "secondary"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark border border-transparent shadow-subtle",
  gradient:
    "bg-brand-gradient text-white hover:opacity-95 border border-transparent shadow-card",
  secondary:
    "bg-surface text-foreground hover:bg-surface-subtle border border-border hover:border-border-strong",
  ghost:
    "bg-transparent text-muted hover:text-foreground hover:bg-surface-subtle border border-transparent",
  danger:
    "bg-semantic-error text-white hover:opacity-90 border border-transparent shadow-subtle",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    const isDisabled = Boolean(disabled || isLoading);

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-[background-color,border-color,color,opacity,transform] duration-150 active:scale-[0.99] select-none whitespace-nowrap",
          "disabled:bg-disabled-bg disabled:text-disabled-text disabled:border-border disabled:shadow-none disabled:pointer-events-none",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);
