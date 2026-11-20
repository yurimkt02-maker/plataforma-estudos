import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, hint, className, disabled, ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          "w-full h-10 px-3 rounded-md bg-surface border text-sm text-foreground placeholder:text-subtle transition-colors duration-150",
          "border-border hover:border-border-strong focus:outline-none focus:border-brand focus:ring-2 focus:ring-[color:var(--focus-ring)]",
          "disabled:bg-disabled-bg disabled:text-disabled-text disabled:cursor-not-allowed",
          error && "border-semantic-error focus:border-semantic-error",
          className
        )}
        {...props}
      />
      {error ? (
        <p role="alert" className="text-xs text-semantic-error">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { id, label, error, hint, className, disabled, children, ...props },
    ref
  ) {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "w-full h-10 px-3 rounded-md bg-surface border text-sm text-foreground transition-colors duration-150",
            "border-border hover:border-border-strong focus:outline-none focus:border-brand focus:ring-2 focus:ring-[color:var(--focus-ring)]",
            "disabled:bg-disabled-bg disabled:text-disabled-text disabled:cursor-not-allowed",
            error && "border-semantic-error focus:border-semantic-error",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p role="alert" className="text-xs text-semantic-error">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);
