import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export default function Card({ children, className, padded = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-surface-border bg-surface shadow-card",
        padded && "p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
