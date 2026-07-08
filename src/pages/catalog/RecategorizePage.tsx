import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { TreeSelector } from "@/components/shared/TreeSelector";
import {
  usePendingRecategorization,
  useRecategorize,
  useCategories,
} from "@/features/catalog/hooks";
import { buildCategoryPath, subtreeOf } from "@/features/catalog/categoryPath";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import type { Product } from "@/types/api";

export default function RecategorizePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: pending, isLoading } = usePendingRecategorization();
  const { data: categories } = useCategories();
  const recategorize = useRecategorize();
  const [assignments, setAssignments] = useState<Record<number, number | null>>(
    {},
  );

  const cats = categories ?? [];

  // Group pending products by their default (Sin clasificar) category.
  const groups = useMemo(() => {
    const byDefault = new Map<number, Product[]>();
    for (const p of pending ?? []) {
      const list = byDefault.get(p.category_id) ?? [];
      list.push(p);
      byDefault.set(p.category_id, list);
    }
    return Array.from(byDefault.entries()).map(([defaultId, products]) => {
      const def = cats.find((c) => c.id === defaultId);
      const parentId = def?.parent_id ?? null;
      // Targets: leaf categories within the parent branch, excluding default buckets.
      const targets =
        parentId != null
          ? subtreeOf(cats, parentId).filter((c) => !c.is_default)
          : [];
      return {
        defaultId,
        parentId,
        parentPath: parentId != null ? buildCategoryPath(cats, parentId) : "—",
        products,
        targets,
      };
    });
  }, [pending, cats]);

  const selectedCount = Object.values(assignments).filter(
    (v) => v != null,
  ).length;

  const handleSubmit = async () => {
    const payload = Object.entries(assignments)
      .filter(([, catId]) => catId != null)
      .map(([pid, catId]) => ({
        product_id: Number(pid),
        category_id: catId as number,
      }));
    if (payload.length === 0) {
      toast({
        variant: "warning",
        title: "Nada que guardar",
        description: "Asigna una categoría a al menos un producto.",
      });
      return;
    }
    try {
      const res = await recategorize.mutateAsync(payload);
      toast({
        variant: "success",
        title: "Productos recategorizados",
        description: `${res.recategorized} producto(s) reasignado(s).`,
      });
      setAssignments({});
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error al recategorizar",
        description: getApiErrorMessage(
          err,
          "No se pudo recategorizar. Intenta nuevamente.",
        ),
      });
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recategorizar productos"
        actions={
          (pending ?? []).length > 0 && (
            <Button
              onClick={handleSubmit}
              isLoading={recategorize.isPending}
              disabled={selectedCount === 0}
            >
              Guardar ({selectedCount})
            </Button>
          )
        }
      />

      {(pending ?? []).length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10 text-success" />}
          heading="No hay productos pendientes"
          description="Todos los productos están asignados a una categoría definitiva."
          action={{
            label: "Ir a productos",
            onClick: () => navigate("/products"),
          }}
        />
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/80 bg-amber-100/95 px-4 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Estos productos quedaron en una categoría temporal{" "}
              <strong>"Sin clasificar"</strong> al crear subcategorías.
              Asígnales una subcategoría definitiva. La categoría temporal se
              elimina sola al quedar vacía.
            </span>
          </div>

          {groups.map((g) => (
            <div key={g.defaultId} className="rounded-lg border bg-card">
              <div className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">
                {g.parentPath}{" "}
                <span className="text-foreground">/ Sin clasificar</span> —{" "}
                {g.products.length} producto(s)
              </div>
              <div className="divide-y">
                {g.products.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Código de barras {p.isbn}
                      </p>
                    </div>
                    <div className="w-72">
                      <TreeSelector
                        categories={g.targets}
                        value={assignments[p.id] ?? null}
                        onChange={(id) =>
                          setAssignments((prev) => ({ ...prev, [p.id]: id }))
                        }
                        placeholder="Elegir subcategoría…"
                        leafOnly
                        defaultExpanded
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
