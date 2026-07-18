import * as React from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "./ErrorState";
import { cn } from "@/lib/utils";

export interface DetailField {
  label: string;
  value: React.ReactNode;
  /** Span the full width instead of one grid column. */
  full?: boolean;
  /** Keep label + value on one line; value can scroll horizontally if needed. */
  oneLine?: boolean;
}

export interface DetailSection {
  title?: string;
  fields?: DetailField[];
  /** Custom content for the section (e.g. a lines table). Renders after fields. */
  content?: React.ReactNode;
}

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  sections?: DetailSection[];
  children?: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
} as const;

function FieldRow({ field }: { field: DetailField }) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-x-2 gap-y-1",
        field.oneLine ? "flex-nowrap" : "flex-wrap",
        field.full && "sm:col-span-2",
      )}
    >
      <p className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {field.label}
      </p>
      <div
        className={cn("min-w-0 text-sm", field.oneLine && "whitespace-nowrap")}
      >
        {field.value ?? "—"}
      </div>
    </div>
  );
}

export function DetailModal({
  open,
  onClose,
  title,
  subtitle,
  sections,
  children,
  loading,
  error,
  onRetry,
  footer,
  size = "md",
}: DetailModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className={SIZE_CLASS[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <DialogBody className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              className="py-8"
              message="No se pudo cargar el detalle."
              onRetry={onRetry}
            />
          ) : (
            <>
              {sections?.map((section, i) => (
                <section key={section.title ?? i} className="space-y-3">
                  {section.title && (
                    <h3 className="text-sm font-semibold text-foreground">
                      {section.title}
                    </h3>
                  )}
                  {section.fields && section.fields.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {section.fields.map((field) => (
                        <FieldRow key={field.label} field={field} />
                      ))}
                    </div>
                  )}
                  {section.content}
                </section>
              ))}
              {children}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {footer ?? (
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
