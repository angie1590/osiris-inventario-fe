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
import { PURCHASE_DOCUMENT_TYPE_LABELS } from "@/features/inventory/documentTypes";
import { useEgresos } from "@/features/inventory/hooks";
import { currentMonthRange } from "@/features/reports/DateRangeFilter";
import { useAuth } from "@/contexts/AuthContext";
import type {
  DocumentStatus,
  EgresoType,
  InventoryDocument,
} from "@/types/api";

const EGRESO_TYPE_LABELS: Record<EgresoType, string> = {
  sale: "Venta",
  baja: "Baja",
  adjustment_negative: "Ajuste negativo",
  supplier_return: "Devolución a proveedor",
  internal_consumption: "Consumo interno",
  transfer_sent: "Transferencia enviada",
  other: "Otro",
};

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

export default function EgresosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const defaultRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [cursor, setCursor] = useState<number | undefined>();
  const [viewDoc, setViewDoc] = useState<InventoryDocument | undefined>();
  const {
    data: docs,
    isLoading,
    isError,
    refetch,
  } = useEgresos({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    cursor,
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
      key: "reference",
      header: "Referencia",
      sortable: true,
      sortAccessor: (d) => d.reference ?? "",
      cell: (d) => d.reference || "—",
    },
    {
      key: "egreso_type",
      header: "Tipo de egreso",
      sortable: true,
      sortAccessor: (d) => d.egreso_type ?? "",
      cell: (d) => (d.egreso_type ? EGRESO_TYPE_LABELS[d.egreso_type] : "—"),
    },
    {
      key: "purchase_document_type",
      header: "Tipo documento",
      sortable: true,
      sortAccessor: (d) => d.purchase_document_type ?? "",
      cell: (d) =>
        d.purchase_document_type
          ? PURCHASE_DOCUMENT_TYPE_LABELS[d.purchase_document_type]
          : "—",
    },
    {
      key: "lines",
      header: "ítems",
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
        title="Egresos"
        actions={
          canCreate && (
            <Button onClick={() => navigate("/inventory/egresos/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo egreso
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
        data={docs ?? []}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        defaultSort={{ key: "created_at", dir: "desc" }}
        emptyHeading="Sin egresos"
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
          disabled={!docs || docs.length < 50}
          onClick={() => setCursor(docs?.[docs.length - 1]?.id)}
        >
          Siguiente →
        </Button>
      </div>

      {viewDoc && (
        <DocumentDetailModal
          doc={viewDoc}
          onClose={() => setViewDoc(undefined)}
          showPrice
        />
      )}
    </div>
  );
}
