import { useMemo, useState } from "react";
import { Users, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  ID_TYPE_LABEL,
  getIdentificationError,
  identificationMaxLength,
  normalizeIdentificationInput,
} from "@/lib/identification";
import type {
  CreateCustomerPayload,
  InventoryCustomer,
  SupplierIdentificationType,
} from "@/types/api";
import {
  useCreateCustomer,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
} from "@/features/inventory/hooks";

const customerSchema = z
  .object({
    identification_type: z.enum(["ruc", "cedula", "passport"]),
    identification_number: z
      .string()
      .trim()
      .min(1, "Identificación requerida")
      .max(20),
    name: z.string().trim().min(1, "Nombre requerido"),
    address: z.string().trim().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\d{7,15}$/, "Teléfono inválido (solo números)")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const error = getIdentificationError(
      data.identification_type,
      data.identification_number,
    );
    if (error) {
      ctx.addIssue({
        code: "custom",
        path: ["identification_number"],
        message: error,
      });
    }
  });

type CustomerForm = z.infer<typeof customerSchema>;

function CustomerFormDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target?: InventoryCustomer;
}) {
  const { toast } = useToast();
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
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
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      identification_type: target?.identification_type ?? "cedula",
      identification_number: target?.identification_number ?? "",
      name: target?.name ?? "",
      address: target?.address ?? "",
      phone: target?.phone ?? "",
    },
  });

  const identificationType = watch("identification_type");
  const identificationReg = register("identification_number");
  const nameReg = register("name");
  const addressReg = register("address");
  const phoneReg = register("phone");

  const onSubmit = async (data: CustomerForm) => {
    setFormError(null);
    const payload: CreateCustomerPayload = {
      identification_type: data.identification_type,
      identification_number: data.identification_number.trim().toUpperCase(),
      name: data.name.trim().toUpperCase(),
      address: data.address ? data.address.trim().toUpperCase() : null,
      phone: data.phone ? data.phone.trim() : null,
    };

    try {
      if (target) {
        await update.mutateAsync({ id: target.id, payload });
        toast({ variant: "success", title: "Cliente actualizado" });
      } else {
        await create.mutateAsync(payload);
        toast({ variant: "success", title: "Cliente creado" });
      }
      onClose();
      reset();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "No se pudo guardar el cliente.", {
        CUSTOMER_IDENTIFICATION_EXISTS: "La identificación ya está registrada.",
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
              {target ? "Editar cliente" : "Nuevo cliente"}
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
                    variant={identificationType === type ? "default" : "outline"}
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
                maxLength={identificationMaxLength(identificationType)}
                onChange={(e) => {
                  e.target.value = normalizeIdentificationInput(
                    identificationType,
                    e.target.value,
                  );
                  identificationReg.onChange(e);
                }}
              />
            </FormField>

            <FormField label="Nombre" required error={errors.name?.message}>
              <Input
                {...nameReg}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  nameReg.onChange(e);
                }}
              />
            </FormField>

            <FormField label="Dirección" error={errors.address?.message}>
              <Input
                {...addressReg}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  addressReg.onChange(e);
                }}
              />
            </FormField>

            <FormField label="Teléfono" error={errors.phone?.message}>
              <Input
                {...phoneReg}
                onChange={(e) => {
                  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 15);
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

export default function CustomersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage =
    user?.role === "admin" ||
    user?.role === "operator" ||
    user?.role === "supervisor";
  const { data, isLoading, isError, refetch } = useCustomers(true);
  const removeCustomer = useDeleteCustomer();

  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryCustomer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryCustomer | null>(
    null,
  );

  const rows = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (customer) =>
        customer.identification_number.toLowerCase().includes(q) ||
        customer.name.toLowerCase().includes(q),
    );
  }, [data, query]);

  const columns: Column<InventoryCustomer>[] = [
    {
      key: "identification",
      header: "Identificación",
      sortable: true,
      sortAccessor: (r) => `${r.identification_type}-${r.identification_number}`,
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
      key: "name",
      header: "Nombre",
      sortable: true,
      sortAccessor: (r) => r.name,
      cell: (row) => row.name,
    },
    {
      key: "address",
      header: "Dirección",
      cell: (row) => row.address || "—",
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

  const onDelete = async (target: InventoryCustomer) => {
    try {
      await removeCustomer.mutateAsync(target.id);
      toast({
        variant: "success",
        title: "Cliente eliminado",
        description: `${target.name} fue desactivado.`,
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
        title="Clientes"
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          ) : null
        }
      />

      <FilterBar>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por identificación o nombre..."
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyHeading="Sin clientes"
        emptyDescription="Crea un cliente para asociarlo a egresos por venta."
        emptyAction={
          canManage
            ? { label: "Nuevo cliente", onClick: () => setCreateOpen(true) }
            : undefined
        }
      />

      {createOpen && (
        <CustomerFormDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {editTarget && (
        <CustomerFormDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          target={editTarget}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Eliminar cliente"
          description={
            <span>
              ¿Deseas eliminar a <strong>{deleteTarget.name}</strong>?
            </span>
          }
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={() => onDelete(deleteTarget)}
        />
      )}

      {!canManage && (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            Tu rol solo permite consultar clientes.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
