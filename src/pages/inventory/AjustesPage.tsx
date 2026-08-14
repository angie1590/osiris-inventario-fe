import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DocumentDetailModal } from "@/features/inventory/DocumentDetailModal";
import { useAjustesPage } from "@/features/inventory/hooks";
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

export default function AjustesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === "admin" || user?.role === "supervisor";
  const defaultRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [viewDoc, setViewDoc] = useState<InventoryDocument | undefined>();
  const { data, isLoading, isError, refetch } = useAjustesPage({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    status: status || undefined,
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
      key: "adjust_type",
      header: "Tipo",
      sortable: true,
      sortAccessor: (d) => d.adjust_type ?? "",
      cell: (d) =>
        d.adjust_type === "increment" ? "Incremento" : "Decremento",
    },
    {
      key: "lines",
      header: "Ítems",
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
        title="Ajustes de Inventario"
        actions={
          canCreate && (
            <Button onClick={() => navigate("/inventory/ajustes/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo ajuste
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
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select
            value={status ?? "__all__"}
            onValueChange={(v) => {
              setStatus(v === "__all__" ? undefined : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="approved">Aprobado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="voided">Anulado</SelectItem>
            </SelectContent>
          </Select>
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
        emptyHeading="Sin ajustes de inventario"
        pagination={{
          page,
          pageSize: 10,
          total: data?.total ?? 0,
          totalPages: data?.total_pages ?? 0,
          onPageChange: setPage,
          itemLabel: "ajustes",
        }}
      />

      {viewDoc && (
        <DocumentDetailModal
          doc={viewDoc}
          onClose={() => setViewDoc(undefined)}
          manageHref={`/inventory/ajustes/${viewDoc.id}`}
        />
      )}
    </div>
  );
}
