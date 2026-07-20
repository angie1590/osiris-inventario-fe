import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DocumentLinesEditor,
  type DocumentLine,
  applyDiscount,
} from "@/features/inventory/DocumentLinesEditor";
import {
  EGRESO_DOCUMENT_TYPES,
  BAJA_REASON_LABELS,
  getDefaultEgresoDocumentType,
  getDefaultBajaReason,
  PURCHASE_DOCUMENT_TYPE_LABELS,
  isBajaReasonRequired,
  isEgresoNotesRequired,
} from "@/features/inventory/documentTypes";
import { useCreateEgreso } from "@/features/inventory/hooks";
import { useCompanyConfig } from "@/features/admin/hooks";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import type {
  BajaReason,
  CreateEgresoPayload,
  EgresoType,
  PurchaseDocumentType,
} from "@/types/api";

const ALL_EGRESO_TYPES: EgresoType[] = [
  "sale",
  "baja",
  "adjustment_negative",
  "supplier_return",
  "internal_consumption",
  "transfer_sent",
  "other",
];

const EGRESO_TYPE_LABELS: Record<EgresoType, string> = {
  sale: "Venta",
  baja: "Baja",
  adjustment_negative: "Ajuste negativo",
  supplier_return: "Devolución a proveedor",
  internal_consumption: "Consumo interno",
  transfer_sent: "Transferencia enviada",
  other: "Otro",
};

