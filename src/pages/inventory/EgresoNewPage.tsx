import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
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
  ADJUSTMENT_REASON_LABELS,
  getDefaultEgresoDocumentType,
  getDefaultBajaReason,
  getDefaultAdjustmentReason,
  PURCHASE_DOCUMENT_TYPE_LABELS,
  isCommercialEgresoType,
  isInventoryEgresoType,
  isBajaReasonRequired,
  isAdjustmentReasonRequired,
  isEgresoNotesRequired,
} from "@/features/inventory/documentTypes";
import { useCreateEgreso } from "@/features/inventory/hooks";
import { useCreateCustomer, useCustomers } from "@/features/inventory/hooks";
import { useCompanyConfig } from "@/features/admin/hooks";
import { useFitsScreen } from "@/hooks/use-fits-screen";
import { useSaleProductCodeDisplay } from "@/hooks/useStockMode";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  ID_TYPE_LABEL,
  getIdentificationError,
  identificationMaxLength,
  normalizeIdentificationInput,
} from "@/lib/identification";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import type {
  BajaReason,
  AdjustmentReason,
  CreateEgresoPayload,
  EgresoType,
  InventoryCustomer,
  InventoryDocument,
  PurchaseDocumentType,
  KardexResponse,
  SupplierIdentificationType,
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

const ADJUSTMENT_REASON_OPTIONS: AdjustmentReason[] = [
  "physical_count",
  "record_error",
  "administrative_correction",
  "other",
];

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
    seller_name: z.string().optional(),
    payment_method: z.string().optional(),
    bank_name: z.string().optional(),
    amount_received: z.string().optional(),
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
    adjustment_reason: z
      .enum([
        "physical_count",
        "record_error",
        "administrative_correction",
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
    if (data.egreso_type === "adjustment_negative" && !data.adjustment_reason) {
      ctx.addIssue({
        code: "custom",
        path: ["adjustment_reason"],
        message: "Motivo del ajuste es obligatorio",
      });
    }
  });
type FormData = z.infer<typeof schema>;

const EMPTY_CUSTOMER = {
  identification_type: "cedula" as SupplierIdentificationType,
  identification_number: "",
  name: "",
  phone: "",
  address: "",
};

const customerNotes = (customer: InventoryCustomer) =>
  `Nombre: ${customer.name} | RUC: ${customer.identification_number} | Teléfono: ${customer.phone ?? ""} | Dirección: ${customer.address ?? ""}`;

export default function EgresoNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const saleOnly = user?.role === "operator";
  const create = useCreateEgreso();
  const { data: company } = useCompanyConfig();
  const saleProductCodeDisplay = useSaleProductCodeDisplay();
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [headerOpen, setHeaderOpen] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(true);
  const autoCollapsedRef = useRef(false);
  const fitsScreen = useFitsScreen();
  const [consumerFinal, setConsumerFinal] = useState(true);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerMode, setCustomerMode] = useState<"select" | "create">(
    "select",
  );
  const { data: customers } = useCustomers(true);
  const createCustomer = useCreateCustomer();
  const [createdDocument, setCreatedDocument] =
    useState<InventoryDocument | null>(null);
  const costSyncRef = useRef(0);
  const enabledEgresoTypes = saleOnly
    ? (["sale"] as EgresoType[])
    : company?.enabled_egreso_types?.length
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
  const enabledAdjustmentReasons: AdjustmentReason[] =
    ADJUSTMENT_REASON_OPTIONS;
  const enabledSellers = company?.sellers?.length ? company.sellers : [];
  const activePaymentMethods = useMemo(
    () =>
      (
        company?.payment_methods ?? [
          { name: "EFECTIVO", active: true, default: true },
          {
            name: "TRANSFERENCIA",
            active: true,
            default: false,
            requires_bank: true,
          },
        ]
      ).filter((item) => item.active),
    [company?.payment_methods],
  );
  const activeBanks = useMemo(
    () => (company?.banks ?? []).filter((item) => item.active),
    [company?.banks],
  );

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
      seller_name: undefined,
      payment_method: "EFECTIVO",
      bank_name: undefined,
      amount_received: "",
      purchase_document_date: getNowDateTimeLocalInput(),
      baja_reason: getDefaultBajaReason(),
      adjustment_reason: getDefaultAdjustmentReason(),
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
  const sortedAdjustmentReasons = useMemo(
    () =>
      sortWithOtherLast(
        enabledAdjustmentReasons,
        (type) => ADJUSTMENT_REASON_LABELS[type],
      ),
    [enabledAdjustmentReasons],
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
    if (egresoType !== "sale") {
      setValue("seller_name", undefined, { shouldDirty: true });
      setConsumerFinal(true);
      setCustomer(EMPTY_CUSTOMER);
      setCustomerId(null);
      setCustomerMode("select");
      setCustomerDialogOpen(false);
      return;
    }
    const currentSeller = watch("seller_name");
    if (currentSeller && enabledSellers.includes(currentSeller)) return;
    setValue("seller_name", enabledSellers[0] ?? undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [egresoType, enabledSellers, setValue, watch]);

  useEffect(() => {
    if (egresoType !== "sale") return;
    const current = watch("payment_method");
    if (current && activePaymentMethods.some((item) => item.name === current))
      return;
    setValue(
      "payment_method",
      activePaymentMethods.find((item) => item.default)?.name ??
        activePaymentMethods[0]?.name ??
        "EFECTIVO",
      { shouldDirty: true, shouldValidate: true },
    );
  }, [activePaymentMethods, egresoType, setValue, watch]);

  const paymentMethod = watch("payment_method") || "EFECTIVO";
  const selectedPaymentMethod = activePaymentMethods.find(
    (item) => item.name === paymentMethod,
  );
  const paymentRequiresBank =
    selectedPaymentMethod?.requires_bank === true ||
    paymentMethod === "TRANSFERENCIA";
  useEffect(() => {
    if (!paymentRequiresBank) {
      setValue("bank_name", undefined, { shouldDirty: true });
      return;
    }
    setValue("amount_received", "", { shouldDirty: true });
    const current = watch("bank_name");
    if (current && activeBanks.some((item) => item.name === current)) return;
    setValue("bank_name", activeBanks[0]?.name, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [activeBanks, paymentRequiresBank, setValue, watch]);

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

  useEffect(() => {
    if (egresoType !== "adjustment_negative") {
      setValue("adjustment_reason", undefined, { shouldDirty: true });
      return;
    }
    const currentReason = watch("adjustment_reason");
    if (currentReason && enabledAdjustmentReasons.includes(currentReason))
      return;
    setValue("adjustment_reason", getDefaultAdjustmentReason(), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [egresoType, enabledAdjustmentReasons, setValue, watch]);

  const isCommercialEgreso = isCommercialEgresoType(egresoType);
  const isInventoryEgreso = isInventoryEgresoType(egresoType);
  const saleTotal = useMemo(
    () =>
      lines.reduce((total, line) => {
        const quantity = Number(line.quantity || 0);
        const price = Number(line.product_pvp ?? line.unit_price ?? 0);
        if (!Number.isFinite(quantity) || !Number.isFinite(price)) return total;
        const subtotal = quantity * price;
        return (
          total +
          (isCommercialEgreso
            ? applyDiscount(
                subtotal,
                line.discount_type ?? "fixed",
                line.discount_value ?? "",
              )
            : Number(line.unit_cost || 0) * quantity)
        );
      }, 0),
    [isCommercialEgreso, lines],
  );
  const receivedValue = Number(watch("amount_received") || saleTotal);
  const changeValue = Math.max(0, receivedValue - saleTotal);
  const missingValue = Math.max(0, saleTotal - receivedValue);

  useEffect(() => {
    if (!isInventoryEgreso || lines.length === 0) return;
    const productIds = Array.from(
      new Set(lines.map((line) => line.product_id).filter((id) => id > 0)),
    );
    if (productIds.length === 0) return;

    const runId = ++costSyncRef.current;
    const syncCosts = async () => {
      const kardexPairs = await Promise.all(
        productIds.map(async (productId) => {
          const res = await api.get<KardexResponse>(`/kardex/${productId}`);
          return [productId, res.data] as const;
        }),
      );
      if (costSyncRef.current !== runId) return;

      const kardexMap = new Map(kardexPairs);
      const pepsLotsByProduct = new Map<
        number,
        Array<{
          lotId: number;
          available: number;
          unitCost: number;
          createdAt: string;
        }>
      >();

      const buildPepsLots = (kardex: KardexResponse) => {
        const map = new Map<
          number,
          {
            lotId: number;
            available: number;
            unitCost: number;
            createdAt: string;
          }
        >();
        for (const entry of kardex.entries) {
          if (!entry.lot_id) continue;
          const existing = map.get(entry.lot_id) ?? {
            lotId: entry.lot_id,
            available: 0,
            unitCost: Number(entry.cost_in || entry.cost_out || 0),
            createdAt: entry.created_at,
          };
          existing.available += Number(entry.quantity_in || 0);
          existing.available -= Number(entry.quantity_out || 0);
          if (Number(entry.cost_in || 0) > 0) {
            existing.unitCost = Number(entry.cost_in);
          }
          map.set(entry.lot_id, existing);
        }
        return Array.from(map.values())
          .filter((lot) => lot.available > 0)
          .sort((a, b) => {
            if (a.createdAt === b.createdAt) return a.lotId - b.lotId;
            return a.createdAt.localeCompare(b.createdAt);
          });
      };

      const nextLines = lines.map((line) => {
        if (!line.product_id || Number(line.quantity || 0) <= 0) return line;
        const kardex = kardexMap.get(line.product_id);
        if (!kardex) return line;

        let nextCost = 0;
        if (String(kardex.method).toUpperCase() === "PEPS") {
          const lots =
            pepsLotsByProduct.get(line.product_id) ?? buildPepsLots(kardex);
          pepsLotsByProduct.set(line.product_id, lots);
          let remaining = Number(line.quantity || 0);
          let consumedValue = 0;
          for (const lot of lots) {
            if (remaining <= 0) break;
            if (lot.available <= 0) continue;
            const consumed = Math.min(lot.available, remaining);
            consumedValue += consumed * lot.unitCost;
            lot.available -= consumed;
            remaining -= consumed;
          }
          nextCost =
            Number(line.quantity || 0) > 0
              ? consumedValue / Number(line.quantity || 1)
              : 0;
        } else {
          nextCost = Number(kardex.weighted_avg_cost || 0);
        }

        const normalized = Number.isFinite(nextCost) ? nextCost : 0;
        return {
          ...line,
          unit_cost: normalized.toFixed(4),
        };
      });

      const changed = nextLines.some(
        (line, index) =>
          (line.unit_cost ?? "") !== (lines[index]?.unit_cost ?? ""),
      );
      if (changed) {
        setLines(nextLines);
      }
    };

    syncCosts().catch(() => undefined);
  }, [isInventoryEgreso, lines]);

  const isOtherDocument = isEgresoNotesRequired(purchaseDocumentType);
  const purchaseDocumentDisabled = purchaseDocumentType === "none";
  const isPurchaseDocumentNumberRequired =
    egresoType === "sale" && purchaseDocumentType !== "none";

  useEffect(() => {
    if (lines.length === 0 || autoCollapsedRef.current) return;
    autoCollapsedRef.current = true;
    setHeaderOpen(false);
  }, [lines.length]);

  useEffect(() => {
    if (formError) {
      setHeaderOpen(true);
      setPaymentOpen(false);
    }
  }, [formError]);

  const headerSummary = [
    EGRESO_TYPE_LABELS[egresoType],
    egresoType === "sale" ? watch("seller_name") : null,
    isBajaReasonRequired(egresoType) && watch("baja_reason")
      ? BAJA_REASON_LABELS[watch("baja_reason") as BajaReason]
      : null,
    isAdjustmentReasonRequired(egresoType) && watch("adjustment_reason")
      ? ADJUSTMENT_REASON_LABELS[watch("adjustment_reason") as AdjustmentReason]
      : null,
    PURCHASE_DOCUMENT_TYPE_LABELS[purchaseDocumentType],
    watch("purchase_document_number"),
  ]
    .filter(Boolean)
    .join(" · ");

  const applyCustomer = (selected: InventoryCustomer) => {
    setCustomerId(selected.id);
    setValue("notes", customerNotes(selected), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setConsumerFinal(false);
    setCustomerError(null);
    setCustomerDialogOpen(false);
  };

  const acceptCustomer = async () => {
    if (customerMode === "select") {
      const selected = (customers ?? []).find((c) => c.id === customerId);
      if (!selected) {
        setCustomerError("Selecciona un cliente");
        return;
      }
      applyCustomer(selected);
      return;
    }

    const identificationError = getIdentificationError(
      customer.identification_type,
      customer.identification_number.trim(),
    );
    if (identificationError) {
      setCustomerError(identificationError);
      return;
    }
    if (!customer.name.trim()) {
      setCustomerError("Nombre es obligatorio");
      return;
    }
    try {
      const created = await createCustomer.mutateAsync({
        identification_type: customer.identification_type,
        identification_number: customer.identification_number
          .trim()
          .toUpperCase(),
        name: customer.name.trim().toUpperCase(),
        address: customer.address.trim().toUpperCase() || null,
        phone: customer.phone.trim() || null,
      });
      setCustomer(EMPTY_CUSTOMER);
      setCustomerMode("select");
      applyCustomer(created);
    } catch (err: unknown) {
      setCustomerError(
        getApiErrorMessage(err, "No se pudo guardar el cliente.", {
          CUSTOMER_IDENTIFICATION_EXISTS:
            "La identificación ya está registrada.",
        }),
      );
    }
  };

  const selectConsumerFinal = () => {
    setConsumerFinal(true);
    setCustomer(EMPTY_CUSTOMER);
    setCustomerId(null);
    setCustomerMode("select");
    setCustomerError(null);
    setValue("notes", "", { shouldDirty: true, shouldValidate: true });
  };

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
      data.egreso_type === "sale" &&
      data.purchase_document_type === "sales_note" &&
      lines.length > 9
    ) {
      setFormError("La Nota de Venta admite máximo 9 productos");
      return;
    }

    if (
      isEgresoNotesRequired(data.purchase_document_type) &&
      !data.notes?.trim()
    ) {
      setFormError("Observaciones es obligatorio cuando el documento es Otro");
      return;
    }

    const normalizedPurchaseDocumentNumber =
      data.purchase_document_number?.trim() || "";
    const normalizedSellerName = data.seller_name?.trim() || "";
    const isSaleWithoutDocument =
      data.egreso_type === "sale" && data.purchase_document_type === "none";
    if (data.egreso_type === "sale" && !normalizedSellerName) {
      setFormError("Vendedor es obligatorio para ventas");
      return;
    }
    if (
      data.egreso_type === "sale" &&
      data.purchase_document_type !== "none" &&
      !normalizedPurchaseDocumentNumber
    ) {
      setFormError("Número de documento es obligatorio para ventas");
      return;
    }
    if (data.egreso_type === "sale") {
      const received = Number(data.amount_received || saleTotal);
      if (!Number.isFinite(received) || received < 0) {
        setFormError("Valor recibido inválido");
        return;
      }
      if (received < saleTotal) {
        setFormError(
          `El valor recibido es menor al total de la factura. Faltante: ${(saleTotal - received).toFixed(2)}`,
        );
        return;
      }
      if (paymentRequiresBank && !data.bank_name) {
        setFormError("Banco es obligatorio para transferencias");
        return;
      }
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
        customer_id:
          data.egreso_type === "sale" && !consumerFinal && customerId
            ? customerId
            : undefined,
        purchase_document_type: data.purchase_document_type,
        baja_reason: data.egreso_type === "baja" ? data.baja_reason : undefined,
        adjustment_reason:
          data.egreso_type === "adjustment_negative"
            ? data.adjustment_reason
            : undefined,
        purchase_document_number: isSaleWithoutDocument
          ? "Venta sin documento"
          : data.purchase_document_type !== "none"
            ? normalizedPurchaseDocumentNumber || undefined
            : undefined,
        seller_name:
          data.egreso_type === "sale" ? normalizedSellerName : undefined,
        payment_method:
          data.egreso_type === "sale" ? data.payment_method : undefined,
        bank_name: data.egreso_type === "sale" ? data.bank_name : undefined,
        amount_received:
          data.egreso_type === "sale" && !paymentRequiresBank
            ? data.amount_received || String(saleTotal)
            : undefined,
        purchase_document_date: parsedPurchaseDocumentDate,
        reference: data.reference || undefined,
        notes: data.notes || undefined,
        lines: lines.map((l) => {
          if (!isCommercialEgreso) {
            return {
              product_id: l.product_id,
              quantity: l.quantity,
              unit_cost: l.unit_cost || undefined,
            };
          }
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
            unit_cost: l.unit_cost || undefined,
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
      if (
        data.egreso_type === "sale" &&
        data.purchase_document_type === "sales_note"
      ) {
        setCreatedDocument(doc);
        return;
      }
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
          ADJUSTMENT_REASON_REQUIRED: "Motivo del ajuste es obligatorio",
          ADJUSTMENT_REASON_INVALID: "Motivo del ajuste inválido",
          NOTES_REQUIRED_FOR_OTHER_DOCUMENT:
            "Observaciones es obligatorio cuando el documento es Otro",
          SELLER_REQUIRED: "Vendedor es obligatorio para ventas",
          SELLER_NOT_ALLOWED: "El vendedor no está habilitado para la empresa",
          PURCHASE_DOCUMENT_NUMBER_WHITESPACE:
            "Número de documento no debe tener espacios al inicio o al final",
          PURCHASE_DOCUMENT_NUMBER_DUPLICATE:
            "Número de documento ya registrado en otra venta",
          INSUFFICIENT_STOCK: "Stock insuficiente en uno de los productos",
          BANK_REQUIRED: "Banco es obligatorio para transferencias",
          BANK_NOT_ALLOWED: "El banco no está habilitado para la empresa",
          PRODUCT_NOT_FOUND: "Uno de los productos no fue encontrado",
          DOCUMENT_REQUIRES_LINES: "Agrega al menos una línea al documento",
          SALES_NOTE_LINE_LIMIT: "La Nota de Venta admite máximo 9 productos",
        }),
      );
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", fitsScreen && "h-full")}>
      <PageHeader
        className="mb-0 shrink-0"
        title="Nuevo Egreso"
        actions={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />

      <form
        onSubmit={handleSubmit(onSubmit, () => {
          setHeaderOpen(true);
          setPaymentOpen(false);
        })}
        className={cn("flex flex-col gap-4", fitsScreen && "min-h-0 flex-1")}
      >
        {formError && (
          <Alert variant="destructive" className="shrink-0">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Section className="shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Cabecera</h2>
              {!headerOpen && (
                <p className="truncate text-sm text-muted-foreground">
                  {headerSummary}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setHeaderOpen((open) => !open);
                setPaymentOpen(false);
              }}
            >
              {headerOpen ? (
                <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
              )}
              {headerOpen ? "Contraer" : "Editar"}
            </Button>
          </div>
          <div
            className={cn(
              "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
              !headerOpen && "hidden",
            )}
          >
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

            {egresoType === "sale" && (
              <div className="space-y-1.5">
                <FieldLabel label="Vendedor" required />
                <Select
                  value={watch("seller_name") || undefined}
                  onValueChange={(v) => {
                    setValue("seller_name", v, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  disabled={enabledSellers.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledSellers.map((seller) => (
                      <SelectItem key={seller} value={seller}>
                        {seller}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            {isAdjustmentReasonRequired(egresoType) && (
              <div className="space-y-1.5">
                <FieldLabel label="Motivo del ajuste" required />
                <Select
                  value={watch("adjustment_reason") ?? ""}
                  onValueChange={(v) => {
                    setValue(
                      "adjustment_reason",
                      v as FormData["adjustment_reason"],
                      {
                        shouldDirty: true,
                        shouldValidate: true,
                      },
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAdjustmentReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {ADJUSTMENT_REASON_LABELS[reason]}
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

            <FormField
              label="Número de documento"
              required={isPurchaseDocumentNumberRequired}
            >
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
              label={egresoType === "sale" ? "Cliente" : "Observaciones"}
              required={isOtherDocument}
              className="sm:col-span-2"
            >
              <Input
                {...register("notes")}
                disabled={egresoType === "sale"}
                placeholder={
                  egresoType === "sale"
                    ? "CONSUMIDOR FINAL"
                    : "Observaciones (opcional)"
                }
              />
            </FormField>

            {egresoType === "sale" && (
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={consumerFinal}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        selectConsumerFinal();
                        return;
                      }
                      setCustomerError(null);
                      setCustomerDialogOpen(true);
                    }}
                  />
                  Consumidor Final
                </label>
              </div>
            )}
          </div>
        </Section>

        <Section
          title="Ítems"
          className={cn(fitsScreen && "flex min-h-0 flex-1 flex-col")}
        >
          <DocumentLinesEditor
            fillHeight={fitsScreen}
            lines={lines}
            onChange={setLines}
            defaultDiscountType="fixed"
            showUnitPrice={isCommercialEgreso}
            showUnitCost={isInventoryEgreso}
            readOnlyUnitCost={isInventoryEgreso}
            showSubtotal
            subtotalLabel={isCommercialEgreso ? "Subtotal" : "Valor"}
            showDiscount={isCommercialEgreso}
            showTotals
            unitPriceLabel="PVP unitario"
            totalsAmountLabel={
              isCommercialEgreso
                ? "Total del movimiento"
                : "Valor total del movimiento"
            }
            prioritizeInStock
            enforceStockLimit
            autoFillUnitPriceFromProduct={isCommercialEgreso}
            showProductCode
            productCodeLabel={
              saleProductCodeDisplay === "internal"
                ? "Código interno"
                : "Código de barras"
            }
            productCodeMode={saleProductCodeDisplay}
            maxLines={purchaseDocumentType === "sales_note" ? 9 : undefined}
          />
          {isCommercialEgreso && (
            <div className="mt-3 rounded-md border bg-muted/10">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-semibold">
                  Pago y resumen de venta
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPaymentOpen((open) => !open);
                    setHeaderOpen(false);
                  }}
                >
                  {paymentOpen ? "Contraer" : "Editar pago"}
                </Button>
              </div>
              {paymentOpen && (
                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_1fr]">
                  <div className="space-y-3">
                    <h3 className="text-center text-base font-bold">Pago</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3">
                        <FieldLabel label="Forma de pago" required />
                        <Select
                          value={paymentMethod}
                          onValueChange={(value) =>
                            setValue("payment_method", value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          <SelectTrigger className="justify-center text-center">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {activePaymentMethods.map((item) => (
                              <SelectItem key={item.name} value={item.name}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {paymentRequiresBank && (
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3">
                          <FieldLabel label="Banco" required />
                          <Select
                            value={watch("bank_name") || undefined}
                            onValueChange={(value) =>
                              setValue("bank_name", value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          >
                            <SelectTrigger className="justify-center text-center">
                              <SelectValue placeholder="Selecciona un banco" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeBanks.map((item) => (
                                <SelectItem key={item.name} value={item.name}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-center text-base font-bold">
                      Recibido y Cambio
                    </h3>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3">
                      <FieldLabel label="Valor recibido" />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={saleTotal.toFixed(2)}
                        className="text-center font-semibold"
                        disabled={paymentRequiresBank}
                        {...register("amount_received")}
                      />
                    </div>
                    {missingValue > 0 && (
                      <p className="text-center text-xs font-semibold text-destructive">
                        Faltante: {missingValue.toFixed(2)}
                      </p>
                    )}
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                      <span className="font-semibold">Cambio:</span>
                      <span className="text-center font-bold tabular-nums">
                        {changeValue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-center text-base font-bold">
                      Resumen en Venta
                    </h3>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-4 gap-y-3 text-sm">
                      <span className="font-semibold">Total:</span>
                      <span className="text-center font-bold tabular-nums">
                        {saleTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        <div className="flex shrink-0 gap-2">
          <Button type="submit" isLoading={isSubmitting}>
            Guardar egreso
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>

      <Dialog
        open={customerDialogOpen}
        onOpenChange={(open) => {
          setCustomerDialogOpen(open);
          if (!open) setCustomerError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datos del cliente</DialogTitle>
            <DialogDescription>
              Selecciona un cliente del catálogo o registra uno nuevo.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {customerError && (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{customerError}</AlertDescription>
              </Alert>
            )}

            {customerMode === "select" ? (
              <>
                <FormField label="Cliente" required className="sm:col-span-2">
                  <SearchableSelect
                    value={customerId ? String(customerId) : null}
                    onChange={(value) => setCustomerId(Number(value))}
                    options={(customers ?? []).map((c) => ({
                      value: String(c.id),
                      label: `${c.identification_number} | ${c.name}`,
                    }))}
                    placeholder="Seleccionar cliente"
                    emptyText="Sin clientes"
                  />
                </FormField>
                <Button
                  type="button"
                  variant="outline"
                  className="sm:col-span-2"
                  onClick={() => {
                    setCustomerError(null);
                    setCustomerMode("create");
                  }}
                >
                  Nuevo cliente
                </Button>
              </>
            ) : (
              <>
                <FormField
                  label="Tipo de identificación"
                  required
                  className="sm:col-span-2"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        "ruc",
                        "cedula",
                        "passport",
                      ] as SupplierIdentificationType[]
                    ).map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant={
                          customer.identification_type === type
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          setCustomer({
                            ...customer,
                            identification_type: type,
                            identification_number: "",
                          })
                        }
                      >
                        {ID_TYPE_LABEL[type]}
                      </Button>
                    ))}
                  </div>
                </FormField>
                <FormField
                  label={ID_TYPE_LABEL[customer.identification_type]}
                  required
                >
                  <Input
                    value={customer.identification_number}
                    maxLength={identificationMaxLength(
                      customer.identification_type,
                    )}
                    onChange={(event) =>
                      setCustomer({
                        ...customer,
                        identification_number: normalizeIdentificationInput(
                          customer.identification_type,
                          event.target.value,
                        ),
                      })
                    }
                  />
                </FormField>
                <FormField label="Nombre" required>
                  <Input
                    value={customer.name}
                    onChange={(event) =>
                      setCustomer({
                        ...customer,
                        name: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </FormField>
                <FormField label="Teléfono">
                  <Input
                    value={customer.phone}
                    onChange={(event) =>
                      setCustomer({
                        ...customer,
                        phone: event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 15),
                      })
                    }
                  />
                </FormField>
                <FormField label="Dirección">
                  <Input
                    value={customer.address}
                    onChange={(event) =>
                      setCustomer({
                        ...customer,
                        address: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </FormField>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (customerMode === "create") {
                  setCustomerMode("select");
                  setCustomerError(null);
                  return;
                }
                setCustomerDialogOpen(false);
              }}
            >
              {customerMode === "create" ? "Volver" : "Cancelar"}
            </Button>
            <Button
              type="button"
              onClick={acceptCustomer}
              isLoading={createCustomer.isPending}
            >
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdDocument}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Imprimir Nota de Venta</DialogTitle>
            <DialogDescription>
              ¿Deseas imprimir el documento ahora?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/inventory/egresos")}
            >
              No
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!createdDocument) return;
                window.open(
                  `/inventory/egresos/${createdDocument.id}/print`,
                  "_blank",
                  "noopener,noreferrer",
                );
                navigate("/inventory/egresos");
              }}
            >
              Sí, imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
