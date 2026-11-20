import { cn } from "@/lib/utils/cn";

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: "sm" | "md";
  tone?: "brand" | "success" | "warning" | "error";
  className?: string;
}

const TONE_FILL: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  brand: "bg-brand-gradient",
  success: "bg-semantic-success",
  warning: "bg-semantic-warning",
  error: "bg-semantic-error",
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  size = "sm",
  tone = "brand",
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.max(0, Math.min(safeMax, value));
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {label ? (
            <span className="font-medium text-foreground truncate">{label}</span>
          ) : (
            <span />
          )}
          {showPercentage && (
            <span className="text-muted font-medium tabular-nums-strict shrink-0">
              {percent}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label || "Progresso"}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className={cn(
          "w-full rounded-full bg-surface-subtle overflow-hidden",
          size === "sm" ? "h-1.5" : "h-2.5"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-out",
            TONE_FILL[tone]
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
