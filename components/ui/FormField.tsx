import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-ink">
          {label}
        </label>
        <input
          id={fieldId}
          ref={ref}
          aria-invalid={!!error}
          className={cn(
            "rounded-md border border-surface-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft",
            "focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/20",
            error && "border-brick-600 focus:border-brick-600 focus:ring-brick-600/20",
            className
          )}
          {...props}
        />
        {error ? (
          <span className="text-xs text-brick-700">{error}</span>
        ) : (
          hint && <span className="text-xs text-ink-soft">{hint}</span>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export default FormField;
