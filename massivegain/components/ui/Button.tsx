import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brick-600 text-white hover:bg-brick-700 active:bg-brick-700 shadow-card",
  secondary:
    "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-800",
  outline:
    "border border-surface-border bg-transparent text-navy-900 hover:bg-surface-muted",
  ghost: "bg-transparent text-navy-900 hover:bg-surface-muted",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 rounded-sm",
  md: "text-sm px-4 py-2.5 rounded-md",
  lg: "text-base px-6 py-3 rounded-md",
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
