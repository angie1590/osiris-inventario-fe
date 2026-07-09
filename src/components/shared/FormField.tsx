import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactElement<
    React.InputHTMLAttributes<HTMLElement> & {
      id?: string;
      "aria-invalid"?: boolean;
      "aria-describedby"?: string;
    }
  >;
  className?: string;
}

export function FormField({
  label,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  const generatedId = React.useId();
  const inputId = children.props.id ?? generatedId;
  const descId = `${inputId}-desc`;

  const child = React.cloneElement(children, {
    id: inputId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hint ? descId : undefined,
  });

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label
        htmlFor={inputId}
        className="text-sm font-semibold text-foreground"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {child}
      {(error || hint) && (
        <p
          id={descId}
          className={cn(
            "text-xs",
            error ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
