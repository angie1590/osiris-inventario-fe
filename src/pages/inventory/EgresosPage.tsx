import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Plus, X } from "lucide-react";
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
import { SearchInput } from "@/components/shared/SearchInput";
import { DocumentDetailModal } from "@/features/inventory/DocumentDetailModal";
import { useAuditUsers } from "@/features/audit/hooks";
import { PURCHASE_DOCUMENT_TYPE_LABELS } from "@/features/inventory/documentTypes";
import { useEgresosPage } from "@/features/inventory/hooks";
import { currentMonthRange } from "@/features/reports/DateRangeFilter";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/format";
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

const EGRESO_TYPE_BADGE_CLASS: Record<EgresoType, string> = {
  sale: "border-transparent bg-sky-100 text-sky-800",
  baja: "border-transparent bg-rose-100 text-rose-800",
  adjustment_negative: "border-transparent bg-orange-100 text-orange-800",
  supplier_return: "border-transparent bg-amber-100 text-amber-800",
  internal_consumption: "border-transparent bg-zinc-100 text-zinc-800",
  transfer_sent: "border-transparent bg-indigo-100 text-indigo-800",
  other: "border-transparent bg-stone-100 text-stone-800",
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

const documentTotal = (doc: InventoryDocument) =>
  doc.lines.reduce(
    (acc, line) =>
      acc +
      Number(line.quantity ?? 0) *
        Number(line.unit_price || line.unit_cost || 0),
    0,
  );

export default function EgresosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate =
    user?.role === "admin" ||
    user?.role === "operator" ||
    user?.role === "supervisor";
  const defaultRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [movementType, setMovementType] = useState<string>("");
  const [purchaseDocumentNumber, setPurchaseDocumentNumber] = useState("");
  const [page, setPage] = useState(1);
  const [viewDoc, setViewDoc] = useState<InventoryDocument | undefined>();
  const { data: users } = useAuditUsers();
  const resetPage = () => setPage(1);
  const hasActiveFilters =
    dateFrom !== defaultRange.date_from ||
    dateTo !== defaultRange.date_to ||
    movementType !== "" ||
    purchaseDocumentNumber.trim() !== "";
  const clearFilters = () => {
    setDateFrom(defaultRange.date_from);
    setDateTo(defaultRange.date_to);
    setMovementType("");
    setPurchaseDocumentNumber("");
    setPage(1);
  };
  const { data, isLoading, isError, refetch } = useEgresosPage({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    type: movementType || undefined,
    purchase_document_number: purchaseDocumentNumber || undefined,
    page,
  });
  const userLabels = new Map(
    (users ?? []).map((item) => [item.id, item.username]),
  );

  const columns: Column<InventoryDocument>[] = [
    {
      key: "number",
      header: "Número",
      sortable: true,
      sortAccessor: (d) => d.number,
      cell: (d) => <span className="font-mono text-sm">{d.number}</span>,
    },
    {
      key: "purchase_document_number",
      header: "Número de documento",
      align: "center",
      sortable: true,
      sortAccessor: (d) => d.purchase_document_number ?? "",
      cell: (d) => d.purchase_document_number || "—",
    },
    {
      key: "egreso_type",
      header: "Tipo de egreso",
      sortable: true,
      sortAccessor: (d) => d.egreso_type ?? "",
      cell: (d) =>
        d.egreso_type ? (
          <Badge
            variant="outline"
            className={EGRESO_TYPE_BADGE_CLASS[d.egreso_type]}
          >
            {EGRESO_TYPE_LABELS[d.egreso_type]}
          </Badge>
        ) : (
          "—"
        ),
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
      key: "created_by",
      header: "Vendedor",
      sortable: true,
      sortAccessor: (d) =>
        d.egreso_type === "sale"
          ? (d.seller_name ?? "")
          : (userLabels.get(d.created_by) ?? String(d.created_by)),
      cell: (d) =>
        d.egreso_type === "sale"
          ? d.seller_name || "—"
          : (userLabels.get(d.created_by) ?? `#${d.created_by}`),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortable: true,
      sortAccessor: (d) => documentTotal(d),
      cell: (d) => formatCurrency(documentTotal(d)),
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
            className="w-40"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={movementType || "__all__"}
            onValueChange={(v) => {
              setMovementType(v === "__all__" ? "" : v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {Object.entries(EGRESO_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nro. documento</Label>
          <SearchInput
            className="w-56 min-w-56"
            value={purchaseDocumentNumber}
            onChange={(value) => {
              setPurchaseDocumentNumber(value);
              resetPage();
            }}
            placeholder="Ej: 001-002-000123"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" className="h-9" onClick={clearFilters}>
            <X className="mr-1.5 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        defaultSort={{ key: "created_at", dir: "desc" }}
        emptyHeading="Sin egresos"
        pagination={{
          page,
          pageSize: 10,
          total: data?.total ?? 0,
          totalPages: data?.total_pages ?? 0,
          onPageChange: setPage,
          itemLabel: "egresos",
        }}
      />

      {viewDoc && (
        <DocumentDetailModal
          doc={viewDoc}
          onClose={() => setViewDoc(undefined)}
          showCost
          showPrice
        />
      )}
    </div>
  );
}
