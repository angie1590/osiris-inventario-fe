import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { Section } from "@/components/shared/Section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DocumentLinesEditor,
  type DocumentLine,
} from "@/features/inventory/DocumentLinesEditor";
import {
  useCreateIngreso,
  useCreateSupplier,
  useSuppliers,
  useUploadIngresoAttachment,
} from "@/features/inventory/hooks";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import type { CreateIngresoPayload } from "@/types/api";

const schema = z.object({
  ingreso_type: z.enum(["purchase", "initial_inventory"]),
  supplier_id: z.string().optional(),
  purchase_document_type: z.enum(["invoice", "sales_note", "receipt", "none"]),
  purchase_document_number: z.string().optional(),
  purchase_document_date: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

type ConfirmRow = {
  product_id: number;
  product_name: string;
  stock_actual: number;
  qty_in: number;
  new_stock: number;
  avg_before: number;
  cost_in: number;
  avg_after: number;
  value_in: number;
};

function isValidEcuadorRuc(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (province < 1 || province > 24) return false;
  const third = Number(value[2]);

  if (third < 6) {
    const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let total = 0;
    for (let i = 0; i < coefs.length; i += 1) {
      let p = Number(value[i]) * coefs[i];
      if (p >= 10) p -= 9;
      total += p;
    }
    const check = (10 - (total % 10)) % 10;
    return check === Number(value[9]) && value.slice(10) !== "000";
  }

  if (third === 6) {
    const coefs = [3, 2, 7, 6, 5, 4, 3, 2];
    const total = coefs.reduce(
      (acc, coef, i) => acc + Number(value[i]) * coef,
      0,
    );
    let check = 11 - (total % 11);
    if (check === 11) check = 0;
    return (
      check !== 10 && check === Number(value[8]) && value.slice(9) !== "0000"
    );
  }

  if (third === 9) {
    const coefs = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const total = coefs.reduce(
      (acc, coef, i) => acc + Number(value[i]) * coef,
      0,
    );
    let check = 11 - (total % 11);
    if (check === 11) check = 0;
    return (
      check !== 10 && check === Number(value[9]) && value.slice(10) !== "000"
    );
  }

  return false;
}

function isValidEcuadorCedula(value: string) {
  if (!/^\d{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (province < 1 || province > 24) return false;
  const third = Number(value[2]);
  if (third >= 6) return false;

  const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let total = 0;
  for (let i = 0; i < coefs.length; i += 1) {
    let p = Number(value[i]) * coefs[i];
    if (p >= 10) p -= 9;
    total += p;
  }
  const check = (10 - (total % 10)) % 10;
  return check === Number(value[9]);
}

const supplierSchema = z
  .object({
    identification_type: z.enum(["ruc", "cedula", "passport"]),
    identification_number: z
      .string()
      .trim()
      .min(1, "Identificación requerida")
      .max(20),
    trade_name: z.string().trim().min(1, "Nombre comercial requerido"),
    legal_name: z.string().trim().min(1, "Razón social requerida"),
    address: z.string().trim().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\d{7,15}$/, "Teléfono inválido (solo números)")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.identification_type === "ruc") {
      if (!/^\d{13}$/.test(data.identification_number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["identification_number"],
          message: "RUC inválido (debe tener 13 dígitos)",
        });
        return;
      }
      if (!isValidEcuadorRuc(data.identification_number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["identification_number"],
          message: "RUC inválido",
        });
      }
    }

    if (data.identification_type === "cedula") {
      if (!/^\d{10}$/.test(data.identification_number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["identification_number"],
          message: "Cédula inválida (debe tener 10 dígitos)",
        });
        return;
      }
      if (!isValidEcuadorCedula(data.identification_number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["identification_number"],
          message: "Cédula inválida",
        });
      }
    }
  });
type SupplierForm = z.infer<typeof supplierSchema>;

type SupplierApiError = {
  response?: {
    data?: {
      code?: string;
      message?: string;
      errors?: Record<string, string>;
      detail?: Array<{ loc?: Array<string | number>; msg?: string }>;
    };
  };
};

