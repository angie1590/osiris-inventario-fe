import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  FileDown,
  Sheet,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { DocumentDetailModal } from "@/features/inventory/DocumentDetailModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TablePagination } from "@/components/shared/TablePagination";
import {
  DateRangeFilter,
  type DateRange,
  currentMonthRange,
} from "@/features/reports/DateRangeFilter";
import {
  useConsolidado,
  useDailyClosing,
  useVentas,
  useStockReport,
  useStockValorizado,
} from "@/features/reports/hooks";
import { useCompanyConfig } from "@/features/admin/hooks";
import { useKardex } from "@/features/kardex/hooks";
import { useAuditUsers } from "@/features/audit/hooks";
import { useProducts } from "@/features/catalog/hooks";
import { PURCHASE_DOCUMENT_TYPE_LABELS } from "@/features/inventory/documentTypes";
import { useAuth } from "@/contexts/AuthContext";
import { downloadBlob } from "@/lib/download";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency as fmtCurrency, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  DocumentStatus,
  EgresoType,
  IngresoType,
  InventoryDocument,
} from "@/types/api";

type SortDirection = "asc" | "desc";
type ConsolidadoMetric = "quantity" | "monetary";
const TABLE_PAGE_SIZE = 10;
const MOVEMENT_TABLE_PAGE_SIZE = 8;
const USER_REPORT_PAGE_SIZE = 8;

