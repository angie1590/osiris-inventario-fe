import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DocumentDetailModal } from "@/features/inventory/DocumentDetailModal";
import { useBajasPage } from "@/features/inventory/hooks";
import { currentMonthRange } from "@/features/reports/DateRangeFilter";
import { useAuth } from "@/contexts/AuthContext";
import type { DocumentStatus, InventoryDocument } from "@/types/api";

const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  cancelled: "Cancelado",
  voided: "Anulado",
};
const STATUS_VARIANTS: Record<
  DocumentStatus,
  "default" | "secondary" | "destructive"
> = {
  pending: "secondary",
  approved: "default",
  cancelled: "secondary",
  voided: "destructive",
};

export default function BajasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === "admin" || user?.role === "supervisor";
  const defaultRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [page, setPage] = useState(1);
  const [viewDoc, setViewDoc] = useState<InventoryDocument | undefined>();
  const { data, isLoading, isError, refetch } = useBajasPage({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
  });

  const columns: Column<InventoryDocument>[] = [
    {
      key: "number",
      header: "Número",
      sortable: true,
      sortAccessor: (d) => d.number,
      cell: (d) => <span className="font-mono text-sm">{d.number}</span>,
    },
    {
      key: "notes",
      header: "Notas",
      sortable: true,
      sortAccessor: (d) => d.notes ?? "",
      cell: (d) => d.notes || "—",
    },
    {
      key: "lines",
      header: "Líneas",
      align: "right",
      sortable: true,
      sortAccessor: (d) => d.lines.length,
      cell: (d) => d.lines.length,
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      sortAccessor: (d) => d.status,
      cell: (d) => (
        <Badge variant={STATUS_VARIANTS[d.status]}>
          {STATUS_LABELS[d.status]}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Fecha",
      sortable: true,
      sortAccessor: (d) => new Date(d.created_at),
      cell: (d) => (
        <span className="text-sm text-muted-foreground">
          {new Date(d.created_at).toLocaleDateString("es-EC")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (d) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewDoc(d)}
            title="Ver documento"
            aria-label="Ver documento"
          >
            <Eye className="h-4 w-4 text-primary" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bajas de Inventario"
        actions={
          canCreate && (
            <Button onClick={() => navigate("/inventory/bajas/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva baja
            </Button>
          )
        }
      />
      <FilterBar>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            className="h-8 w-40"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            className="h-8 w-40"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </FilterBar>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        defaultSort={{ key: "created_at", dir: "desc" }}
        emptyHeading="Sin bajas de inventario"
        pagination={{
          page,
          pageSize: 10,
          total: data?.total ?? 0,
          totalPages: data?.total_pages ?? 0,
          onPageChange: setPage,
          itemLabel: "bajas",
        }}
      />

      {viewDoc && (
        <DocumentDetailModal
          doc={viewDoc}
          onClose={() => setViewDoc(undefined)}
          manageHref={`/inventory/bajas/${viewDoc.id}`}
        />
      )}
    </div>
  );
}
