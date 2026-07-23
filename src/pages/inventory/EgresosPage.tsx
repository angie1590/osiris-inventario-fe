import { useMemo, useState } from "react";
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

export default function EgresosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const defaultRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [movementType, setMovementType] = useState<string>("");
  const [purchaseDocumentNumber, setPurchaseDocumentNumber] = useState("");
  const [cursor, setCursor] = useState<number | undefined>();
  const [viewDoc, setViewDoc] = useState<InventoryDocument | undefined>();
  const { data: users } = useAuditUsers();
  const resetPage = () => setCursor(undefined);
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
    setCursor(undefined);
  };
  const {
    data: docs,
    isLoading,
    isError,
    refetch,
  } = useEgresos({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    type: movementType || undefined,
    cursor,
  });
  const normalizedDocumentFilter = purchaseDocumentNumber
    .trim()
    .toLocaleLowerCase();
  const filteredDocs = useMemo(() => {
    const items = docs ?? [];
    if (!normalizedDocumentFilter) return items;
    return items.filter((doc) =>
      (doc.purchase_document_number ?? "")
        .toLocaleLowerCase()
        .includes(normalizedDocumentFilter),
    );
  }, [docs, normalizedDocumentFilter]);

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
      header: "Usuario",
      sortable: true,
      sortAccessor: (d) => userLabels.get(d.created_by) ?? String(d.created_by),
      cell: (d) => userLabels.get(d.created_by) ?? `#${d.created_by}`,
    },
    {
      key: "lines",
      header: "ítems",
      align: "center",
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
        data={filteredDocs}
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
          showCost
          showPrice
        />
      )}
    </div>
  );
}