function todayIsoDate() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatClosingDateTime(value: string) {
  return new Date(value).toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const STATUS_LABELS: Record<string, string> = {
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

const DOC_TYPE_LABELS: Record<string, string> = {
  IN: "Ingreso a Bodega",
  EG: "Egreso de Bodega",
  BI: "Baja de Inventario",
  AI: "Ajuste de Inventario",
};

const CONSOLIDADO_INGRESO_TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  initial_inventory: "Inventario inicial",
  adjustment_positive: "Ajuste positivo",
  customer_return: "Devolución de cliente",
  production: "Producción",
  transfer_received: "Transferencia recibida",
  other: "Otro",
};

const CONSOLIDADO_EGRESO_TYPE_LABELS: Record<string, string> = {
  sale: "Venta",
  baja: "Baja",
  adjustment_negative: "Ajuste negativo",
  supplier_return: "Devolución a proveedor",
  internal_consumption: "Consumo interno",
  transfer_sent: "Transferencia enviada",
  other: "Otro",
};

const INGRESO_TYPE_BADGE_CLASS: Record<IngresoType, string> = {
  purchase: "border-transparent bg-sky-100 text-sky-800",
  initial_inventory: "border-transparent bg-slate-100 text-slate-800",
  adjustment_positive: "border-transparent bg-emerald-100 text-emerald-800",
  customer_return: "border-transparent bg-amber-100 text-amber-800",
  production: "border-transparent bg-cyan-100 text-cyan-800",
  transfer_received: "border-transparent bg-indigo-100 text-indigo-800",
  other: "border-transparent bg-stone-100 text-stone-800",
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

const ALL_INGRESO_TYPES: IngresoType[] = [
  "purchase",
  "initial_inventory",
  "adjustment_positive",
  "customer_return",
  "production",
  "transfer_received",
  "other",
];

const ALL_EGRESO_TYPES: EgresoType[] = [
  "sale",
  "baja",
  "adjustment_negative",
  "supplier_return",
  "internal_consumption",
  "transfer_sent",
  "other",
];

function statusLabel(value: string | null | undefined) {
  if (!value) return "—";
  return STATUS_LABELS[value.toLowerCase()] ?? value;
}

function docTypeLabel(value: string | null | undefined) {
  if (!value) return "—";
  return DOC_TYPE_LABELS[value] ?? value;
}

function auditUserLabel(
  userId: number | null | undefined,
  users: Array<{ id: number; full_name: string; username: string }> | undefined,
) {
  if (!userId) return "—";
  const user = users?.find((item) => item.id === userId);
  if (!user) return `#${userId}`;
  return user.username;
}

function fileSafePart(
  value: string | null | undefined,
  fallback = "sin-nombre",
) {
  if (!value) return fallback;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function movementTotalItems(doc: InventoryDocument) {
  return doc.lines.length;
}

function movementTotalAmount(doc: InventoryDocument) {
  if (doc.doc_type === "EG" && doc.egreso_type === "sale") {
    return doc.lines.reduce((total, line) => {
      const quantity = Number(line.quantity || 0);
      const finalTotal = quantity * Number(line.unit_price || 0);
      const hasDiscountData =
        line.unit_price_base != null ||
        line.discount_type != null ||
        line.discount_value != null;
      if (!hasDiscountData) return total + finalTotal;

      const unitPriceBase = Number(
        line.unit_price_base ?? line.unit_price ?? 0,
      );
      const subtotal = quantity * unitPriceBase;
      const rawDiscountValue = Math.max(0, Number(line.discount_value || 0));
      const discount =
        line.discount_type === "percent"
          ? (subtotal * Math.min(rawDiscountValue, 100)) / 100
          : rawDiscountValue;
      return total + Math.max(0, subtotal - Math.min(subtotal, discount));
    }, 0);
  }

  return doc.lines.reduce(
    (total, line) =>
      total + Number(line.quantity || 0) * Number(line.unit_cost || 0),
    0,
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
      onClick={onClick}
    >
      <span>{label}</span>
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ChevronDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

function ExportIconButtons({
  onPdf,
  onExcel,
}: {
  onPdf: () => void;
  onExcel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onPdf}
        title="Exportar PDF"
        aria-label="Exportar PDF"
      >
        <FileDown className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onExcel}
        title="Exportar Excel"
        aria-label="Exportar Excel"
      >
        <Sheet className="h-4 w-4" />
      </Button>
    </div>
  );
}

function compareValue(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const av = String(a).toLocaleLowerCase("es-EC");
  const bv = String(b).toLocaleLowerCase("es-EC");
  return av.localeCompare(bv, "es-EC");
}

function ProductSearchCombobox({
  products,
  value,
  onChange,
  placeholder = "Seleccionar producto",
  includeAll = false,
}: {
  products: Array<{
    id: number;
    name: string;
    isbn?: string | null;
    codigo_interno?: string | null;
  }>;
  value?: number;
  onChange: (id: number | undefined) => void;
  placeholder?: string;
  includeAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const name = p.name.toLowerCase();
      const isbn = (p.isbn ?? "").toLowerCase();
      const internalCode = (p.codigo_interno ?? "").toLowerCase();
      return name.includes(q) || isbn.includes(q) || internalCode.includes(q);
    });
  }, [products, query]);

  const selected = value
    ? products.find((p) => p.id === value)?.name
    : includeAll
      ? "Todos los productos"
      : "";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-8 w-56 items-center justify-between whitespace-nowrap rounded-lg border border-input bg-white px-3 text-sm shadow-token-sm",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span className="truncate">{selected || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={cn(
            "w-(--radix-popover-trigger-width) rounded-md border bg-popover p-0 shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
          )}
          style={{ zIndex: 350 }}
          align="start"
          sideOffset={4}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setQuery(e.target.value)
              }
              placeholder="Buscar por nombre, cod. barras o cod. interno..."
              className="h-7 border-none p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {includeAll && (
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                  "cursor-pointer hover:bg-accent",
                  !value && "bg-primary/10 font-medium",
                )}
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                <span className="flex-1 truncate text-left">
                  Todos los productos
                </span>
                {!value && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                    "cursor-pointer hover:bg-accent",
                    value === p.id && "bg-primary/10 font-medium",
                  )}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate text-left">{p.name}</span>
                  {value === p.id && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ─── Movement report tabs (modelo consolidado: Ingresos/Egresos) ─────────────
const DOC_REPORT_TYPES: Array<{
  value: string;
  label: string;
  endpoint: string;
  prefix: string;
  supportsProductFilter: boolean;
}> = [
  {
    value: "ingresos",
    label: "Ingresos",
    endpoint: "/reports/ingresos",
    prefix: "ingresos",
    supportsProductFilter: true,
  },
  {
    value: "egresos",
    label: "Egresos",
    endpoint: "/reports/egresos",
    prefix: "egresos",
    supportsProductFilter: true,
  },
];

function MovementReport({
  endpoint,
  prefix,
  supportsProductFilter,
}: {
  endpoint: string;
  prefix: string;
  supportsProductFilter: boolean;
}) {
  const { toast } = useToast();
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const [productId, setProductId] = useState<number | undefined>();
  const [movementType, setMovementType] = useState<string | undefined>();
  const [userId, setUserId] = useState<number | undefined>();
  const [viewDocumentId, setViewDocumentId] = useState<number | null>(null);
  const { data: products } = useProducts({ status: "active" });
  const { data: users } = useAuditUsers();
  const { data: company } = useCompanyConfig();

  const endpointKey = endpoint.split("/").pop() ?? "ingresos";
  const movementTypeOptions = useMemo(() => {
    const isIngreso = endpointKey === "ingresos";
    const enabled = isIngreso
      ? company?.enabled_ingreso_types?.length
        ? company.enabled_ingreso_types
        : ALL_INGRESO_TYPES
      : company?.enabled_egreso_types?.length
        ? company.enabled_egreso_types
        : ALL_EGRESO_TYPES;
    const labels = isIngreso
      ? CONSOLIDADO_INGRESO_TYPE_LABELS
      : CONSOLIDADO_EGRESO_TYPE_LABELS;

    return [...enabled]
      .sort((a, b) => {
        const aOther = a === "other";
        const bOther = b === "other";
        if (aOther && !bOther) return 1;
        if (!aOther && bOther) return -1;
        return (labels[a] ?? a).localeCompare(labels[b] ?? b, "es-EC", {
          sensitivity: "base",
        });
      })
      .map((value) => ({ value, label: labels[value] ?? value }));
  }, [company, endpointKey]);
  const {
    data: rows,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "reports",
      "movement",
      endpoint,
      range,
      productId,
      userId,
      movementType,
    ],
    queryFn: async () => {
      const res = await api.get<InventoryDocument[]>(
        `/inventory/${endpointKey}`,
        {
          params: {
            date_from: range.date_from,
            date_to: range.date_to,
            type: movementType,
            product_id: supportsProductFilter ? productId : undefined,
            created_by: userId,
            limit: 100,
          },
        },
      );
      return res.data;
    },
    enabled: !!(range.date_from && range.date_to),
  });

  const { data: detailDoc, isLoading: detailLoading } = useQuery({
    queryKey: ["reports", "movement-detail", endpointKey, viewDocumentId],
    queryFn: async () => {
      const res = await api.get(`/inventory/${endpointKey}/${viewDocumentId}`);
      return res.data;
    },
    enabled: !!viewDocumentId,
  });

  const columns = useMemo<Column<InventoryDocument>[]>(() => {
    const userAccessor = (doc: InventoryDocument) =>
      auditUserLabel(doc.created_by, users);
    const hasProductFilter = Boolean(productId);
    const totalItemsAccessor = (doc: InventoryDocument) =>
      hasProductFilter ? null : movementTotalItems(doc);
    const totalAmountAccessor = (doc: InventoryDocument) =>
      hasProductFilter ? null : movementTotalAmount(doc);

    if (endpointKey === "ingresos") {
      return [
        {
          key: "number",
          header: "Número",
          sortable: true,
          sortAccessor: (d) => d.number,
          cell: (d) => <span className="font-mono text-sm">{d.number}</span>,
        },
        {
          key: "ingreso_type",
          header: "Tipo de ingreso",
          sortable: true,
          sortAccessor: (d) =>
            CONSOLIDADO_INGRESO_TYPE_LABELS[d.ingreso_type ?? "purchase"],
          cell: (d) => {
            const type = d.ingreso_type ?? "purchase";
            return (
              <Badge
                variant="outline"
                className={INGRESO_TYPE_BADGE_CLASS[type]}
              >
                {CONSOLIDADO_INGRESO_TYPE_LABELS[type]}
              </Badge>
            );
          },
        },
        {
          key: "supplier",
          header: "Proveedor",
          sortable: true,
          sortAccessor: (d) => d.supplier?.trade_name ?? "",
          cell: (d) => d.supplier?.trade_name || "—",
        },
        {
          key: "reference",
          header: "Referencia",
          sortable: true,
          sortAccessor: (d) => d.reference ?? "",
          cell: (d) => d.reference || "—",
        },
        {
          key: "created_by",
          header: "Usuario",
          sortable: true,
          sortAccessor: userAccessor,
          cell: (d) => userAccessor(d),
        },
        {
          key: "lines",
          header: "Total ítems",
          align: "center",
          sortable: true,
          sortAccessor: totalItemsAccessor,
          cell: (d) => (hasProductFilter ? "N/A" : movementTotalItems(d)),
        },
        {
          key: "total_amount",
          header: "Total ingreso",
          align: "right",
          sortable: true,
          sortAccessor: totalAmountAccessor,
          cell: (d) =>
            hasProductFilter ? "N/A" : fmtCurrency(movementTotalAmount(d)),
        },
        {
          key: "status",
          header: "Estado",
          sortable: true,
          sortAccessor: (d) => statusLabel(d.status),
          cell: (d) => (
            <Badge variant={STATUS_VARIANTS[d.status]}>
              {statusLabel(d.status)}
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
                onClick={() => setViewDocumentId(d.id)}
                title="Ver documento"
                aria-label="Ver documento"
              >
                <Eye className="h-4 w-4 text-primary" />
              </Button>
            </div>
          ),
        },
      ];
    }

    return [
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
        sortAccessor: (d) =>
          d.egreso_type ? CONSOLIDADO_EGRESO_TYPE_LABELS[d.egreso_type] : "",
        cell: (d) =>
          d.egreso_type ? (
            <Badge
              variant="outline"
              className={EGRESO_TYPE_BADGE_CLASS[d.egreso_type]}
            >
              {CONSOLIDADO_EGRESO_TYPE_LABELS[d.egreso_type]}
            </Badge>
          ) : (
            "—"
          ),
      },
      {
        key: "purchase_document_type",
        header: "Tipo documento",
        sortable: true,
        sortAccessor: (d) =>
          d.purchase_document_type
            ? PURCHASE_DOCUMENT_TYPE_LABELS[d.purchase_document_type]
            : "",
        cell: (d) =>
          d.purchase_document_type
            ? PURCHASE_DOCUMENT_TYPE_LABELS[d.purchase_document_type]
            : "—",
      },
      {
        key: "created_by",
        header: "Usuario",
        sortable: true,
        sortAccessor: userAccessor,
        cell: (d) => userAccessor(d),
      },
      {
        key: "lines",
        header: "Total ítems",
        align: "right",
        sortable: true,
        sortAccessor: totalItemsAccessor,
        cell: (d) => (hasProductFilter ? "N/A" : movementTotalItems(d)),
      },
      {
        key: "total_amount",
        header: "Total gasto",
        align: "right",
        sortable: true,
        sortAccessor: totalAmountAccessor,
        cell: (d) =>
          hasProductFilter ? "N/A" : fmtCurrency(movementTotalAmount(d)),
      },
      {
        key: "status",
        header: "Estado",
        sortable: true,
        sortAccessor: (d) => statusLabel(d.status),
        cell: (d) => (
          <Badge variant={STATUS_VARIANTS[d.status]}>
            {statusLabel(d.status)}
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
              onClick={() => setViewDocumentId(d.id)}
              title="Ver documento"
              aria-label="Ver documento"
            >
              <Eye className="h-4 w-4 text-primary" />
            </Button>
          </div>
        ),
      },
    ];
  }, [endpointKey, users, productId]);

  const handleExport = async (fmt: "pdf" | "excel") => {
    if (!range) return;
    try {
      const res = await api.get(endpoint, {
        params: {
          date_from: range.date_from,
          date_to: range.date_to,
          format: fmt,
          type: movementType,
          product_id: supportsProductFilter ? productId : undefined,
          created_by: userId,
        },
        responseType: "blob",
      });
      const selectedProductName =
        supportsProductFilter && productId
          ? products?.find((p) => p.id === productId)?.name
          : undefined;
      const selectedTypeLabel = movementTypeOptions.find(
        (option) => option.value === movementType,
      )?.label;
      const selectedUserName = userId
        ? users?.find((u) => u.id === userId)?.username
        : undefined;
      const productSuffix = selectedProductName
        ? `_producto-${fileSafePart(selectedProductName)}`
        : "";
      const typeSuffix = selectedTypeLabel
        ? `_tipo-${fileSafePart(selectedTypeLabel)}`
        : "";
      const userSuffix = selectedUserName
        ? `_usuario-${fileSafePart(selectedUserName)}`
        : "";
      downloadBlob(
        res,
        `${prefix}${typeSuffix}${productSuffix}${userSuffix}_${range.date_from}_${range.date_to}.${fmt === "pdf" ? "pdf" : "xlsx"}`,
      );
    } catch {
      toast({ variant: "destructive", description: "Error al exportar" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3">
        <DateRangeFilter onApply={setRange} />
        {supportsProductFilter && (
          <div className="space-y-1">
            <span className="text-xs font-medium">Producto (opcional)</span>
            <ProductSearchCombobox
              products={(products ?? []).map((p) => ({
                id: p.id,
                name: p.name,
                isbn: p.isbn,
                codigo_interno: p.codigo_interno,
              }))}
              value={productId}
              onChange={setProductId}
              includeAll
            />
          </div>
        )}
        <div className="space-y-1">
          <span className="text-xs font-medium">Tipo (opcional)</span>
          <Select
            value={movementType ?? "__all__"}
            onValueChange={(value) =>
              setMovementType(value === "__all__" ? undefined : value)
            }
          >
            <SelectTrigger className="h-8 w-56">
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los tipos</SelectItem>
              {movementTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium">Usuario (opcional)</span>
          <Select
            value={userId ? String(userId) : "__all__"}
            onValueChange={(v) =>
              setUserId(v === "__all__" ? undefined : Number(v))
            }
          >
            <SelectTrigger className="h-8 w-56">
              <SelectValue placeholder="Todos los usuarios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los usuarios</SelectItem>
              {(users ?? []).map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.full_name} ({u.username})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto self-end">
          <ExportIconButtons
            onPdf={() => handleExport("pdf")}
            onExcel={() => handleExport("excel")}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows ?? []}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        defaultSort={{ key: "created_at", dir: "desc" }}
        pageSize={MOVEMENT_TABLE_PAGE_SIZE}
        emptyHeading="Sin resultados"
        emptyDescription="No hay movimientos para el rango seleccionado."
      />

      {viewDocumentId &&
        (detailLoading || !detailDoc ? (
          <Dialog
            open
            onOpenChange={(open) => !open && setViewDocumentId(null)}
          >
            <DialogContent className="w-[min(1200px,calc(100vw-3rem))] max-h-[calc(100vh-3rem)] overflow-y-auto">
              <Skeleton className="h-48" />
            </DialogContent>
          </Dialog>
        ) : (
          <DocumentDetailModal
            doc={detailDoc}
            onClose={() => setViewDocumentId(null)}
            showCost
            showPrice={detailDoc.doc_type === "EG"}
          />
        ))}
    </div>
  );
}

// ─── Stock report ─────────────────────────────────────────────────────────────
function StockReport({
  quantityMode,
}: {
  quantityMode: "integer" | "decimal";
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canViewStockReports =
    user?.role === "admin" || user?.role === "supervisor";
  const [bajoStock, setBajoStock] = useState(false);
  const [stockValorizado, setStockValorizado] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "stock_actual" | "stock_minimo" | "cost" | "value"
  >("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [ctx, setCtx] = useState<{
    x: number;
    y: number;
    productId: number;
  } | null>(null);
  const {
    data: products,
    isLoading,
    isError,
    error,
    refetch,
  } = useStockReport(
    { bajo_stock: bajoStock || undefined },
    { enabled: canViewStockReports },
  );
  const { data: valorizadoData } = useStockValorizado(
    {},
    { enabled: canViewStockReports && stockValorizado },
  );

  useEffect(() => {
    const close = () => setCtx(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const setSort = (
    key: "name" | "stock_actual" | "stock_minimo" | "cost" | "value",
  ) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDirection("asc");
  };

  const visibleProducts = useMemo(() => {
    const valorizadoMap = new Map(
      (valorizadoData?.items ?? []).map((item) => [item.id, item]),
    );
    const q = search.trim().toLowerCase();
    const list = (products ?? [])
      .filter((p) => {
        if (!q) return true;
        return (
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.isbn ?? "").toLowerCase().includes(q) ||
          (p.codigo_interno ?? "").toLowerCase().includes(q)
        );
      })
      .map((p) => {
        const valorizado = valorizadoMap.get(p.id);
        return {
          ...p,
          cost: valorizado?.cost ?? null,
          value: valorizado?.value ?? null,
        };
      });

    const sortValue = (row: (typeof list)[number]) => {
      if (sortBy === "cost" || sortBy === "value") return row[sortBy];
      return row[sortBy];
    };

    list.sort((a, b) => {
      const cmp = compareValue(sortValue(a), sortValue(b));
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [products, search, sortBy, sortDirection, valorizadoData]);

  const stockValorizadoSummary = useMemo(() => {
    if (!stockValorizado) return null;
    const cantidadProductosDisponibles = visibleProducts.length;
    const totalItemsEnStock = visibleProducts.reduce(
      (sum, product) => sum + Number(product.stock_actual || 0),
      0,
    );
    const totalValorInventario = visibleProducts.reduce(
      (sum, product) => sum + Number(product.value || 0),
      0,
    );
    return {
      cantidadProductosDisponibles,
      totalItemsEnStock,
      totalValorInventario,
    };
  }, [stockValorizado, visibleProducts]);

  useEffect(() => {
    setPage(1);
  }, [search, bajoStock, stockValorizado, sortBy, sortDirection]);

  const totalRows = visibleProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * TABLE_PAGE_SIZE;
  const end = start + TABLE_PAGE_SIZE;
  const pagedProducts = visibleProducts.slice(start, end);
  const stockErrorStatus = (error as { response?: { status?: number } })
    ?.response?.status;
  const stockErrorMessage =
    stockErrorStatus === 401
      ? "Sesion expirada o no autorizada. Inicia sesion nuevamente."
      : getApiErrorMessage(error, "No se pudo cargar el reporte de stock.");

  if (!canViewStockReports) {
    return (
      <EmptyState
        className="py-10"
        heading="Sin acceso"
        description="Este reporte está disponible solo para administradores y supervisores."
      />
    );
  }

  const handleExport = async (fmt: "pdf" | "excel") => {
    try {
      const res = await api.get("/reports/stock", {
        params: { format: fmt, bajo_stock: bajoStock || undefined },
        responseType: "blob",
      });
      downloadBlob(res, `stock.${fmt === "pdf" ? "pdf" : "xlsx"}`);
    } catch {
      toast({ variant: "destructive", description: "Error al exportar" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Input
          placeholder="Buscar por producto, código de barras o código interno..."
          className="h-8 w-56"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={bajoStock}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setBajoStock(e.target.checked)
            }
          />
          Solo bajo stock
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={stockValorizado}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setStockValorizado(e.target.checked)
            }
          />
          Stock valorizado
        </label>
        <ExportIconButtons
          onPdf={() => handleExport("pdf")}
          onExcel={() => handleExport("excel")}
        />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {stockValorizadoSummary && (
            <div className="flex flex-wrap items-center justify-end gap-3 text-sm whitespace-nowrap">
              <span className="font-semibold text-foreground">
                Resumen global
              </span>
              <span className="font-medium text-foreground">
                Total productos:{" "}
                {formatQuantity(
                  stockValorizadoSummary.cantidadProductosDisponibles,
                  "integer",
                )}
              </span>
              <span className="font-medium text-foreground">
                Ítems en stock:{" "}
                {formatQuantity(
                  stockValorizadoSummary.totalItemsEnStock,
                  quantityMode,
                )}
              </span>
              <span className="font-medium text-foreground">
                Valor inventario:{" "}
                {fmtCurrency(stockValorizadoSummary.totalValorInventario)}
              </span>
            </div>
          )}
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <ErrorState
          className="py-10"
          message={stockErrorMessage}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Nombre"
                    active={sortBy === "name"}
                    direction={sortDirection}
                    onClick={() => setSort("name")}
                  />
                </TableHead>
                <TableHead className="text-center">
                  <SortableHeader
                    label="Stock actual"
                    active={sortBy === "stock_actual"}
                    direction={sortDirection}
                    onClick={() => setSort("stock_actual")}
                  />
                </TableHead>
                <TableHead className="text-center">
                  <SortableHeader
                    label="Stock mínimo"
                    active={sortBy === "stock_minimo"}
                    direction={sortDirection}
                    onClick={() => setSort("stock_minimo")}
                  />
                </TableHead>
                {stockValorizado && (
                  <>
                    <TableHead className="text-right">
                      <SortableHeader
                        label="Costo unit."
                        active={sortBy === "cost"}
                        direction={sortDirection}
                        onClick={() => setSort("cost")}
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        label="Valor total"
                        active={sortBy === "value"}
                        direction={sortDirection}
                        onClick={() => setSort("value")}
                      />
                    </TableHead>
                  </>
                )}
                <TableHead>Estado</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={stockValorizado ? 7 : 5} className="p-0">
                    <EmptyState
                      className="py-10"
                      heading="Sin resultados"
                      description="No hay productos para los filtros aplicados."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedProducts.map((p) => (
                  <TableRow
                    key={p.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtx({ x: e.clientX, y: e.clientY, productId: p.id });
                    }}
                  >
                    <TableCell>{p.name}</TableCell>
                    <TableCell
                      className={`text-center ${p.bajo_stock ? "text-destructive font-medium" : ""}`}
                    >
                      {formatQuantity(p.stock_actual, quantityMode)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatQuantity(p.stock_minimo, quantityMode)}
                    </TableCell>
                    {stockValorizado && (
                      <>
                        <TableCell className="text-right">
                          {p.cost == null ? "—" : fmtCurrency(p.cost)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {p.value == null ? "—" : fmtCurrency(p.value)}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Badge variant={p.bajo_stock ? "destructive" : "default"}>
                        {p.bajo_stock ? "Bajo stock" : "Normal"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/kardex/${p.id}`)}
                      >
                        Ver kardex
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {(totalRows > 0 || stockValorizadoSummary) && (
            <TablePagination
              page={currentPage}
              pageSize={TABLE_PAGE_SIZE}
              total={totalRows}
              totalPages={totalPages}
              onPageChange={setPage}
              className="border-t bg-muted/20 px-3 py-2"
            />
          )}
        </div>
      )}

      {ctx && (
        <div
          className="fixed rounded-md border bg-popover p-1 shadow-md"
          style={{ left: ctx.x, top: ctx.y, zIndex: 360 }}
        >
          <button
            type="button"
            className="rounded px-2 py-1 text-sm hover:bg-accent"
            onClick={() => {
              navigate(`/kardex/${ctx.productId}`);
              setCtx(null);
            }}
          >
            Ver kardex de este producto
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Stock valorizado ─────────────────────────────────────────────────────────
function StockValorizadoReport({
  quantityMode,
}: {
  quantityMode: "integer" | "decimal";
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canViewStockReports =
    user?.role === "admin" || user?.role === "supervisor";
  const { data, isLoading, isError, error, refetch } = useStockValorizado(
    {},
    { enabled: canViewStockReports },
  );
  const [sortBy, setSortBy] = useState<"name" | "stock" | "cost" | "value">(
    "name",
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  const setSort = (key: "name" | "stock" | "cost" | "value") => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDirection("asc");
  };

  const sortedItems = useMemo(() => {
    const items = [...(data?.items ?? [])];
    items.sort((a, b) => {
      const cmp = compareValue((a as any)[sortBy], (b as any)[sortBy]);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return items;
  }, [data?.items, sortBy, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [sortBy, sortDirection, data?.items]);

  const totalRows = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * TABLE_PAGE_SIZE;
  const end = start + TABLE_PAGE_SIZE;
  const pagedItems = sortedItems.slice(start, end);
  const stockValorizadoErrorStatus = (
    error as { response?: { status?: number } }
  )?.response?.status;
  const stockValorizadoErrorMessage =
    stockValorizadoErrorStatus === 401
      ? "Sesion expirada o no autorizada. Inicia sesion nuevamente."
      : getApiErrorMessage(
          error,
          "No se pudo cargar el reporte de stock valorizado.",
        );

  if (!canViewStockReports) {
    return (
      <EmptyState
        className="py-10"
        heading="Sin acceso"
        description="Este reporte está disponible solo para administradores y supervisores."
      />
    );
  }

  const handleExport = async (fmt: "pdf" | "excel") => {
    try {
      const res = await api.get("/reports/stock-valorizado", {
        params: { format: fmt },
        responseType: "blob",
      });
      downloadBlob(res, `stock-valorizado.${fmt === "pdf" ? "pdf" : "xlsx"}`);
    } catch {
      toast({ variant: "destructive", description: "Error al exportar" });
    }
  };

  if (isLoading) return <Skeleton className="h-48" />;
  if (isError) {
    return (
      <ErrorState
        className="py-10"
        message={stockValorizadoErrorMessage}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) {
    return (
      <EmptyState
        className="py-10"
        heading="Sin datos disponibles"
        description="No hay informacion de valorizacion para mostrar."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportIconButtons
          onPdf={() => handleExport("pdf")}
          onExcel={() => handleExport("excel")}
        />
      </div>
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Valor total del inventario
          </p>
          <p className="text-3xl font-bold">{fmtCurrency(data.total_value)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Método: {data.method}
          </p>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortableHeader
                  label="Producto"
                  active={sortBy === "name"}
                  direction={sortDirection}
                  onClick={() => setSort("name")}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Stock"
                  active={sortBy === "stock"}
                  direction={sortDirection}
                  onClick={() => setSort("stock")}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Costo unit."
                  active={sortBy === "cost"}
                  direction={sortDirection}
                  onClick={() => setSort("cost")}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Valor total"
                  active={sortBy === "value"}
                  direction={sortDirection}
                  onClick={() => setSort("value")}
                />
              </TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    className="py-10"
                    heading="Sin productos valorizados"
                    description="No hay productos con costo para el calculo valorizado."
                  />
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">
                    {formatQuantity(item.stock, quantityMode)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtCurrency(item.cost)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fmtCurrency(item.value)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/kardex/${item.id}`)}
                    >
                      Ver kardex
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {totalRows > 0 && (
          <TablePagination
            page={currentPage}
            pageSize={TABLE_PAGE_SIZE}
            total={totalRows}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

// ─── Kardex exportable ────────────────────────────────────────────────────────
function KardexReport({
  quantityMode,
}: {
  quantityMode: "integer" | "decimal";
}) {
  const [sortBy, setSortBy] = useState<
    "created_at" | "quantity_in" | "quantity_out" | "balance_quantity"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [productId, setProductId] = useState<number | undefined>();
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const [page, setPage] = useState(1);
  const { data: products } = useProducts({ status: "active" });
  const {
    data: kardex,
    isLoading,
    isError,
    refetch,
  } = useKardex(productId ?? 0, range.date_from, range.date_to);

  const setSort = (
    key: "created_at" | "quantity_in" | "quantity_out" | "balance_quantity",
  ) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDirection("asc");
  };

  const sortedEntries = useMemo(() => {
    const list = [...(kardex?.entries ?? [])];
    list.sort((a, b) => {
      const cmp = compareValue((a as any)[sortBy], (b as any)[sortBy]);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [kardex?.entries, sortBy, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [
    productId,
    range.date_from,
    range.date_to,
    sortBy,
    sortDirection,
    kardex?.entries,
  ]);

  const totalRows = sortedEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * TABLE_PAGE_SIZE;
  const end = start + TABLE_PAGE_SIZE;
  const pagedEntries = sortedEntries.slice(start, end);

  const { toast } = useToast();

  const handleExport = async (fmt: "pdf" | "excel") => {
    if (!productId) {
      toast({
        variant: "warning",
        description: "Selecciona un producto para exportar.",
      });
      return;
    }
    try {
      const res = await api.get("/reports/kardex", {
        params: {
          product_id: productId,
          date_from: range.date_from,
          date_to: range.date_to,
          format: fmt,
        },
        responseType: "blob",
      });
      const selectedProductName = products?.find(
        (p) => p.id === productId,
      )?.name;
      const productSuffix = fileSafePart(selectedProductName, "producto");
      downloadBlob(
        res,
        `kardex_${productSuffix}_${range.date_from}_${range.date_to}.${fmt === "pdf" ? "pdf" : "xlsx"}`,
      );
    } catch {
      toast({
        variant: "destructive",
        description: "Error al exportar kardex",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <span className="text-xs font-medium">Producto</span>
          <ProductSearchCombobox
            products={(products ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              isbn: p.isbn,
              codigo_interno: p.codigo_interno,
            }))}
            value={productId}
            onChange={setProductId}
          />
        </div>
        <DateRangeFilter onApply={setRange} defaultValues={range} />
        <div className="ml-auto">
          <ExportIconButtons
            onPdf={() => handleExport("pdf")}
            onExcel={() => handleExport("excel")}
          />
        </div>
      </div>

      {!productId && (
        <EmptyState
          className="py-10"
          heading="Selecciona un producto"
          description="Elige un producto para consultar el kardex en el periodo seleccionado."
        />
      )}

      {productId && isLoading && <Skeleton className="h-48" />}
      {productId && isError && (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el kardex del producto seleccionado."
          onRetry={() => void refetch()}
        />
      )}

      {productId && kardex && !isError && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Fecha"
                    active={sortBy === "created_at"}
                    direction={sortDirection}
                    onClick={() => setSort("created_at")}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Entrada"
                    active={sortBy === "quantity_in"}
                    direction={sortDirection}
                    onClick={() => setSort("quantity_in")}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Salida"
                    active={sortBy === "quantity_out"}
                    direction={sortDirection}
                    onClick={() => setSort("quantity_out")}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Saldo"
                    active={sortBy === "balance_quantity"}
                    direction={sortDirection}
                    onClick={() => setSort("balance_quantity")}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      className="py-10"
                      heading="Sin movimientos"
                      description="No se encontraron movimientos para este producto y periodo."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.created_at).toLocaleDateString("es-EC")}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.quantity_in
                        ? formatQuantity(entry.quantity_in, quantityMode)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.quantity_out
                        ? formatQuantity(entry.quantity_out, quantityMode)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatQuantity(entry.balance_quantity, quantityMode)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalRows > 0 && (
            <TablePagination
              page={currentPage}
              pageSize={TABLE_PAGE_SIZE}
              total={totalRows}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Movimientos por usuario ──────────────────────────────────────────────────
function MovimientosPorUsuarioReport({}: {}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const [userId, setUserId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<
    "number" | "doc_type" | "status" | "reference" | "created_at"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewDocumentId, setViewDocumentId] = useState<number | null>(null);
  const { data: users } = useAuditUsers();
  const selectedUserId = userId ?? user?.id;

  const {
    data: rows,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["reports", "movimientos-por-usuario", range, selectedUserId],
    queryFn: async () => {
      const res = await api.get<
        Array<{
          id: number;
          number: string;
          doc_type: string;
          status: string;
          reference: string | null;
          created_at: string;
        }>
      >("/reports/movimientos-por-usuario", {
        params: {
          date_from: range.date_from,
          date_to: range.date_to,
          user_id: selectedUserId,
          format: "json",
        },
      });
      return res.data;
    },
    enabled: !!selectedUserId,
  });

  const { data: detailDoc, isLoading: detailLoading } = useQuery({
    queryKey: ["reports", "movimientos-usuario-detail", viewDocumentId],
    queryFn: async () => {
      if (!viewDocumentId || !rows) return null;
      const row = rows.find((r) => r.id === viewDocumentId);
      if (!row) return null;
      const map: Record<string, string> = {
        IN: "ingresos",
        EG: "egresos",
      };
      const endpoint = map[row.doc_type];
      if (!endpoint) return null;
      const res = await api.get(`/inventory/${endpoint}/${viewDocumentId}`);
      return res.data;
    },
    enabled: !!viewDocumentId,
  });

  const sortedRows = useMemo(() => {
    const list = [...(rows ?? [])];
    list.sort((a, b) => {
      const cmp = compareValue((a as any)[sortBy], (b as any)[sortBy]);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, sortBy, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [
    selectedUserId,
    range.date_from,
    range.date_to,
    sortBy,
    sortDirection,
    rows,
  ]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / USER_REPORT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * USER_REPORT_PAGE_SIZE;
  const end = start + USER_REPORT_PAGE_SIZE;
  const pagedRows = sortedRows.slice(start, end);

  const setSort = (
    key: "number" | "doc_type" | "status" | "reference" | "created_at",
  ) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDirection("asc");
  };

  const handleExport = async (fmt: "pdf" | "excel") => {
    if (!selectedUserId) {
      toast({
        variant: "warning",
        description: "Selecciona un usuario para exportar.",
      });
      return;
    }

    try {
      const res = await api.get("/reports/movimientos-por-usuario", {
        params: {
          date_from: range.date_from,
          date_to: range.date_to,
          user_id: selectedUserId,
          format: fmt,
        },
        responseType: "blob",
      });
      const selectedUser = users?.find((u) => u.id === selectedUserId);
      const userSuffix = fileSafePart(
        selectedUser?.username || selectedUser?.full_name,
        "usuario",
      );
      downloadBlob(
        res,
        `movimientos_usuario_${userSuffix}_${range.date_from}_${range.date_to}.${fmt === "pdf" ? "pdf" : "xlsx"}`,
      );
    } catch {
      toast({ variant: "destructive", description: "Error al exportar" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3">
        <DateRangeFilter
          onApply={setRange}
          defaultValues={range}
          afterApplySlot={
            <div className="space-y-1">
              <span className="text-xs font-medium">Usuario</span>
              <Select
                value={selectedUserId ? String(selectedUserId) : "__none__"}
                onValueChange={(v) =>
                  setUserId(v === "__none__" ? undefined : Number(v))
                }
              >
                <SelectTrigger className="h-8 w-56">
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleccionar usuario</SelectItem>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.full_name} ({u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
        <div className="ml-auto self-end">
          <ExportIconButtons
            onPdf={() => handleExport("pdf")}
            onExcel={() => handleExport("excel")}
          />
        </div>
      </div>

      {!selectedUserId ? (
        <EmptyState
          className="py-10"
          heading="Selecciona un usuario"
          description="Debes elegir un usuario para consultar sus movimientos."
        />
      ) : isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el reporte por usuario."
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Número"
                    active={sortBy === "number"}
                    direction={sortDirection}
                    onClick={() => setSort("number")}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Tipo"
                    active={sortBy === "doc_type"}
                    direction={sortDirection}
                    onClick={() => setSort("doc_type")}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Estado"
                    active={sortBy === "status"}
                    direction={sortDirection}
                    onClick={() => setSort("status")}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Referencia"
                    active={sortBy === "reference"}
                    direction={sortDirection}
                    onClick={() => setSort("reference")}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Fecha"
                    active={sortBy === "created_at"}
                    direction={sortDirection}
                    onClick={() => setSort("created_at")}
                  />
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      className="py-10"
                      heading="Sin movimientos"
                      description="No hay movimientos para este usuario en el rango seleccionado."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">
                      {r.number}
                    </TableCell>
                    <TableCell>{docTypeLabel(r.doc_type)}</TableCell>
                    <TableCell>{statusLabel(r.status)}</TableCell>
                    <TableCell>{r.reference || "—"}</TableCell>
                    <TableCell>
                      {new Date(r.created_at).toLocaleDateString("es-EC")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={r.doc_type !== "IN" && r.doc_type !== "EG"}
                        onClick={() => setViewDocumentId(r.id)}
                        title="Ver documento"
                        aria-label="Ver documento"
                      >
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalRows > 0 && (
            <TablePagination
              page={currentPage}
              pageSize={USER_REPORT_PAGE_SIZE}
              total={totalRows}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {viewDocumentId &&
        (detailLoading || !detailDoc ? (
          <Dialog
            open
            onOpenChange={(open) => !open && setViewDocumentId(null)}
          >
            <DialogContent className="w-[min(1200px,calc(100vw-3rem))] max-h-[calc(100vh-3rem)] overflow-y-auto">
              <Skeleton className="h-48" />
            </DialogContent>
          </Dialog>
        ) : (
          <DocumentDetailModal
            doc={detailDoc}
            onClose={() => setViewDocumentId(null)}
            showCost
            showPrice={detailDoc.doc_type === "EG"}
          />
        ))}
    </div>
  );
}

// ─── Consolidado ──────────────────────────────────────────────────────────────
function ConsolidadoReport() {
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const { data, isLoading, isError, error, refetch } = useConsolidado(range);
  const { toast } = useToast();
  const errorMessage = getApiErrorMessage(
    error,
    "No se pudo cargar el reporte consolidado.",
    {
      COMPANY_NOT_CONFIGURED:
        "Configura los datos de la empresa antes de generar reportes.",
    },
  );

  const visibleMovements = useMemo(
    () => ({ IN: data?.movements?.IN ?? 0, EG: data?.movements?.EG ?? 0 }),
    [data],
  );

  const statusSummary = data?.status_summary ?? {};
  const pendingCount = statusSummary.pending ?? 0;
  const approvedCount = statusSummary.approved ?? 0;
  const cancelledCount = statusSummary.cancelled ?? 0;
  const voidedCount = statusSummary.voided ?? 0;
  const totalMovements =
    data?.total_movements ?? visibleMovements.IN + visibleMovements.EG;
  const visibleAmounts = useMemo(
    () => ({
      IN: data?.movements_amount?.IN ?? 0,
      EG: data?.movements_amount?.EG ?? 0,
    }),
    [data],
  );
  const totalMovementsAmount =
    data?.total_movements_amount ?? visibleAmounts.IN + visibleAmounts.EG;
  const [metric, setMetric] = useState<ConsolidadoMetric>("quantity");
  const netFlow = visibleMovements.IN - visibleMovements.EG;
  const metricLabel = metric === "quantity" ? "Cantidad" : "Monetario";
  const metricUnitLabel = metric === "quantity" ? "movimientos" : "";

  const ingresoChartData = useMemo(() => {
    const ingresos = data?.movements_by_type?.ingresos ?? {};
    const ingresosAmount = data?.movements_amount_by_type?.ingresos ?? {};
    const types = new Set([
      ...Object.keys(ingresos),
      ...Object.keys(ingresosAmount),
    ]);
    return [...types]
      .map((type) => {
        const quantity = ingresos[type] ?? 0;
        const monetary = ingresosAmount[type] ?? 0;
        return {
          type,
          label: CONSOLIDADO_INGRESO_TYPE_LABELS[type] ?? type,
          quantity,
          monetary,
          value: metric === "quantity" ? quantity : monetary,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [data, metric]);

  const egresoChartData = useMemo(() => {
    const egresos = data?.movements_by_type?.egresos ?? {};
    const egresosAmount = data?.movements_amount_by_type?.egresos ?? {};
    const types = new Set([
      ...Object.keys(egresos),
      ...Object.keys(egresosAmount),
    ]);
    return [...types]
      .map((type) => {
        const quantity = egresos[type] ?? 0;
        const monetary = egresosAmount[type] ?? 0;
        return {
          type,
          label: CONSOLIDADO_EGRESO_TYPE_LABELS[type] ?? type,
          quantity,
          monetary,
          value: metric === "quantity" ? quantity : monetary,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [data, metric]);

  const topIngreso = ingresoChartData[0];
  const topEgreso = egresoChartData[0];
  const reportTotal =
    metric === "quantity" ? totalMovements : totalMovementsAmount;

  const reportRows = useMemo(() => {
    const rows = new Map<
      string,
      {
        type: string;
        label: string;
        ingresosQuantity: number;
        egresosQuantity: number;
        ingresosMonetary: number;
        egresosMonetary: number;
      }
    >();

    for (const row of ingresoChartData) {
      const current = rows.get(row.type) ?? {
        type: row.type,
        label: row.label,
        ingresosQuantity: 0,
        egresosQuantity: 0,
        ingresosMonetary: 0,
        egresosMonetary: 0,
      };
      current.ingresosQuantity = row.quantity;
      current.ingresosMonetary = row.monetary;
      rows.set(row.type, current);
    }

    for (const row of egresoChartData) {
      const current = rows.get(row.type) ?? {
        type: row.type,
        label: row.label,
        ingresosQuantity: 0,
        egresosQuantity: 0,
        ingresosMonetary: 0,
        egresosMonetary: 0,
      };
      current.egresosQuantity = row.quantity;
      current.egresosMonetary = row.monetary;
      rows.set(row.type, current);
    }

    return [...rows.values()]
      .map((row) => ({
        ...row,
        displayIngresos:
          metric === "quantity" ? row.ingresosQuantity : row.ingresosMonetary,
        displayEgresos:
          metric === "quantity" ? row.egresosQuantity : row.egresosMonetary,
      }))
      .sort(
        (a, b) =>
          b.displayIngresos +
          b.displayEgresos -
          (a.displayIngresos + a.displayEgresos),
      );
  }, [egresoChartData, ingresoChartData, metric]);

  const formatMetricValue = (value: number) =>
    metric === "quantity"
      ? formatQuantity(value, "integer")
      : fmtCurrency(value);

  const handleExport = async (fmt: "pdf" | "excel") => {
    try {
      const res = await api.get("/reports/consolidado", {
        params: {
          date_from: range.date_from,
          date_to: range.date_to,
          format: fmt,
          metric,
        },
        responseType: "blob",
      });
      downloadBlob(
        res,
        `consolidado_${metric}_${range.date_from}_${range.date_to}.${fmt === "pdf" ? "pdf" : "xlsx"}`,
      );
    } catch {
      toast({
        variant: "destructive",
        description: "Error al exportar consolidado",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3">
        <DateRangeFilter onApply={setRange} defaultValues={range} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border bg-muted p-1 text-sm">
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 transition",
                metric === "quantity"
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground",
              )}
              onClick={() => setMetric("quantity")}
            >
              Cantidad
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 transition",
                metric === "monetary"
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground",
              )}
              onClick={() => setMetric("monetary")}
            >
              Monetario
            </button>
          </div>
          <ExportIconButtons
            onPdf={() => handleExport("pdf")}
            onExcel={() => handleExport("excel")}
          />
        </div>
      </div>
      {isLoading && <Skeleton className="h-48" />}
      {isError && (
        <ErrorState
          className="py-10"
          message={errorMessage}
          onRetry={() => void refetch()}
        />
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">
                  Movimientos totales
                </p>
                <div className="mt-1 text-right">
                  <p className="text-2xl font-bold">{totalMovements}</p>
                  <p className="text-xs text-muted-foreground">
                    IN: {visibleMovements.IN} | EG: {visibleMovements.EG}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">
                  Balance operativo
                </p>
                <div className="mt-1 text-right">
                  <p
                    className={`text-2xl font-bold ${
                      netFlow >= 0 ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {netFlow >= 0 ? "+" : ""}
                    {netFlow}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Diferencia entre ingresos y egresos
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">
                  Pendientes de aprobacion
                </p>
                <div className="mt-1 text-right">
                  <p className="text-2xl font-bold text-amber-700">
                    {pendingCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cancelados/anulados: {cancelledCount + voidedCount}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">
                  Documentos aprobados
                </p>
                <div className="mt-1 text-right">
                  <p className="text-2xl font-bold">{approvedCount}</p>
                  <p className="text-xs text-muted-foreground">
                    de {totalMovements} movimientos en el periodo
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Productos activos
                </p>
                <p className="mt-1 text-right text-2xl font-bold">
                  {data.active_products}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Bajo stock</p>
                <p className="mt-1 text-right text-2xl font-bold text-destructive">
                  {data.products_below_minimum}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Ingreso dominante
                </p>
                <div className="mt-1 text-right">
                  <p className="text-lg font-semibold truncate">
                    {topIngreso?.label ?? "Sin datos"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {topIngreso
                      ? `${formatMetricValue(topIngreso.value)}${metricUnitLabel ? ` ${metricUnitLabel}` : ""}`
                      : "Sin datos"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Egreso dominante
                </p>
                <div className="mt-1 text-right">
                  <p className="text-lg font-semibold truncate">
                    {topEgreso?.label ?? "Sin datos"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {topEgreso
                      ? `${formatMetricValue(topEgreso.value)}${metricUnitLabel ? ` ${metricUnitLabel}` : ""}`
                      : "Sin datos"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Tipos de ingreso</p>
                <p className="text-xs text-muted-foreground">
                  {topIngreso ? `Dominante: ${topIngreso.label}` : "Sin datos"}
                </p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {metric === "quantity"
                  ? "Cantidad de documentos por cada tipo de ingreso."
                  : "Valor monetario por cada tipo de ingreso."}
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={ingresoChartData}
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    allowDecimals={metric !== "quantity"}
                    width={110}
                    tickMargin={8}
                    tickFormatter={(value) => formatMetricValue(Number(value))}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatMetricValue(Number(value)),
                      metricLabel,
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    name={metricLabel}
                    fill="#7b963f"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Tipos de egreso</p>
                <p className="text-xs text-muted-foreground">
                  {topEgreso ? `Dominante: ${topEgreso.label}` : "Sin datos"}
                </p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {metric === "quantity"
                  ? "Cantidad de documentos por cada tipo de egreso."
                  : "Valor monetario por cada tipo de egreso."}
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={egresoChartData}
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    allowDecimals={metric !== "quantity"}
                    width={110}
                    tickMargin={8}
                    tickFormatter={(value) => formatMetricValue(Number(value))}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatMetricValue(Number(value)),
                      metricLabel,
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    name={metricLabel}
                    fill="#e67600"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">
                    {metric === "quantity" ? "Ingresos" : "Monto ingresos"}
                  </TableHead>
                  <TableHead className="text-center">
                    {metric === "quantity" ? "Egresos" : "Monto egresos"}
                  </TableHead>
                  <TableHead className="text-center">
                    {metric === "quantity" ? "Total" : "Monto total"}
                  </TableHead>
                  <TableHead className="text-center">Participacion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map((row) => {
                  const total =
                    metric === "quantity"
                      ? row.ingresosQuantity + row.egresosQuantity
                      : row.ingresosMonetary + row.egresosMonetary;
                  const participation =
                    reportTotal > 0
                      ? ((total / reportTotal) * 100).toFixed(1)
                      : "0.0";

                  return (
                    <TableRow key={row.type}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-center">
                        {formatMetricValue(row.displayIngresos)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatMetricValue(row.displayEgresos)}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {formatMetricValue(total)}
                      </TableCell>
                      <TableCell className="text-center">
                        {participation}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/*
function VentasReport() {
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const { data, isLoading, isError, refetch } = useVentas(range);

  const summary = data?.summary ?? {
    sales_total: 0,
    sales_count: 0,
    purchase_total: 0,
    purchase_count: 0,
    utility: 0,
    commission_percent: 0,
    commission_total: 0,
  };
  const dailyClosings = data?.daily_closings ?? [];
function currentYearRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear(), 11, 31);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}

function monthName(monthIndex: number, year: number) {
  const label = new Date(year, monthIndex, 1).toLocaleDateString("es-EC", {
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

  const salesBySeller = data?.sales_by_seller ?? [];
  const range = useMemo(() => currentYearRange(), []);

  const timelineData = useMemo(
  const year = Number(range.date_from.slice(0, 4));

  const salesBySeller = useMemo(
    () =>
      [...(data?.sales_by_seller ?? [])].sort(
        (a, b) => b.sales_total - a.sales_total,
      ),
    [data?.sales_by_seller],
  );

  const commissionsByMonth = data?.commissions_by_month ?? [];

  const sellers = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const row of salesBySeller) {
      if (!seen.has(row.seller_name)) {
        seen.add(row.seller_name);
        ordered.push(row.seller_name);
      }
    }

    for (const row of commissionsByMonth) {
      if (!seen.has(row.seller_name)) {
        seen.add(row.seller_name);
        ordered.push(row.seller_name);
      }
    }

    return ordered;
  }, [commissionsByMonth, salesBySeller]);

  const matrix = useMemo(() => {
    const cells = new Map<
      string,
      { sales_total: number; commission_amount: number }
    >();

    for (const row of commissionsByMonth) {
      cells.set(`${row.month}|${row.seller_name}`, {
        sales_total: row.sales_total,
        commission_amount: row.commission_amount,
      });
    }

    const rows = Array.from({ length: 12 }, (_, monthIndex) => {
      const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const sellerCells = sellers.map(
        (seller) =>
          cells.get(`${month}|${seller}`) ?? {
            sales_total: 0,
            commission_amount: 0,
          },
      );
      const totalSales = sellerCells.reduce(
        (total, cell) => total + cell.sales_total,
        0,
      );

      return {
        label: monthName(monthIndex, year),
        sellerCells,
        totalSales,
      };
    });

    const sellerTotals = sellers.map((_, index) =>
      rows.reduce(
        (total, row) => total + row.sellerCells[index].sales_total,
        0,
      ),
    );
    const sellerCommissions = sellers.map((_, index) =>
      rows.reduce(
        (total, row) => total + row.sellerCells[index].commission_amount,
        0,
      ),
    );

    const grandTotalSales = rows.reduce(
      (total, row) => total + row.totalSales,
      0,
    );
    const grandTotalCommission = sellerCommissions.reduce(
      (total, value) => total + value,
      0,
    );

    return {
      rows,
      sellerTotals,
      sellerCommissions,
      grandTotalSales,
      grandTotalCommission,
    };
  }, [commissionsByMonth, sellers, year]);
      </div>
    const year = Number(range.date_from.slice(0, 4));

          message="No se pudo cargar el reporte de ventas."
          onRetry={() => void refetch()}
        />
      )}
          message="No se pudo cargar el reporte por vendedor."

    const sellers = useMemo(() => {
      const ordered: string[] = [];
      const seen = new Set<string>();

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Ventas por vendedor</p>
              <p className="text-xs text-muted-foreground">
                Año calendario {year}. Ventas mensuales por vendedor, total por
                columna y comisiones al final.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-36">Mes</TableHead>
                  {sellers.map((seller) => (
                    <TableHead key={seller} className="min-w-32 text-right">
                      {seller}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-32 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Sin datos
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {matrix.rows.map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        {row.sellerCells.map((cell, index) => (
                          <TableCell
                            key={`${row.label}-${sellers[index]}`}
                            className="text-right tabular-nums"
                          >
                            {fmtCurrency(cell.sales_total)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums font-medium">
                          {fmtCurrency(row.totalSales)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t bg-muted/40">
                      <TableCell className="font-semibold">Total</TableCell>
                      {matrix.sellerTotals.map((total, index) => (
                        <TableCell
                          key={`total-${sellers[index]}`}
                          className="text-right tabular-nums font-semibold"
                        >
                          {fmtCurrency(total)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums font-semibold">
                        {fmtCurrency(matrix.grandTotalSales)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/20">
                      <TableCell className="font-semibold">Comisiones</TableCell>
                      {matrix.sellerCommissions.map((total, index) => (
                        <TableCell
                          key={`commission-${sellers[index]}`}
                          className="text-right tabular-nums font-semibold"
                        >
                          {fmtCurrency(total)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums font-semibold">
                        {fmtCurrency(matrix.grandTotalCommission)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
                  <p
                    className="truncate text-lg font-bold"
                    title={topSeller?.seller_name}
                  >
                    {topSeller?.seller_name ?? "Sin datos"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {topSeller ? fmtCurrency(topSeller.sales_total) : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Comparativa de ventas por vendedor
                </p>
                <p className="text-xs text-muted-foreground">
                  Ranking por total vendido
                </p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={comparisonData}
                  margin={{ top: 8, right: 16, left: 24, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="short_name"
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                    height={58}
                  />
                  <YAxis
                    width={96}
                    tickFormatter={(value) => fmtCurrency(Number(value))}
                  />
                  <Tooltip
                    formatter={(value) => [
                      fmtCurrency(Number(value)),
                      "Ventas",
                    ]}
                    labelFormatter={(value, payload) => {
                      const item = payload?.[0]?.payload as
                        | { seller_name?: string }
                        | undefined;
                      return item?.seller_name ?? String(value);
                    }}
                  />
                  <Bar
                    dataKey="sales_total"
                    fill="#7b963f"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Ticket promedio y comisión
                </p>
                <p className="text-xs text-muted-foreground">
                  Comparativa monetaria por vendedor
                </p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={comparisonData}
                  margin={{ top: 8, right: 16, left: 24, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="short_name"
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                    height={58}
                  />
                  <YAxis
                    width={96}
                    tickFormatter={(value) => fmtCurrency(Number(value))}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      fmtCurrency(Number(value)),
                      name === "avg_ticket" ? "Ticket promedio" : "Comisión",
                    ]}
                    labelFormatter={(value, payload) => {
                      const item = payload?.[0]?.payload as
                        | { seller_name?: string }
                        | undefined;
                      return item?.seller_name ?? String(value);
                    }}
                  />
                  <Bar
                    dataKey="avg_ticket"
                    fill="#0ea5e9"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="commission_amount"
                    fill="#f59e0b"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                Tabla comparativa de vendedores
              </p>
              <p className="text-xs text-muted-foreground">
                Mayor comisión:{" "}
                {topCommissionSeller?.seller_name ?? "Sin datos"}
              </p>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">#</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-center">Docs.</TableHead>
                    <TableHead className="text-right">Ticket prom.</TableHead>
                    <TableHead className="text-center">Participación</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground"
                      >
                        Sin datos
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparisonData.map((row, index) => (
                      <TableRow key={row.seller_name}>
                        <TableCell className="text-center tabular-nums">
                          {index + 1}
                        </TableCell>
                        <TableCell>{row.seller_name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtCurrency(row.sales_total)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {formatQuantity(row.sales_count, "integer")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtCurrency(row.avg_ticket)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {row.participation.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtCurrency(row.commission_amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

*/

function VentasReport() {
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const { data, isLoading, isError, refetch } = useVentas(range);

  const summary = data?.summary ?? {
    sales_total: 0,
    sales_count: 0,
    purchase_total: 0,
    purchase_count: 0,
    utility: 0,
    commission_percent: 0,
    commission_total: 0,
  };
  const dailyClosings = data?.daily_closings ?? [];
  const salesBySeller = data?.sales_by_seller ?? [];
  const commissionsByMonth = data?.commissions_by_month ?? [];

  const timelineData = useMemo(
    () =>
      dailyClosings.map((row) => ({
        ...row,
        label: new Date(`${row.date}T00:00:00`).toLocaleDateString("es-EC", {
          day: "2-digit",
          month: "2-digit",
        }),
      })),
    [dailyClosings],
  );

  const formatMonthLabel = (value: string) =>
    new Date(`${value}-01T00:00:00`).toLocaleDateString("es-EC", {
      month: "short",
      year: "numeric",
    });

  const utilityClass =
    summary.utility >= 0 ? "text-emerald-700" : "text-amber-700";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3">
        <DateRangeFilter onApply={setRange} defaultValues={range} />
      </div>
      {isLoading && <Skeleton className="h-48" />}
      {isError && (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el reporte de ventas."
          onRetry={() => void refetch()}
        />
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Ventas
                </p>
                <div className="mt-1 text-right">
                  <p className="text-2xl font-bold">
                    {fmtCurrency(summary.sales_total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatQuantity(summary.sales_count, "integer")} ventas
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Compras
                </p>
                <div className="mt-1 text-right">
                  <p className="text-2xl font-bold">
                    {fmtCurrency(summary.purchase_total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatQuantity(summary.purchase_count, "integer")} compras
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Utilidad
                </p>
                <div className="mt-1 text-right">
                  <p className={`text-2xl font-bold ${utilityClass}`}>
                    {fmtCurrency(summary.utility)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ventas - Compras
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Comisión total
                </p>
                <div className="mt-1 text-right">
                  <p className="text-2xl font-bold">
                    {fmtCurrency(summary.commission_total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tasa global {summary.commission_percent.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Cierres diarios de ventas</p>
              <p className="text-xs text-muted-foreground">
                Total vendido por día en el periodo
              </p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={timelineData}
                margin={{ top: 8, right: 16, left: 24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(`${value}T00:00:00`).toLocaleDateString("es-EC", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  }
                />
                <YAxis
                  width={96}
                  tickFormatter={(value) => fmtCurrency(Number(value))}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(`${String(value)}T00:00:00`).toLocaleDateString(
                      "es-EC",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      },
                    )
                  }
                  formatter={(value) => [fmtCurrency(Number(value)), "Ventas"]}
                />
                <Line
                  type="monotone"
                  dataKey="sales_total"
                  stroke="#7b963f"
                  strokeWidth={3}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Ventas por vendedor</p>
                <p className="text-xs text-muted-foreground">
                  Periodo seleccionado
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-center">Docs.</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesBySeller.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          Sin datos
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesBySeller.map((row) => (
                        <TableRow key={row.seller_name}>
                          <TableCell>{row.seller_name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtCurrency(row.sales_total)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {formatQuantity(row.sales_count, "integer")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtCurrency(row.commission_amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  Comisión mensual por vendedor
                </p>
                <p className="text-xs text-muted-foreground">
                  Total por mes y vendedor
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionsByMonth.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          Sin datos
                        </TableCell>
                      </TableRow>
                    ) : (
                      commissionsByMonth.map((row) => (
                        <TableRow key={`${row.month}-${row.seller_name}`}>
                          <TableCell>{formatMonthLabel(row.month)}</TableCell>
                          <TableCell>{row.seller_name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtCurrency(row.sales_total)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {row.commission_percent.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtCurrency(row.commission_amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function currentYearRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear(), 11, 31);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}

function monthName(monthIndex: number, year: number) {
  const label = new Date(year, monthIndex, 1).toLocaleDateString("es-EC", {
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function VendedoresDashboardReport() {
  const annualRange = useMemo(() => currentYearRange(), []);
  const [mode, setMode] = useState<"annual" | "dates">("annual");
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const activeRange = mode === "annual" ? annualRange : range;
  const { data, isLoading, isError, refetch } = useVentas(activeRange);

  const year = Number(annualRange.date_from.slice(0, 4));
  const salesBySeller = useMemo(
    () =>
      [...(data?.sales_by_seller ?? [])].sort(
        (a, b) => b.sales_total - a.sales_total,
      ),
    [data?.sales_by_seller],
  );
  const commissionsByMonth = data?.commissions_by_month ?? [];
  const monthlySales = data?.monthly_sales ?? [];
  const quarterlySummary = data?.quarterly_summary ?? [];

  const monthlySalesChartData = useMemo(
    () =>
      monthlySales.map((row) => ({
        ...row,
        month_label: new Date(`${row.month}-01T00:00:00`).toLocaleDateString(
          "es-EC",
          { month: "short" },
        ),
        month_long: new Date(`${row.month}-01T00:00:00`).toLocaleDateString(
          "es-EC",
          {
            month: "long",
            year: "numeric",
          },
        ),
      })),
    [monthlySales],
  );

  const quarterlyRows = useMemo(
    () =>
      [...quarterlySummary].sort((a, b) => a.quarter.localeCompare(b.quarter)),
    [quarterlySummary],
  );

  const formatQuarterLabel = (value: string) => {
    const [yearValue, quarterValue] = value.split("-Q");
    return `Q${quarterValue} ${yearValue}`;
  };

  const sellers = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const row of salesBySeller) {
      if (!seen.has(row.seller_name)) {
        seen.add(row.seller_name);
        ordered.push(row.seller_name);
      }
    }

    for (const row of commissionsByMonth) {
      if (!seen.has(row.seller_name)) {
        seen.add(row.seller_name);
        ordered.push(row.seller_name);
      }
    }

    return ordered;
  }, [commissionsByMonth, salesBySeller]);

  const matrix = useMemo(() => {
    const cells = new Map<
      string,
      { sales_total: number; commission_amount: number }
    >();

    for (const row of commissionsByMonth) {
      cells.set(`${row.month}|${row.seller_name}`, {
        sales_total: row.sales_total,
        commission_amount: row.commission_amount,
      });
    }

    const rows = Array.from({ length: 12 }, (_, monthIndex) => {
      const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const sellerCells = sellers.map(
        (seller) =>
          cells.get(`${month}|${seller}`) ?? {
            sales_total: 0,
            commission_amount: 0,
          },
      );
      const totalSales = sellerCells.reduce(
        (total, cell) => total + cell.sales_total,
        0,
      );

      return {
        label: monthName(monthIndex, year),
        sellerCells,
        totalSales,
      };
    });

    const sellerTotals = sellers.map((_, index) =>
      rows.reduce(
        (total, row) => total + row.sellerCells[index].sales_total,
        0,
      ),
    );
    const sellerCommissions = sellers.map((_, index) =>
      rows.reduce(
        (total, row) => total + row.sellerCells[index].commission_amount,
        0,
      ),
    );

    const grandTotalSales = rows.reduce(
      (total, row) => total + row.totalSales,
      0,
    );
    const grandTotalCommission = sellerCommissions.reduce(
      (total, value) => total + value,
      0,
    );

    return {
      rows,
      sellerTotals,
      sellerCommissions,
      grandTotalSales,
      grandTotalCommission,
    };
  }, [commissionsByMonth, sellers, year]);

  const totalSales = useMemo(
    () => salesBySeller.reduce((total, row) => total + row.sales_total, 0),
    [salesBySeller],
  );
  const totalDocuments = useMemo(
    () => salesBySeller.reduce((total, row) => total + row.sales_count, 0),
    [salesBySeller],
  );

  const sellerCount = salesBySeller.length;
  const avgSalesPerSeller = sellerCount ? totalSales / sellerCount : 0;
  const avgTicketGlobal = totalDocuments ? totalSales / totalDocuments : 0;
  const topSeller = salesBySeller[0];
  const topCommissionSeller =
    salesBySeller.length === 0
      ? undefined
      : [...salesBySeller].sort(
          (a, b) => b.commission_amount - a.commission_amount,
        )[0];

  const comparisonData = useMemo(
    () =>
      salesBySeller.map((row) => ({
        ...row,
        short_name:
          row.seller_name.length > 18
            ? `${row.seller_name.slice(0, 18)}...`
            : row.seller_name,
        avg_ticket: row.sales_count ? row.sales_total / row.sales_count : 0,
        participation: totalSales ? (row.sales_total / totalSales) * 100 : 0,
      })),
    [salesBySeller, totalSales],
  );

  return (
    <div className="space-y-4">
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as "annual" | "dates")}
      >
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="annual">Anual</TabsTrigger>
          <TabsTrigger value="dates">Por fechas</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "dates" && (
        <div className="rounded-lg border bg-card p-3">
          <DateRangeFilter onApply={setRange} defaultValues={range} />
        </div>
      )}
      {isLoading && <Skeleton className="h-48" />}
      {isError && (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el reporte por vendedor."
          onRetry={() => void refetch()}
        />
      )}

      {data &&
        (mode === "annual" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="xl:col-span-2">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Ventas por vendedor</p>
                    <p className="text-xs text-muted-foreground">
                      Resumen anual compacto
                    </p>
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table className="w-full table-fixed text-[11px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Mes</TableHead>
                        {sellers.map((seller) => (
                          <TableHead
                            key={seller}
                            className="truncate text-right"
                            title={seller}
                          >
                            {seller}
                          </TableHead>
                        ))}
                        <TableHead className="w-24 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="py-8 text-center text-muted-foreground"
                          >
                            Sin datos
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {matrix.rows.map((row) => (
                            <TableRow key={row.label}>
                              <TableCell className="font-medium">
                                {row.label}
                              </TableCell>
                              {row.sellerCells.map((cell, index) => (
                                <TableCell
                                  key={`${row.label}-${sellers[index]}`}
                                  className="truncate text-right tabular-nums"
                                  title={sellers[index]}
                                >
                                  {fmtCurrency(cell.sales_total)}
                                </TableCell>
                              ))}
                              <TableCell className="text-right tabular-nums font-medium">
                                {fmtCurrency(row.totalSales)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t bg-muted/40">
                            <TableCell className="font-semibold">
                              Total
                            </TableCell>
                            {matrix.sellerTotals.map((total, index) => (
                              <TableCell
                                key={`total-${sellers[index]}`}
                                className="text-right tabular-nums font-semibold"
                              >
                                {fmtCurrency(total)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right tabular-nums font-semibold">
                              {fmtCurrency(matrix.grandTotalSales)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/20">
                            <TableCell className="font-semibold">
                              Comisiones
                            </TableCell>
                            {matrix.sellerCommissions.map((total, index) => (
                              <TableCell
                                key={`commission-${sellers[index]}`}
                                className="text-right tabular-nums font-semibold"
                              >
                                {fmtCurrency(total)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right tabular-nums font-semibold">
                              {fmtCurrency(matrix.grandTotalCommission)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Total de ventas por mes
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Año calendario {year}
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={monthlySalesChartData}
                    margin={{ top: 8, right: 16, left: 24, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month_label" interval={0} />
                    <YAxis
                      width={96}
                      tickFormatter={(value) => fmtCurrency(Number(value))}
                    />
                    <Tooltip
                      labelFormatter={(value, payload) => {
                        const item = payload?.[0]?.payload as
                          | { month_long?: string }
                          | undefined;
                        return item?.month_long ?? String(value);
                      }}
                      formatter={(value) => [
                        fmtCurrency(Number(value)),
                        "Ventas",
                      ]}
                    />
                    <Bar
                      dataKey="sales_total"
                      fill="#7b963f"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Resumen por quarter</p>
                    <p className="text-xs text-muted-foreground">
                      Ventas, productos y producto líder
                    </p>
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table className="w-full table-fixed text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 align-middle">
                          Quarter
                        </TableHead>
                        <TableHead className="text-right align-middle">
                          Vendido
                        </TableHead>
                        <TableHead className="text-center align-middle">
                          Productos
                        </TableHead>
                        <TableHead className="align-middle">
                          Producto top
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quarterlyRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-8 text-center text-muted-foreground"
                          >
                            Sin datos
                          </TableCell>
                        </TableRow>
                      ) : (
                        quarterlyRows.map((row) => (
                          <TableRow key={row.quarter}>
                            <TableCell className="font-medium align-middle">
                              {formatQuarterLabel(row.quarter)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums align-middle">
                              {fmtCurrency(row.sales_total)}
                            </TableCell>
                            <TableCell className="text-center tabular-nums align-middle">
                              {formatQuantity(row.products_sold, "decimal")}
                            </TableCell>
                            <TableCell
                              className="whitespace-normal break-words leading-tight align-middle"
                              title={row.top_product_name}
                            >
                              {row.top_product_name} (
                              {formatQuantity(
                                row.top_product_quantity,
                                "decimal",
                              )}
                              )
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Vendedores con ventas
                  </p>
                  <div className="mt-1 text-right">
                    <p className="text-2xl font-bold">{sellerCount}</p>
                    <p className="text-xs text-muted-foreground">
                      Periodo actual
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Venta promedio por vendedor
                  </p>
                  <div className="mt-1 text-right">
                    <p className="text-2xl font-bold">
                      {fmtCurrency(avgSalesPerSeller)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sobre {formatQuantity(totalDocuments, "integer")} docs.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Ticket promedio global
                  </p>
                  <div className="mt-1 text-right">
                    <p className="text-2xl font-bold">
                      {fmtCurrency(avgTicketGlobal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatQuantity(totalDocuments, "integer")} ventas
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Líder en ventas
                  </p>
                  <div className="mt-1 text-right">
                    <p
                      className="truncate text-lg font-bold"
                      title={topSeller?.seller_name}
                    >
                      {topSeller?.seller_name ?? "Sin datos"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {topSeller ? fmtCurrency(topSeller.sales_total) : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Comparativa de ventas por vendedor
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ranking por total vendido
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={comparisonData}
                    margin={{ top: 8, right: 16, left: 24, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="short_name"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={58}
                    />
                    <YAxis
                      width={96}
                      tickFormatter={(value) => fmtCurrency(Number(value))}
                    />
                    <Tooltip
                      formatter={(value) => [
                        fmtCurrency(Number(value)),
                        "Ventas",
                      ]}
                      labelFormatter={(value, payload) => {
                        const item = payload?.[0]?.payload as
                          | { seller_name?: string }
                          | undefined;
                        return item?.seller_name ?? String(value);
                      }}
                    />
                    <Bar
                      dataKey="sales_total"
                      fill="#7b963f"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Ticket promedio y comisión
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Comparativa monetaria por vendedor
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={comparisonData}
                    margin={{ top: 8, right: 16, left: 24, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="short_name"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={58}
                    />
                    <YAxis
                      width={96}
                      tickFormatter={(value) => fmtCurrency(Number(value))}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        fmtCurrency(Number(value)),
                        name === "avg_ticket" ? "Ticket promedio" : "Comisión",
                      ]}
                      labelFormatter={(value, payload) => {
                        const item = payload?.[0]?.payload as
                          | { seller_name?: string }
                          | undefined;
                        return item?.seller_name ?? String(value);
                      }}
                    />
                    <Bar
                      dataKey="avg_ticket"
                      fill="#0ea5e9"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="commission_amount"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  Tabla comparativa de vendedores
                </p>
                <p className="text-xs text-muted-foreground">
                  Mayor comisión:{" "}
                  {topCommissionSeller?.seller_name ?? "Sin datos"}
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">#</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-center">Docs.</TableHead>
                      <TableHead className="text-right">Ticket prom.</TableHead>
                      <TableHead className="text-center">
                        Participación
                      </TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground"
                        >
                          Sin datos
                        </TableCell>
                      </TableRow>
                    ) : (
                      comparisonData.map((row, index) => (
                        <TableRow key={row.seller_name}>
                          <TableCell className="text-center tabular-nums">
                            {index + 1}
                          </TableCell>
                          <TableCell>{row.seller_name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtCurrency(row.sales_total)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {formatQuantity(row.sales_count, "integer")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtCurrency(row.avg_ticket)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {row.participation.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtCurrency(row.commission_amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ))}
    </div>
  );
}

function DailyClosingReport() {
  const pageSize = 10;
  const [selectedDate, setSelectedDate] = useState(todayIsoDate);
  const [paymentFilter, setPaymentFilter] = useState("__all__");
  const [bankFilter, setBankFilter] = useState("__all__");
  const [page, setPage] = useState(1);
  const [viewDocumentId, setViewDocumentId] = useState<number | null>(null);
  const [viewDocumentKind, setViewDocumentKind] = useState<
    "sale" | "customer_return" | null
  >(null);
  const { data, isLoading, isError, refetch } = useDailyClosing(selectedDate);
  const detailEndpoint =
    viewDocumentKind === "customer_return" ? "ingresos" : "egresos";
  const { data: detailDoc, isLoading: detailLoading } =
    useQuery<InventoryDocument>({
      queryKey: [
        "reports",
        "cierre-dia-detail",
        detailEndpoint,
        viewDocumentId,
      ],
      queryFn: async () =>
        (await api.get(`/inventory/${detailEndpoint}/${viewDocumentId}`)).data,
      enabled: Boolean(viewDocumentId && viewDocumentKind),
    });

  const summary = data?.summary;
  const paymentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.documents ?? [])
            .filter((row) => row.kind === "sale")
            .map((row) => row.payment_method || "NO CLASIFICADO"),
        ),
      ).sort(),
    [data],
  );
  const bankOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.documents ?? [])
            .filter(
              (row) =>
                row.kind === "sale" &&
                row.payment_method?.toUpperCase() === "TRANSFERENCIA",
            )
            .map((row) => row.bank_name || "SIN BANCO"),
        ),
      ).sort(),
    [data],
  );
  const filteredDocuments = useMemo(
    () =>
      (data?.documents ?? []).filter((row) => {
        if (paymentFilter === "__all__") return true;
        if (row.kind !== "sale") return false;
        const method = row.payment_method || "NO CLASIFICADO";
        if (method !== paymentFilter) return false;
        if (paymentFilter !== "TRANSFERENCIA" || bankFilter === "__all__")
          return true;
        return (row.bank_name || "SIN BANCO") === bankFilter;
      }),
    [bankFilter, data, paymentFilter],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredDocuments.length / pageSize),
  );
  const paginatedDocuments = useMemo(
    () => filteredDocuments.slice((page - 1) * pageSize, page * pageSize),
    [filteredDocuments, page],
  );
  useEffect(() => {
    setPage(1);
  }, [selectedDate, paymentFilter, bankFilter]);
  const filteredSummary = useMemo(() => {
    const sales = filteredDocuments.filter((row) => row.kind === "sale");
    const returns = filteredDocuments.filter(
      (row) => row.kind === "customer_return",
    );
    const salesTotal = sales.reduce((total, row) => total + row.total, 0);
    const returnsTotal = returns.reduce((total, row) => total + row.total, 0);
    return {
      salesCount: sales.length,
      salesTotal,
      cashTotal: sales
        .filter((row) => row.payment_method?.toUpperCase() === "EFECTIVO")
        .reduce((total, row) => total + row.total, 0),
      transferTotal: sales
        .filter((row) => row.payment_method?.toUpperCase() === "TRANSFERENCIA")
        .reduce((total, row) => total + row.total, 0),
      returnsCount: returns.length,
      returnsTotal,
      netTotal: salesTotal - returnsTotal,
    };
  }, [filteredDocuments]);
  const pieData = useMemo(() => {
    if (!data) return [];
    const rows = [
      { name: "Efectivo", value: data.summary.cash_total },
      ...data.transfers_by_bank.map((bank) => ({
        name: `Transferencia · ${bank.bank_name}`,
        value: bank.total,
      })),
      { name: "No clasificado", value: data.summary.unclassified_total },
    ];
    return rows.filter((row) => row.value > 0);
  }, [data]);
  const pieColors = ["#0ea5e9", "#14b8a6", "#f59e0b", "#64748b", "#e11d48"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1.5">
          <label htmlFor="daily-closing-date" className="text-xs font-medium">
            Día del cierre
          </label>
          <Input
            id="daily-closing-date"
            type="date"
            value={selectedDate}
            max={todayIsoDate()}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="h-9 w-44"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium">Forma de pago</span>
          <Select
            value={paymentFilter}
            onValueChange={(value) => {
              setPaymentFilter(value);
              setBankFilter("__all__");
            }}
          >
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {paymentOptions.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {paymentFilter === "TRANSFERENCIA" && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium">Banco</span>
            <Select value={bankFilter} onValueChange={setBankFilter}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los bancos</SelectItem>
                {bankOptions.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="max-w-xl text-sm text-muted-foreground">
          El neto considera ventas aprobadas menos devoluciones de clientes
          aprobadas del día seleccionado.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError || !data || !summary ? (
        <ErrorState
          message="No se pudo cargar el cierre diario."
          onRetry={refetch}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Número de ventas
                </p>
                <p className="text-2xl font-semibold">
                  {filteredSummary.salesCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtCurrency(filteredSummary.salesTotal)} vendido
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total efectivo</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {fmtCurrency(filteredSummary.cashTotal)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Total transferencias
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {fmtCurrency(filteredSummary.transferTotal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtCurrency(summary.unclassified_total)} no clasificado en el
                  día
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Neto de caja</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {fmtCurrency(filteredSummary.netTotal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Devoluciones: {fmtCurrency(filteredSummary.returnsTotal)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
            <div className="rounded-lg border bg-card">
              <div className="border-b p-4">
                <h2 className="font-semibold">Ventas y devoluciones</h2>
                <p className="text-sm text-muted-foreground">
                  Documentos aprobados del día, ordenados del más reciente al
                  más antiguo.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha y hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Pago / banco</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          Sin documentos para los filtros seleccionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedDocuments.map((row) => (
                        <TableRow key={`${row.kind}-${row.id}`}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatClosingDateTime(row.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                row.kind === "customer_return"
                                  ? "border-amber-300 bg-amber-50 text-amber-800"
                                  : "border-sky-300 bg-sky-50 text-sky-800"
                              }
                            >
                              {row.kind_label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {row.number}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.kind === "sale" ? (
                              <>
                                {row.payment_method || "No clasificado"}
                                {row.bank_name ? ` · ${row.bank_name}` : ""}
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {fmtCurrency(row.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ver documento"
                              aria-label="Ver documento"
                              onClick={() => {
                                setViewDocumentId(row.id);
                                setViewDocumentKind(row.kind);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={filteredDocuments.length}
                totalPages={totalPages}
                onPageChange={setPage}
                itemLabel="documentos"
              />
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold">Transferencias por banco</h2>
              <div className="mt-3 space-y-2">
                {data.transfers_by_bank.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin transferencias.
                  </p>
                ) : (
                  data.transfers_by_bank.map((bank) => (
                    <div
                      key={bank.bank_name}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span>{bank.bank_name}</span>
                      <span className="font-semibold tabular-nums">
                        {fmtCurrency(bank.total)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-5 border-t pt-4">
                <h3 className="text-sm font-semibold">
                  Distribución por forma de pago
                </h3>
                {pieData.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sin ventas para graficar.
                  </p>
                ) : (
                  <div className="mt-2 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={pieColors[index % pieColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => fmtCurrency(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="space-y-1">
                  {pieData.map((entry, index) => (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{
                            backgroundColor:
                              pieColors[index % pieColors.length],
                          }}
                        />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="font-medium tabular-nums">
                        {fmtCurrency(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {summary.returns_count > 0 && (
                <div className="mt-5 border-t pt-3 text-sm">
                  <div className="flex justify-between">
                    <span>Devoluciones</span>
                    <span className="font-semibold tabular-nums">
                      {summary.returns_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total devuelto</span>
                    <span className="font-semibold tabular-nums">
                      {fmtCurrency(summary.returns_total)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {viewDocumentId &&
        (detailLoading || !detailDoc ? (
          <Dialog
            open
            onOpenChange={(open) => !open && setViewDocumentId(null)}
          >
            <DialogContent>
              <Skeleton className="h-48" />
            </DialogContent>
          </Dialog>
        ) : (
          <DocumentDetailModal
            doc={detailDoc}
            onClose={() => {
              setViewDocumentId(null);
              setViewDocumentKind(null);
            }}
            showCost
            showPrice={detailDoc.doc_type === "EG"}
          />
        ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  ...DOC_REPORT_TYPES.map((t) => ({ value: t.value, label: t.label })),
  { value: "stock", label: "Stock" },
  { value: "movimientos-por-usuario", label: "Por usuario" },
  { value: "ventas", label: "Ventas" },
  { value: "cierre-dia", label: "Cierre de Día" },
  { value: "vendedores", label: "Vendedores" },
  { value: "consolidado", label: "Consolidado" },
];

export default function ReportsPage() {
  const { data: reportSettings } = useQuery<{
    stock_quantity_mode: "integer" | "decimal";
  }>({
    queryKey: ["reports", "settings"],
    queryFn: async () => {
      const res = await api.get("/reports/settings");
      return res.data;
    },
  });
  const quantityMode = reportSettings?.stock_quantity_mode ?? "integer";

  return (
    <div className="space-y-4">
      <PageHeader title="Reportes" />
      <Tabs defaultValue="consolidado">
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {DOC_REPORT_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <MovementReport
              endpoint={t.endpoint}
              prefix={t.prefix}
              supportsProductFilter={t.supportsProductFilter}
            />
          </TabsContent>
        ))}
        <TabsContent value="stock" className="mt-4">
          <StockReport quantityMode={quantityMode} />
        </TabsContent>
        <TabsContent value="stock-valorizado" className="mt-4">
          <StockValorizadoReport quantityMode={quantityMode} />
        </TabsContent>
        <TabsContent value="kardex" className="mt-4">
          <KardexReport quantityMode={quantityMode} />
        </TabsContent>
        <TabsContent value="movimientos-por-usuario" className="mt-4">
          <MovimientosPorUsuarioReport />
        </TabsContent>
        <TabsContent value="ventas" className="mt-4">
          <VentasReport />
        </TabsContent>
        <TabsContent value="cierre-dia" className="mt-4">
          <DailyClosingReport />
        </TabsContent>
        <TabsContent value="vendedores" className="mt-4">
          <VendedoresDashboardReport />
        </TabsContent>
        <TabsContent value="consolidado" className="mt-4">
          <ConsolidadoReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
