import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Power,
  PowerOff,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { SearchInput } from "@/components/shared/SearchInput";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField } from "@/components/shared/FormField";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  useCatalogs,
  useCreateCatalog,
  useUpdateCatalog,
  useDeleteCatalog,
  useCatalogValues,
  useAddCatalogValue,
  useUpdateCatalogValue,
  useToggleCatalogValue,
} from "@/features/catalog/catalogHooks";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import type { Catalog, CatalogValue } from "@/types/api";

function CatalogFormModal({
  catalog,
  onClose,
}: {
  catalog?: Catalog;
  onClose: () => void;
}) {
  const create = useCreateCatalog();
  const update = useUpdateCatalog();
  const { toast } = useToast();
  const isEdit = !!catalog;
  const [name, setName] = useState(catalog?.name ?? "");
  const [description, setDescription] = useState(catalog?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: catalog!.id,
          payload: { name, description },
        });
        toast({
          variant: "success",
          title: "Catálogo actualizado",
          description: `"${name}" actualizado.`,
        });
      } else {
        await create.mutateAsync({ name, description });
        toast({
          variant: "success",
          title: "Catálogo creado",
          description: `"${name}" creado.`,
        });
      }
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "No se pudo guardar el catálogo."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !saving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar catálogo" : "Nuevo catálogo"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Nombre" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Marcas, Colores, Materiales"
            />
          </FormField>
          <FormField label="Descripción (opcional)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={saving}>
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatalogValuesPanel({
  catalog,
  canManage,
  onBack,
}: {
  catalog: Catalog;
  canManage: boolean;
  onBack: () => void;
}) {
  const { data: values, isLoading } = useCatalogValues(catalog.id);
  const addValue = useAddCatalogValue();
  const updateValue = useUpdateCatalogValue();
  const toggleValue = useToggleCatalogValue();
  const { toast } = useToast();
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CatalogValue | null>(null);
  const [editText, setEditText] = useState("");
  const [filter, setFilter] = useState("");
  const filtered = (values ?? []).filter((v) =>
    v.value.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  const handleAdd = async () => {
    setAddError(null);
    if (!newValue.trim()) return;
    try {
      await addValue.mutateAsync({ catalogId: catalog.id, value: newValue });
      setNewValue("");
      toast({
        variant: "success",
        title: "Valor agregado",
        description: `"${newValue}" agregado.`,
      });
    } catch (err: unknown) {
      setAddError(getApiErrorMessage(err, "No se pudo agregar el valor."));
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    try {
      await updateValue.mutateAsync({
        catalogId: catalog.id,
        valueId: editTarget.id,
        value: editText,
      });
      toast({ variant: "success", title: "Valor actualizado" });
      setEditTarget(null);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: getApiErrorMessage(err, "No se pudo actualizar."),
      });
      throw err;
    }
  };

  const handleToggle = async (v: CatalogValue) => {
    try {
      await toggleValue.mutateAsync({
        catalogId: catalog.id,
        valueId: v.id,
        active: !v.is_active,
      });
      toast({
        variant: "success",
        title: v.is_active ? "Valor desactivado" : "Valor activado",
      });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: getApiErrorMessage(err, "No se pudo cambiar el estado."),
      });
    }
  };

  const columns: Column<CatalogValue>[] = [
    {
      key: "value",
      header: "Valor",
      sortable: true,
      sortAccessor: (v) => v.value,
      cell: (v) => v.value,
    },
    {
      key: "is_active",
      header: "Estado",
      sortable: true,
      sortAccessor: (v) => (v.is_active ? 1 : 0),
      cell: (v) => (
        <Badge variant={v.is_active ? "success" : "secondary"}>
          {v.is_active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (v: CatalogValue) => (
              <div className="flex justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditTarget(v);
                    setEditText(v.value);
                  }}
                  title="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleToggle(v)}
                  title={v.is_active ? "Desactivar" : "Activar"}
                >
                  {v.is_active ? (
                    <PowerOff className="h-3 w-3 text-warning" />
                  ) : (
                    <Power className="h-3 w-3 text-success" />
                  )}
                </Button>
              </div>
            ),
          } as Column<CatalogValue>,
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Catálogo — {catalog.name}</h1>
      </div>

      {canManage && (
        <div className="flex items-start gap-2">
          <div className="flex-1 max-w-md">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Nuevo valor…"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            {addError && (
              <p className="mt-1 text-xs text-destructive">{addError}</p>
            )}
          </div>
          <Button onClick={handleAdd} isLoading={addValue.isPending}>
            <Plus className="mr-1 h-4 w-4" />
            Agregar
          </Button>
        </div>
      )}

      {(values ?? []).length > 0 && (
        <FilterBar>
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder="Buscar valor..."
          />
        </FilterBar>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (values ?? []).length === 0 ? (
        <EmptyState
          heading="Este catálogo no tiene valores"
          description="Agrega el primer valor para empezar."
        />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(v) => v.id}
          emptyHeading={filter ? "Sin coincidencias" : "Sin valores"}
        />
      )}

      {editTarget && (
        <Dialog open onOpenChange={() => setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar valor</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <FormField label="Valor" required>
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button onClick={handleEdit} isLoading={updateValue.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function CatalogsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "supervisor";
  const { data: catalogs, isLoading } = useCatalogs();
  const deleteCatalog = useDeleteCatalog();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Catalog | null>(null);
  const [editTarget, setEditTarget] = useState<Catalog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Catalog | null>(null);

  if (selected) {
    return (
      <CatalogValuesPanel
        catalog={selected}
        canManage={canManage}
        onBack={() => setSelected(null)}
      />
    );
  }

  const handleDelete = async (c: Catalog) => {
    try {
      await deleteCatalog.mutateAsync(c.id);
      toast({
        variant: "success",
        title: "Catálogo eliminado",
        description: `"${c.name}" eliminado.`,
      });
    } catch (err: unknown) {
      toast({
        variant: "warning",
        title: "Acción restringida",
        description: getApiErrorMessage(
          err,
          `No se pudo eliminar "${c.name}".`,
        ),
      });
      throw err;
    }
  };

  const columns: Column<Catalog>[] = [
    {
      key: "name",
      header: "Catálogo",
      sortable: true,
      sortAccessor: (c) => c.name,
      cell: (c) => (
        <button
          type="button"
          className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
          onClick={() => setSelected(c)}
        >
          <ListChecks className="h-4 w-4" />
          {c.name}
        </button>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      cell: (c) => (
        <span className="text-sm text-muted-foreground">
          {c.description || "—"}
        </span>
      ),
    },
    {
      key: "value_count",
      header: "Valores",
      align: "right",
      sortable: true,
      sortAccessor: (c) => c.value_count,
      cell: (c) => c.value_count,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (c: Catalog) => (
              <div className="flex justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setSelected(c)}
                  title="Ver valores"
                  aria-label="Ver valores"
                >
                  <ListChecks className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditTarget(c)}
                  title="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => setDeleteTarget(c)}
                  title="Eliminar"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ),
          } as Column<Catalog>,
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Catálogos" />

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (catalogs ?? []).length === 0 ? (
        <EmptyState
          heading="No hay catálogos"
          description="Los catálogos se crean automáticamente al definir un atributo de tipo Catálogo."
        />
      ) : (
        <DataTable
          data={catalogs ?? []}
          columns={columns}
          rowKey={(c) => c.id}
        />
      )}

      {editTarget && (
        <CatalogFormModal
          catalog={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Eliminar catálogo"
          description={
            <>
              ¿Eliminar el catálogo <strong>{deleteTarget.name}</strong>?
            </>
          }
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
