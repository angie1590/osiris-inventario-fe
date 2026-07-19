import { useMemo, useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { SearchInput } from "@/components/shared/SearchInput";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField } from "@/components/shared/FormField";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import type {
  CreateSupplierPayload,
  InventorySupplier,
  SupplierIdentificationType,
} from "@/types/api";
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from "@/features/inventory/hooks";

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

const ID_TYPE_LABEL: Record<SupplierIdentificationType, string> = {
  ruc: "RUC",
  cedula: "CÉDULA",
  passport: "PASAPORTE",
};

function SupplierFormDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target?: InventorySupplier;
}) {
  const { toast } = useToast();
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      identification_type: target?.identification_type ?? "ruc",
      identification_number: target?.identification_number ?? "",
      trade_name: target?.trade_name ?? "",
      legal_name: target?.legal_name ?? "",
      address: target?.address ?? "",
      phone: target?.phone ?? "",
    },
  });

  const identificationType = watch("identification_type");
  const identificationReg = register("identification_number");
  const tradeReg = register("trade_name");
  const legalReg = register("legal_name");
  const addressReg = register("address");
  const phoneReg = register("phone");

  const asUpper = (value: string) => value.toUpperCase();

  const onSubmit = async (data: SupplierForm) => {
    setFormError(null);
    const payload: CreateSupplierPayload = {
      identification_type: data.identification_type,
      identification_number: data.identification_number.trim().toUpperCase(),
      trade_name: asUpper(data.trade_name.trim()),
      legal_name: asUpper(data.legal_name.trim()),
      address: data.address ? asUpper(data.address.trim()) : null,
      phone: data.phone ? data.phone.trim() : null,
    };

    try {
      if (target) {
        await update.mutateAsync({ id: target.id, payload });
        toast({ variant: "success", title: "Proveedor actualizado" });
      } else {
        await create.mutateAsync(payload);
        toast({ variant: "success", title: "Proveedor creado" });
      }
      onClose();
      reset();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "No se pudo guardar el proveedor.", {
        SUPPLIER_IDENTIFICATION_EXISTS: "La identificación ya está registrada.",
      });
      if (msg.includes("identificación")) {
        setError("identification_number", { message: msg });
      }
      setFormError(msg);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state && !isSubmitting) {
          clearErrors();
          setFormError(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <form className="contents" onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {target ? "Editar proveedor" : "Nuevo proveedor"}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <FormField
              label="Tipo de identificación"
              required
              error={errors.identification_type?.message}
            >
              <div className="grid grid-cols-3 gap-2">
                {(
                  ["ruc", "cedula", "passport"] as SupplierIdentificationType[]
                ).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={
                      identificationType === type ? "default" : "outline"
                    }
                    onClick={() =>
                      setValue("identification_type", type, {
                        shouldValidate: true,
                      })
                    }
                  >
                    {ID_TYPE_LABEL[type]}
                  </Button>
                ))}
              </div>
            </FormField>

            <FormField
              label={ID_TYPE_LABEL[identificationType]}
              required
              error={errors.identification_number?.message}
            >
              <Input
                {...identificationReg}
                placeholder={
                  identificationType === "ruc"
                    ? "0999999999001"
                    : identificationType === "cedula"
                      ? "0912345678"
                      : "A1234567"
                }
                maxLength={
                  identificationType === "passport"
                    ? 20
                    : identificationType === "cedula"
                      ? 10
                      : 13
                }
                onChange={(e) => {
                  if (identificationType === "passport") {
                    e.target.value = e.target.value.toUpperCase().slice(0, 20);
                  } else if (identificationType === "cedula") {
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
              error={errors.trade_name?.message}
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
              error={errors.legal_name?.message}
            >
              <Input
                {...legalReg}
                onChange={(e) => {
                  e.target.value = asUpper(e.target.value);
                  legalReg.onChange(e);
                }}
              />
            </FormField>

            <FormField label="Dirección" error={errors.address?.message}>
              <Input
                {...addressReg}
                onChange={(e) => {
                  e.target.value = asUpper(e.target.value);
                  addressReg.onChange(e);
                }}
              />
            </FormField>

            <FormField label="Teléfono" error={errors.phone?.message}>
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
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting || create.isPending || update.isPending}
            >
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SuppliersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "admin" || user?.role === "operator";
  const { data, isLoading, isError, refetch } = useSuppliers(true);
  const removeSupplier = useDeleteSupplier();

  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventorySupplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventorySupplier | null>(
    null,
  );

  const rows = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((supplier) => {
      return (
        supplier.identification_number.toLowerCase().includes(q) ||
        supplier.legal_name.toLowerCase().includes(q) ||
        supplier.trade_name.toLowerCase().includes(q)
      );
    });
  }, [data, query]);

  const columns: Column<InventorySupplier>[] = [
    {
      key: "identification",
      header: "Identificación",
      sortable: true,
      sortAccessor: (r) =>
        `${r.identification_type}-${r.identification_number}`,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.identification_number}</p>
          <p className="text-xs text-muted-foreground">
            {ID_TYPE_LABEL[row.identification_type]}
          </p>
        </div>
      ),
    },
    {
      key: "trade_name",
      header: "Nombre comercial",
      sortable: true,
      sortAccessor: (r) => r.trade_name,
      cell: (row) => row.trade_name,
    },
    {
      key: "legal_name",
      header: "Razón social",
      sortable: true,
      sortAccessor: (r) => r.legal_name,
      cell: (row) => row.legal_name,
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (row) => row.phone || "—",
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      className: "w-[120px]",
      cell: (row) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setEditTarget(row)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Solo lectura</span>
        ),
    },
  ];

  const onDelete = async (target: InventorySupplier) => {
    try {
      await removeSupplier.mutateAsync(target.id);
      toast({
        variant: "success",
        title: "Proveedor eliminado",
        description: `${target.trade_name} fue desactivado.`,
      });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: getApiErrorMessage(err, "Intenta nuevamente."),
      });
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Proveedores"
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo proveedor
            </Button>
          ) : null
        }
      />

      <FilterBar>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por identificación, razón social o nombre comercial..."
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyHeading="Sin proveedores"
        emptyDescription="Crea un proveedor para asociarlo a ingresos por compra."
        emptyAction={
          canManage
            ? {
                label: "Nuevo proveedor",
                onClick: () => setCreateOpen(true),
              }
            : undefined
        }
      />

      {createOpen && (
        <SupplierFormDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {editTarget && (
        <SupplierFormDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          target={editTarget}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Eliminar proveedor"
          description={
            <span>
              ¿Deseas eliminar a <strong>{deleteTarget.trade_name}</strong>?
            </span>
          }
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={() => onDelete(deleteTarget)}
        />
      )}

      {!canManage && (
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertDescription>
            Tu rol solo permite consultar proveedores.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