function FieldLabel({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <p className="text-sm font-semibold">
      {label}
      {required && (
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </p>
  );
}

const sortWithOtherLast = <T extends string>(
  items: T[],
  getLabel: (item: T) => string,
) =>
  [...items].sort((a, b) => {
    const aOther = a === "other";
    const bOther = b === "other";
    if (aOther && !bOther) return 1;
    if (!aOther && bOther) return -1;
    return getLabel(a).localeCompare(getLabel(b), "es-EC", {
      sensitivity: "base",
    });
  });

function getNowDateTimeLocalInput() {
  const now = new Date();
  now.setSeconds(0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function toIsoDateTime(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  if (!match) return undefined;
  const [yearStr, monthStr, dayStr, hourStr, minuteStr] = value.split(/[-T:]/);
  const y = Number(yearStr);
  const m = Number(monthStr);
  const d = Number(dayStr);
  const hh = Number(hourStr);
  const mm = Number(minuteStr);
  const year = y;
  const month = m;
  const day = d;
  const hour = hh;
  const minute = mm;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return undefined;
  }
  return date.toISOString();
}

const schema = z
  .object({
    egreso_type: z.enum([
      "sale",
      "baja",
      "adjustment_negative",
      "supplier_return",
      "internal_consumption",
      "transfer_sent",
      "other",
    ]),
    purchase_document_type: z.enum([
      "invoice",
      "sales_note",
      "liquidation_purchase",
      "receipt",
      "other",
      "inventory_act",
      "adjustment_act",
      "credit_note",
      "production_act",
      "transfer_note",
      "delivery_note",
      "disposal_act",
      "donation_act",
      "internal_consumption_act",
      "supplier_return",
      "transfer_act",
      "none",
    ]),
    purchase_document_number: z.string().optional(),
    purchase_document_date: z
      .string()
      .optional()
      .refine(
        (value) => !value || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
        "Fecha y hora inválida",
      ),
    reference: z.string().optional(),
    notes: z.string().optional(),
    baja_reason: z
      .enum([
        "damage",
        "expiration",
        "loss",
        "theft",
        "donation",
        "gift",
        "destruction",
        "sample",
        "other",
      ])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.egreso_type === "baja" && !data.baja_reason) {
      ctx.addIssue({
        code: "custom",
        path: ["baja_reason"],
        message: "Motivo de la baja es obligatorio",
      });
    }
  });
type FormData = z.infer<typeof schema>;

export default function EgresoNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateEgreso();
  const { data: company } = useCompanyConfig();
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const enabledEgresoTypes = company?.enabled_egreso_types?.length
    ? company.enabled_egreso_types
    : ALL_EGRESO_TYPES;
  const enabledBajaReasons: BajaReason[] = company?.enabled_baja_reasons?.length
    ? company.enabled_baja_reasons
    : [
        "damage",
        "expiration",
        "loss",
        "theft",
        "donation",
        "gift",
        "destruction",
        "sample",
        "other",
      ];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      egreso_type: "sale",
      purchase_document_type: "sales_note",
      purchase_document_date: getNowDateTimeLocalInput(),
      baja_reason: getDefaultBajaReason(),
    },
  });

  const egresoType = watch("egreso_type");
  const purchaseDocumentType = watch(
    "purchase_document_type",
  ) as PurchaseDocumentType;
  const sortedEgresoTypes = useMemo(
    () =>
      sortWithOtherLast(enabledEgresoTypes, (type) => EGRESO_TYPE_LABELS[type]),
    [enabledEgresoTypes],
  );
  const sortedBajaReasons = useMemo(
    () =>
      sortWithOtherLast(enabledBajaReasons, (type) => BAJA_REASON_LABELS[type]),
    [enabledBajaReasons],
  );
  const allowedDocumentTypes = useMemo(
    () =>
      sortWithOtherLast(
        [...EGRESO_DOCUMENT_TYPES[egresoType]],
        (type) => PURCHASE_DOCUMENT_TYPE_LABELS[type],
      ),
    [egresoType],
  );

  useEffect(() => {
    if (egresoType === "sale" && purchaseDocumentType !== "sales_note") {
      setValue("purchase_document_type", "sales_note", {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }
    if (allowedDocumentTypes.includes(purchaseDocumentType)) return;
    setValue(
      "purchase_document_type",
      getDefaultEgresoDocumentType(egresoType),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }, [allowedDocumentTypes, egresoType, purchaseDocumentType, setValue]);

  useEffect(() => {
    if (enabledEgresoTypes.includes(egresoType)) return;
    setValue("egreso_type", enabledEgresoTypes[0], { shouldDirty: true });
  }, [enabledEgresoTypes, egresoType, setValue]);

  useEffect(() => {
    if (egresoType !== "baja") {
      setValue("baja_reason", undefined, { shouldDirty: true });
      return;
    }
    const currentReason = watch("baja_reason");
    if (currentReason && enabledBajaReasons.includes(currentReason)) return;
    setValue("baja_reason", getDefaultBajaReason(), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [egresoType, enabledBajaReasons, setValue, watch]);

  const isOtherDocument = isEgresoNotesRequired(purchaseDocumentType);
  const purchaseDocumentDisabled = purchaseDocumentType === "none";

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    if (lines.length === 0) {
      setFormError("Agrega al menos una línea al documento");
      return;
    }
    const invalidLine = lines.find(
      (l) => !l.product_id || !l.quantity || Number(l.quantity) <= 0,
    );
    if (invalidLine) {
      setFormError("Completa todos los campos de los ítems");
      return;
    }

    if (
      isEgresoNotesRequired(data.purchase_document_type) &&
      !data.notes?.trim()
    ) {
      setFormError("Observaciones es obligatorio cuando el documento es Otro");
      return;
    }

    const parsedPurchaseDocumentDate =
      data.purchase_document_type !== "none"
        ? toIsoDateTime(data.purchase_document_date)
        : undefined;

    if (
      data.purchase_document_type !== "none" &&
      data.purchase_document_date &&
      !parsedPurchaseDocumentDate
    ) {
      setFormError("Fecha y hora del documento inválida");
      return;
    }

    try {
      const payload: CreateEgresoPayload = {
        egreso_type: data.egreso_type,
        purchase_document_type: data.purchase_document_type,
        baja_reason: data.egreso_type === "baja" ? data.baja_reason : undefined,
        purchase_document_number:
          data.purchase_document_type !== "none"
            ? data.purchase_document_number || undefined
            : undefined,
        purchase_document_date: parsedPurchaseDocumentDate,
        reference: data.reference || undefined,
        notes: data.notes || undefined,
        lines: lines.map((l) => {
          const pvp = l.product_pvp ?? Number(l.unit_price ?? 0);
          const quantity = Number(l.quantity || 0);
          const subtotal = quantity * pvp;
          const rawDiscount = String(l.discount_value ?? "").trim();
          const normalizedDiscount = rawDiscount.replace(",", ".");
          const parsedDiscount = Number(normalizedDiscount);
          const hasDiscount =
            rawDiscount !== "" &&
            Number.isFinite(parsedDiscount) &&
            parsedDiscount > 0;
          const finalLineTotal =
            hasDiscount && subtotal > 0
              ? applyDiscount(
                  subtotal,
                  l.discount_type ?? "percent",
                  normalizedDiscount,
                )
              : subtotal;
          return {
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price:
              quantity > 0 && finalLineTotal > 0
                ? String(finalLineTotal / quantity)
                : undefined,
            unit_price_base: pvp > 0 ? String(pvp) : undefined,
            discount_type: hasDiscount
              ? (l.discount_type ?? "percent")
              : undefined,
            discount_value: hasDiscount ? String(parsedDiscount) : undefined,
          };
        }),
      };

      const doc = await create.mutateAsync(payload);
      toast({
        variant: "success",
        title: "Egreso creado",
        description: `Egreso ${doc.number} creado correctamente.`,
      });
      navigate(`/inventory/egresos/${doc.id}`);
    } catch (err: unknown) {
      setFormError(
        getApiErrorMessage(err, "Error al crear el egreso", {
          EGRESO_TYPE_DISABLED:
            "El tipo de egreso no está habilitado para la empresa",
          INVALID_PURCHASE_DOCUMENT_TYPE:
            "El tipo de documento no corresponde al tipo de egreso",
          BAJA_REASON_REQUIRED: "Motivo de la baja es obligatorio",
          BAJA_REASON_DISABLED:
            "El motivo de la baja no está habilitado para la empresa",
          NOTES_REQUIRED_FOR_OTHER_DOCUMENT:
            "Observaciones es obligatorio cuando el documento es Otro",
          INSUFFICIENT_STOCK: "Stock insuficiente en uno de los productos",
          PRODUCT_NOT_FOUND: "Uno de los productos no fue encontrado",
          DOCUMENT_REQUIRES_LINES: "Agrega al menos una línea al documento",
        }),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo Egreso"
        actions={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Section title="Cabecera">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel label="Tipo de egreso" required />
              <Select
                value={watch("egreso_type")}
                onValueChange={(v) => {
                  setValue("egreso_type", v as EgresoType, {
                    shouldDirty: true,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedEgresoTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {EGRESO_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isBajaReasonRequired(egresoType) && (
              <div className="space-y-1.5">
                <FieldLabel label="Motivo de la baja" required />
                <Select
                  value={watch("baja_reason") ?? ""}
                  onValueChange={(v) => {
                    setValue("baja_reason", v as FormData["baja_reason"], {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedBajaReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {BAJA_REASON_LABELS[reason]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <FieldLabel
                label="Tipo de documento"
                required={purchaseDocumentType !== "none"}
              />
              <Select
                value={watch("purchase_document_type")}
                onValueChange={(v) => {
                  setValue(
                    "purchase_document_type",
                    v as PurchaseDocumentType,
                    {
                      shouldDirty: true,
                    },
                  );
                }}
                disabled={allowedDocumentTypes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedDocumentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PURCHASE_DOCUMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FormField label="Número de documento">
              <Input
                {...register("purchase_document_number")}
                disabled={purchaseDocumentDisabled}
                placeholder="Ej: 001-002-00012345"
              />
            </FormField>

            <FormField label="Fecha y hora del documento">
              <Input
                type="datetime-local"
                {...register("purchase_document_date")}
                disabled={purchaseDocumentDisabled}
                className="h-10 text-sm"
              />
            </FormField>

            <FormField label="Referencia">
              <Input
                {...register("reference")}
                placeholder="Ej: Orden de despacho 001"
              />
            </FormField>

            <FormField
              label="Observaciones"
              required={isOtherDocument}
              className="sm:col-span-2"
            >
              <Input
                {...register("notes")}
                placeholder="Observaciones (opcional)"
              />
            </FormField>
          </div>
        </Section>

        <Section title="Ítems">
          <DocumentLinesEditor
            lines={lines}
            onChange={setLines}
            defaultDiscountType="fixed"
            showUnitPrice
            showSubtotal
            showDiscount
            showTotals
            prioritizeInStock
            enforceStockLimit
            autoFillUnitPriceFromProduct
          />
        </Section>

        <div className="flex gap-2">
          <Button type="submit" isLoading={isSubmitting}>
            Guardar egreso
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