function formatDateDisplay(value?: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function IngresoNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateIngreso();
  const createSupplier = useCreateSupplier();
  const uploadAttachment = useUploadIngresoAttachment();
  const { data: suppliers } = useSuppliers(true);

  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRows, setConfirmRows] = useState<ConfirmRow[]>([]);
  const [pendingPayload, setPendingPayload] =
    useState<CreateIngresoPayload | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(
    null,
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ingreso_type: "purchase",
      purchase_document_type: "invoice",
    },
  });

  const {
    register: registerSupplier,
    handleSubmit: handleSupplierSubmit,
    reset: resetSupplier,
    watch: watchSupplier,
    setValue: setSupplierValue,
    setError: setSupplierError,
    clearErrors: clearSupplierErrors,
    formState: { errors: supplierErrors, isSubmitting: creatingSupplier },
  } = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      identification_type: "ruc",
    },
  });

  const asUpper = (value: string) => value.toUpperCase();
  const idTypeLabel: Record<SupplierForm["identification_type"], string> = {
    ruc: "RUC",
    cedula: "CÉDULA",
    passport: "PASAPORTE",
  };

  const ingresoType = watch("ingreso_type");
  const purchaseDocumentType = watch("purchase_document_type");
  const supplierIdentificationType = watchSupplier("identification_type");
  const identificationReg = registerSupplier("identification_number");
  const tradeReg = registerSupplier("trade_name");
  const legalReg = registerSupplier("legal_name");
  const addressReg = registerSupplier("address");
  const phoneReg = registerSupplier("phone");

  const purchaseDocumentDisabled = purchaseDocumentType === "none";

  const buildConfirmRows = async () => {
    const uniqueProductIds = Array.from(
      new Set(lines.map((l) => l.product_id).filter((id) => id > 0)),
    );
    const kardexPairs = await Promise.all(
      uniqueProductIds.map(async (productId) => {
        const res = await api.get(`/kardex/${productId}`);
        return [productId, res.data] as const;
      }),
    );
    const kardexMap = new Map(kardexPairs);

    return lines.map((line) => {
      const kardex = kardexMap.get(line.product_id);
      const qtyIn = Number(line.quantity || 0);
      const stockActual = Number(kardex?.closing_balance_quantity || 0);
      const avgBefore = Number(kardex?.weighted_avg_cost || 0);
      const costIn = Number(line.unit_cost || 0);
      const newStock = stockActual + qtyIn;
      const avgAfter =
        newStock > 0
          ? (stockActual * avgBefore + qtyIn * costIn) / newStock
          : 0;

      return {
        product_id: line.product_id,
        product_name: line.product_name || `#${line.product_id}`,
        stock_actual: stockActual,
        qty_in: qtyIn,
        new_stock: newStock,
        avg_before: avgBefore,
        cost_in: costIn,
        avg_after: avgAfter,
        value_in: qtyIn * costIn,
      };
    });
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
      setFormError("Completa todos los campos de las líneas");
      return;
    }

    if (data.ingreso_type === "purchase" && !data.supplier_id) {
      setFormError("Selecciona un proveedor para ingresos por compra");
      return;
    }

    const payload: CreateIngresoPayload = {
      ingreso_type: data.ingreso_type,
      supplier_id: data.supplier_id ? Number(data.supplier_id) : undefined,
      purchase_document_type: data.purchase_document_type,
      purchase_document_number:
        data.purchase_document_type !== "none"
          ? data.purchase_document_number || undefined
          : undefined,
      purchase_document_date:
        data.purchase_document_type !== "none" && data.purchase_document_date
          ? `${data.purchase_document_date}T00:00:00`
          : undefined,
      notes: data.notes || undefined,
      lines: lines.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_cost: l.unit_cost || undefined,
      })),
    };

    try {
      const rows = await buildConfirmRows();
      setPendingPayload(payload);
      setConfirmRows(rows);
      setConfirmOpen(true);
    } catch {
      setFormError("No se pudo preparar el resumen de aprobación");
    }
  };

  const confirmCreate = async () => {
    if (!pendingPayload) return;
    try {
      const doc = await create.mutateAsync(pendingPayload);
      if (attachment) {
        await uploadAttachment.mutateAsync({
          documentId: doc.id,
          file: attachment,
        });
      }
      toast({
        variant: "success",
        title: "Ingreso creado",
        description: `Ingreso ${doc.number} creado correctamente.`,
      });
      navigate(`/inventory/ingresos/${doc.id}`);
    } catch (err: unknown) {
      setFormError(
        getApiErrorMessage(err, "Error al crear el ingreso", {
          PRODUCT_NOT_FOUND: "Uno de los productos no fue encontrado",
          DOCUMENT_REQUIRES_LINES: "Agrega al menos una línea al documento",
          SUPPLIER_NOT_FOUND: "Proveedor inválido o inactivo",
        }),
      );
    } finally {
      setConfirmOpen(false);
      setPendingPayload(null);
    }
  };

  const onCreateSupplier = async (data: SupplierForm) => {
    setSupplierFormError(null);
    try {
      const supplier = await createSupplier.mutateAsync({
        identification_type: data.identification_type,
        identification_number: data.identification_number.trim().toUpperCase(),
        trade_name: asUpper(data.trade_name.trim()),
        legal_name: asUpper(data.legal_name.trim()),
        address: data.address ? asUpper(data.address.trim()) : null,
        phone: data.phone ? asUpper(data.phone.trim()) : null,
      });
      setValue("supplier_id", String(supplier.id));
      setSupplierOpen(false);
      resetSupplier();
    } catch (err: unknown) {
      const apiErr = err as SupplierApiError;
      const payload = apiErr?.response?.data;
      const fieldErrors = payload?.errors ?? {};
      const knownFields: Array<keyof SupplierForm> = [
        "identification_type",
        "identification_number",
        "trade_name",
        "legal_name",
        "address",
        "phone",
      ];

      knownFields.forEach((field) => {
        const msg = fieldErrors[field as string];
        if (msg) setSupplierError(field, { message: msg });
      });

      if (Array.isArray(payload?.detail)) {
        payload.detail.forEach((d) => {
          const locField = d.loc?.[d.loc.length - 1];
          if (
            typeof locField === "string" &&
            knownFields.includes(locField as keyof SupplierForm) &&
            d.msg
          ) {
            setSupplierError(locField as keyof SupplierForm, {
              message: d.msg,
            });
          }
        });
      }

      if (payload?.code === "SUPPLIER_IDENTIFICATION_EXISTS") {
        setSupplierError("identification_number", {
          message: "La identificación ya está registrada.",
        });
      }

      const msg =
        payload?.message ||
        (payload?.code === "SUPPLIER_IDENTIFICATION_EXISTS"
          ? "La identificación ingresada ya existe."
          : "Revisa los campos marcados en rojo.");
      setSupplierFormError(msg);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo Ingreso"
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

        <Section title="Cabecera del ingreso">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Tipo de ingreso</p>
              <Select
                value={watch("ingreso_type")}
                onValueChange={(v) =>
                  setValue(
                    "ingreso_type",
                    v as "purchase" | "initial_inventory",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Compra</SelectItem>
                  <SelectItem value="initial_inventory">
                    Inventario inicial
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-sm font-semibold">Proveedor</p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    value={watch("supplier_id") ?? null}
                    onChange={(v) => setValue("supplier_id", v)}
                    options={(suppliers ?? []).map((s) => ({
                      value: String(s.id),
                      label: `${s.identification_number} | ${s.legal_name} | ${s.trade_name}`,
                    }))}
                    placeholder="Seleccionar proveedor"
                    emptyText="Sin proveedores"
                    disabled={ingresoType !== "purchase"}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 mb-1"
                  onClick={() => setSupplierOpen(true)}
                  title="Crear nuevo proveedor"
                  disabled={ingresoType !== "purchase"}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Tipo de documento</p>
              <Select
                value={watch("purchase_document_type")}
                onValueChange={(v) =>
                  setValue(
                    "purchase_document_type",
                    v as "invoice" | "sales_note" | "receipt" | "none",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Factura</SelectItem>
                  <SelectItem value="sales_note">Nota de venta</SelectItem>
                  <SelectItem value="receipt">Recibo</SelectItem>
                  <SelectItem value="none">Sin documento</SelectItem>
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

            <FormField label="Fecha del documento">
              <Controller
                control={control}
                name="purchase_document_date"
                render={({ field }) => (
                  <div className="relative">
                    <Input
                      value={formatDateDisplay(field.value)}
                      readOnly
                      disabled={purchaseDocumentDisabled}
                      placeholder="dd/mm/aaaa"
                      className="h-10 pr-10 text-sm"
                    />
                    <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      disabled={purchaseDocumentDisabled}
                      className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                  </div>
                )}
              />
            </FormField>

            <FormField label="Observaciones" className="sm:col-span-2">
              <Input
                {...register("notes")}
                placeholder="Observaciones del ingreso"
              />
            </FormField>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Documento de compra</p>
              <Input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                disabled={purchaseDocumentDisabled}
                className="h-11 cursor-pointer text-sm leading-5 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:leading-5 file:text-primary-foreground hover:file:bg-primary/90"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Haz clic en "Seleccionar archivo" para adjuntar PDF o imagen.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Detalle de productos">
          <DocumentLinesEditor
            lines={lines}
            onChange={setLines}
            showUnitCost
            showSubtotal
            showTotals
          />
        </Section>

        <div className="flex gap-2">
          <Button type="submit" isLoading={isSubmitting || create.isPending}>
            Guardar ingreso
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>

      <Dialog
        open={supplierOpen}
        onOpenChange={(open) => {
          setSupplierOpen(open);
          if (!open) {
            setSupplierFormError(null);
            clearSupplierErrors();
            resetSupplier();
          }
        }}
      >
        <DialogContent>
          <form
            className="contents"
            onSubmit={handleSupplierSubmit(onCreateSupplier)}
          >
            <DialogHeader>
              <DialogTitle>Nuevo proveedor</DialogTitle>
              <DialogDescription>
                Registro rápido para asociar el ingreso de compra.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {supplierFormError && (
                <Alert variant="destructive">
                  <AlertDescription>{supplierFormError}</AlertDescription>
                </Alert>
              )}
              <FormField
                label="Tipo de identificación"
                required
                error={supplierErrors.identification_type?.message}
              >
                <Select
                  value={supplierIdentificationType}
                  onValueChange={(v) =>
                    setSupplierValue(
                      "identification_type",
                      v as "ruc" | "cedula" | "passport",
                      { shouldValidate: true },
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ruc">RUC</SelectItem>
                    <SelectItem value="cedula">CÉDULA</SelectItem>
                    <SelectItem value="passport">PASAPORTE</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label={idTypeLabel[supplierIdentificationType]}
                required
                error={supplierErrors.identification_number?.message}
              >
                <Input
                  {...identificationReg}
                  placeholder={
                    supplierIdentificationType === "ruc"
                      ? "0999999999001"
                      : supplierIdentificationType === "cedula"
                        ? "0912345678"
                        : "A1234567"
                  }
                  maxLength={
                    supplierIdentificationType === "passport"
                      ? 20
                      : supplierIdentificationType === "cedula"
                        ? 10
                        : 13
                  }
                  onChange={(e) => {
                    if (supplierIdentificationType === "passport") {
                      e.target.value = e.target.value
                        .toUpperCase()
                        .slice(0, 20);
                    } else if (supplierIdentificationType === "cedula") {
                      e.target.value = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                    } else {
                      e.target.value = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 13);
                    }
                    identificationReg.onChange(e);
                  }}
                />
              </FormField>
              <FormField
                label="Nombre comercial"
                required
                error={supplierErrors.trade_name?.message}
              >
                <Input
                  {...tradeReg}
                  onChange={(e) => {
                    e.target.value = asUpper(e.target.value);
                    tradeReg.onChange(e);
                  }}
                />
              </FormField>
              <FormField
                label="Razón social"
                required
                error={supplierErrors.legal_name?.message}
              >
                <Input
                  {...legalReg}
                  onChange={(e) => {
                    e.target.value = asUpper(e.target.value);
                    legalReg.onChange(e);
                  }}
                />
              </FormField>
              <FormField
                label="Dirección"
                error={supplierErrors.address?.message}
              >
                <Input
                  {...addressReg}
                  onChange={(e) => {
                    e.target.value = asUpper(e.target.value);
                    addressReg.onChange(e);
                  }}
                />
              </FormField>
              <FormField label="Teléfono" error={supplierErrors.phone?.message}>
                <Input
                  {...phoneReg}
                  onChange={(e) => {
                    e.target.value = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 15);
                    phoneReg.onChange(e);
                  }}
                />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSupplierOpen(false);
                  setSupplierFormError(null);
                  clearSupplierErrors();
                  resetSupplier();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creatingSupplier}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Resumen previo a aprobación</DialogTitle>
            <DialogDescription>
              Esta vista es informativa y no altera la lógica de cálculo.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-105 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Stock actual</TableHead>
                  <TableHead className="text-right">
                    Cantidad a ingresar
                  </TableHead>
                  <TableHead className="text-right">Nuevo stock</TableHead>
                  <TableHead className="text-right">
                    Costo promedio anterior
                  </TableHead>
                  <TableHead className="text-right">
                    Costo del ingreso
                  </TableHead>
                  <TableHead className="text-right">
                    Nuevo costo promedio
                  </TableHead>
                  <TableHead className="text-right">
                    Valor del ingreso
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {confirmRows.map((row) => (
                  <TableRow key={`${row.product_id}-${row.product_name}`}>
                    <TableCell>{row.product_name}</TableCell>
                    <TableCell className="text-right">
                      {formatQuantity(row.stock_actual, "integer")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatQuantity(row.qty_in, "integer")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatQuantity(row.new_stock, "integer")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.avg_before)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.cost_in)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.avg_after)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.value_in)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Revisar
            </Button>
            <Button
              onClick={confirmCreate}
              isLoading={create.isPending || uploadAttachment.isPending}
            >
              Aprobar y guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
