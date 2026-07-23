import { useState } from "react";
import { Eye, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeader } from "@/components/shared/PageHeader";
import { useConteos } from "@/features/inventory/hooks";
import { currentMonthRange } from "@/features/reports/DateRangeFilter";
import { useAuth } from "@/contexts/AuthContext";
import type { CountStatus, InventoryCount } from "@/types/api";

const STATUS_LABELS: Record<CountStatus, string> = {
  draft: "Borrador",
  applied: "Aplicado",
  cancelled: "Cancelado",
};

const STATUS_VARIANTS: Record<
  CountStatus,
  "default" | "secondary" | "destructive"
> = {
  draft: "secondary",
  applied: "default",
  cancelled: "destructive",
};

export default function ConteosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const defaultRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [cursor, setCursor] = useState<number | undefined>();

  const { data, isLoading, isError, refetch } = useConteos({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    cursor,
  });

  const columns: Column<InventoryCount>[] = [
    {
      key: "number",
      header: "Número",
      sortable: true,
      sortAccessor: (row) => row.number,
      cell: (row) => <span className="font-mono text-sm">{row.number}</span>,
    },
    {
      key: "description",
      header: "Descripción",
      sortable: true,
      sortAccessor: (row) => row.description,
      cell: (row) => row.description,
    },
    {
      key: "lines",
      header: "Ítems",
      align: "center",
      sortable: true,
      sortAccessor: (row) => row.lines.length,
      cell: (row) => row.lines.length,
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      sortAccessor: (row) => row.status,
      cell: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status]}>
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Fecha",
      sortable: true,
      sortAccessor: (row) => new Date(row.created_at),
      cell: (row) => new Date(row.created_at).toLocaleDateString("es-EC"),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/inventory/conteos/${row.id}`)}
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
        title="Conteo"
        description="Registra el conteo físico y luego aplica las diferencias al inventario."
        actions={
          canCreate && (
            <Button onClick={() => navigate("/inventory/conteos/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo conteo
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
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            className="h-8 w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </FilterBar>
      <DataTable
        columns={columns}
        data={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        defaultSort={{ key: "created_at", dir: "desc" }}
        emptyHeading="Sin conteos"
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!cursor}
          onClick={() => setCursor(undefined)}
        >
          Primera página
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!data || data.length < 50}
          onClick={() => setCursor(data?.[data.length - 1]?.id)}
        >
          Siguiente →
        </Button>
      </div>
    </div>
  );
}
