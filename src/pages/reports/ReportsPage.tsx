import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  BarChart,
  Bar,
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
  Download,
  Eye,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  DateRangeFilter,
  type DateRange,
  currentMonthRange,
} from "@/features/reports/DateRangeFilter";
import {
  useConsolidado,
  useStockReport,
  useStockValorizado,
} from "@/features/reports/hooks";
import { useKardex } from "@/features/kardex/hooks";
import { useAuditUsers } from "@/features/audit/hooks";
import { useProducts } from "@/features/catalog/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { downloadBlob } from "@/lib/download";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function formatQuantity(value: unknown, mode: "integer" | "decimal") {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  if (mode === "integer") {
    return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(
      n,
    );
  }
  return new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n);
}

type SortDirection = "asc" | "desc";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  cancelled: "Cancelado",
  voided: "Anulado",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  IN: "Ingreso a Bodega",
  EG: "Egreso de Bodega",
  BI: "Baja de Inventario",
  AI: "Ajuste de Inventario",
};

function statusLabel(value: string | null | undefined) {
  if (!value) return "—";
  return STATUS_LABELS[value.toLowerCase()] ?? value;
}

function docTypeLabel(value: string | null | undefined) {
  if (!value) return "—";
  return DOC_TYPE_LABELS[value] ?? value;
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
  products: Array<{ id: number; name: string }>;
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
    return products.filter((p) => p.name.toLowerCase().includes(q));
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
              placeholder="Buscar producto..."
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

// ─── Movement report tabs (Ingresos/Egresos/Bajas/Ajustes) ───────────────────
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
  {
    value: "bajas",
    label: "Bajas",
    endpoint: "/reports/bajas",
    prefix: "bajas",
    supportsProductFilter: false,
  },
  {
    value: "ajustes",
    label: "Ajustes",
    endpoint: "/reports/ajustes",
    prefix: "ajustes",
    supportsProductFilter: false,
  },
];

function MovementReport({
  endpoint,
  prefix,
  supportsProductFilter,
  quantityMode,
}: {
  endpoint: string;
  prefix: string;
  supportsProductFilter: boolean;
  quantityMode: "integer" | "decimal";
}) {
  const { toast } = useToast();
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const [productId, setProductId] = useState<number | undefined>();
  const [userId, setUserId] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState<
    "number" | "status" | "reference" | "created_at"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewDocumentId, setViewDocumentId] = useState<number | null>(null);
  const { data: products } = useProducts({ status: "active" });
  const { data: users } = useAuditUsers();

  const endpointKey = endpoint.split("/").pop() ?? "ingresos";
  const {
    data: rows,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["reports", "movement", endpoint, range, productId],
    queryFn: async () => {
      const res = await api.get<
        Array<{
          id: number;
          number: string;
          status: string;
          reference: string | null;
          created_at: string;
        }>
      >(endpoint, {
        params: {
          date_from: range.date_from,
          date_to: range.date_to,
          product_id: supportsProductFilter ? productId : undefined,
          created_by: userId,
          format: "json",
        },
      });
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

  const sortedRows = useMemo(() => {
    const list = [...(rows ?? [])];
    list.sort((a, b) => {
      const cmp = compareValue(a[sortBy], b[sortBy]);
      if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp;
      const fallback = compareValue(a.created_at, b.created_at);
      return sortDirection === "asc" ? fallback : -fallback;
    });
    return list;
  }, [rows, sortBy, sortDirection]);

  const setSort = (key: "number" | "status" | "reference" | "created_at") => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDirection("asc");
  };

  const handleExport = async (fmt: "pdf" | "excel") => {
    if (!range) return;
    try {
      const res = await api.get(endpoint, {
        params: {
          date_from: range.date_from,
          date_to: range.date_to,
          format: fmt,
          product_id: supportsProductFilter ? productId : undefined,
        },
        responseType: "blob",
      });
      const selectedProductName =
        supportsProductFilter && productId
          ? products?.find((p) => p.id === productId)?.name
          : undefined;
      const selectedUserName = userId
        ? users?.find((u) => u.id === userId)?.username
        : undefined;
      const productSuffix = selectedProductName
        ? `_producto-${fileSafePart(selectedProductName)}`
        : "";
      const userSuffix = selectedUserName
        ? `_usuario-${fileSafePart(selectedUserName)}`
        : "";
      downloadBlob(
        res,
        `${prefix}${productSuffix}${userSuffix}_${range.date_from}_${range.date_to}.${fmt === "pdf" ? "pdf" : "xlsx"}`,
      );
    } catch {
      toast({ variant: "destructive", description: "Error al exportar" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <DateRangeFilter onApply={setRange} />
        {supportsProductFilter && (
          <div className="space-y-1">
            <span className="text-xs font-medium">Producto (opcional)</span>
            <ProductSearchCombobox
              products={(products ?? []).map((p) => ({
                id: p.id,
                name: p.name,
              }))}
              value={productId}
              onChange={setProductId}
              includeAll
            />
          </div>
        )}
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
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("excel")}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Excel
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el reporte para este rango."
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
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      className="py-10"
                      heading="Sin resultados"
                      description="No hay movimientos para el rango seleccionado."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">
                      {r.number}
                    </TableCell>
                    <TableCell>{statusLabel(r.status)}</TableCell>
                    <TableCell>{r.reference || "—"}</TableCell>
                    <TableCell>
                      {new Date(r.created_at).toLocaleDateString("es-EC")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewDocumentId(r.id)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!viewDocumentId}
        onOpenChange={(open) => !open && setViewDocumentId(null)}
      >
        <DialogContent className="w-[min(1200px,calc(100vw-3rem))] max-h-[calc(100vh-3rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de documento</DialogTitle>
          </DialogHeader>
          {detailLoading || !detailDoc ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="space-y-4 px-8 pb-8 pt-2">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-foreground">Número:</span>{" "}
                  {detailDoc.number}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Estado:</span>{" "}
                  {statusLabel(detailDoc.status)}
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    Referencia:
                  </span>{" "}
                  {detailDoc.reference || "—"}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Fecha:</span>{" "}
                  {new Date(detailDoc.created_at).toLocaleString("es-EC")}
                </div>
              </div>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISBN</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailDoc.lines ?? []).map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.product_isbn || "—"}</TableCell>
                        <TableCell>
                          {line.product_name || "Producto no disponible"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQuantity(line.quantity, quantityMode)}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.unit_cost ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.unit_price ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "stock_actual" | "stock_minimo"
  >("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [ctx, setCtx] = useState<{
    x: number;
    y: number;
    productId: number;
  } | null>(null);
  const {
    data: products,
    isLoading,
    isError,
    refetch,
  } = useStockReport(
    { bajo_stock: bajoStock || undefined },
    { enabled: canViewStockReports },
  );

  useEffect(() => {
    const close = () => setCtx(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const setSort = (key: "name" | "stock_actual" | "stock_minimo") => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDirection("asc");
  };

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (products ?? []).filter((p) =>
      p.name.toLowerCase().includes(q),
    );
    list.sort((a, b) => {
      const cmp = compareValue((a as any)[sortBy], (b as any)[sortBy]);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [products, search, sortBy, sortDirection]);

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
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <Input
          placeholder="Buscar producto..."
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
        <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("excel")}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Excel
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el reporte de stock."
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
                <TableHead className="text-right">
                  <SortableHeader
                    label="Stock actual"
                    active={sortBy === "stock_actual"}
                    direction={sortDirection}
                    onClick={() => setSort("stock_actual")}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Stock mínimo"
                    active={sortBy === "stock_minimo"}
                    direction={sortDirection}
                    onClick={() => setSort("stock_minimo")}
                  />
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      className="py-10"
                      heading="Sin resultados"
                      description="No hay productos para los filtros aplicados."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleProducts.map((p) => (
                  <TableRow
                    key={p.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtx({ x: e.clientX, y: e.clientY, productId: p.id });
                    }}
                  >
                    <TableCell>{p.name}</TableCell>
                    <TableCell
                      className={`text-right ${p.bajo_stock ? "text-destructive font-medium" : ""}`}
                    >
                      {formatQuantity(p.stock_actual, quantityMode)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatQuantity(p.stock_minimo, quantityMode)}
                    </TableCell>
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
  const { data, isLoading, isError, refetch } = useStockValorizado(
    {},
    { enabled: canViewStockReports },
  );
  const [sortBy, setSortBy] = useState<"name" | "stock" | "cost" | "value">(
    "name",
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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
        message="No se pudo cargar el reporte de stock valorizado."
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
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("excel")}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Excel
        </Button>
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
              sortedItems.map((item) => (
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
            products={(products ?? []).map((p) => ({ id: p.id, name: p.name }))}
            value={productId}
            onChange={setProductId}
          />
        </div>
        <DateRangeFilter onApply={setRange} defaultValues={range} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Excel
          </Button>
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
                sortedEntries.map((entry) => (
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
        </div>
      )}
    </div>
  );
}

// ─── Movimientos por usuario ──────────────────────────────────────────────────
function MovimientosPorUsuarioReport({
  quantityMode,
}: {
  quantityMode: "integer" | "decimal";
}) {
  const { toast } = useToast();
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const [userId, setUserId] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState<
    "number" | "doc_type" | "status" | "reference" | "created_at"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewDocumentId, setViewDocumentId] = useState<number | null>(null);
  const { data: users } = useAuditUsers();

  const {
    data: rows,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["reports", "movimientos-por-usuario", range, userId],
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
          user_id: userId,
          format: "json",
        },
      });
      return res.data;
    },
    enabled: !!userId,
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
        BI: "bajas",
        AI: "ajustes",
      };
      const res = await api.get(
        `/inventory/${map[row.doc_type]}/${viewDocumentId}`,
      );
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
    if (!userId) {
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
          user_id: userId,
          format: fmt,
        },
        responseType: "blob",
      });
      const selectedUser = users?.find((u) => u.id === userId);
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
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <span className="text-xs font-medium">Usuario</span>
          <Select
            value={userId ? String(userId) : "__none__"}
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
        <DateRangeFilter onApply={setRange} defaultValues={range} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("excel")}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Excel
        </Button>
      </div>

      {!userId ? (
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
                sortedRows.map((r) => (
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
                        size="sm"
                        onClick={() => setViewDocumentId(r.id)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!viewDocumentId}
        onOpenChange={(open) => !open && setViewDocumentId(null)}
      >
        <DialogContent className="w-[min(1200px,calc(100vw-3rem))] max-h-[calc(100vh-3rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de documento</DialogTitle>
          </DialogHeader>
          {detailLoading || !detailDoc ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="space-y-4 px-8 pb-8 pt-2">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-foreground">Número:</span>{" "}
                  {detailDoc.number}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Estado:</span>{" "}
                  {statusLabel(detailDoc.status)}
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    Referencia:
                  </span>{" "}
                  {detailDoc.reference || "—"}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Fecha:</span>{" "}
                  {new Date(detailDoc.created_at).toLocaleString("es-EC")}
                </div>
              </div>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISBN</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailDoc.lines ?? []).map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.product_isbn || "—"}</TableCell>
                        <TableCell>
                          {line.product_name || "Producto no disponible"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQuantity(line.quantity, quantityMode)}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.unit_cost ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.unit_price ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Consolidado ──────────────────────────────────────────────────────────────
function ConsolidadoReport() {
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const { data, isLoading, isError, refetch } = useConsolidado(range);
  const { toast } = useToast();

  const chartData = data
    ? Object.entries(data.movements).map(([name, value]) => ({ name, value }))
    : [];

  const handleExport = async (fmt: "pdf" | "excel") => {
    try {
      const res = await api.get("/reports/consolidado", {
        params: {
          date_from: range.date_from,
          date_to: range.date_to,
          format: fmt,
        },
        responseType: "blob",
      });
      downloadBlob(
        res,
        `consolidado_${range.date_from}_${range.date_to}.${fmt === "pdf" ? "pdf" : "xlsx"}`,
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
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>
      {isLoading && <Skeleton className="h-48" />}
      {isError && (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el reporte consolidado."
          onRetry={() => void refetch()}
        />
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(data.movements).map(([k, v]) => (
              <Card key={k}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground uppercase">{k}</p>
                  <p className="text-2xl font-bold">{v}</p>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Productos activos
                </p>
                <p className="text-2xl font-bold">{data.active_products}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Bajo stock</p>
                <p className="text-2xl font-bold text-destructive">
                  {data.products_below_minimum}
                </p>
              </CardContent>
            </Card>
          </div>
          {chartData.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-sm font-medium">Movimientos por tipo</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  ...DOC_REPORT_TYPES.map((t) => ({ value: t.value, label: t.label })),
  { value: "stock", label: "Stock" },
  { value: "stock-valorizado", label: "Stock valorizado" },
  { value: "kardex", label: "Kardex" },
  { value: "movimientos-por-usuario", label: "Por usuario" },
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
              quantityMode={quantityMode}
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
          <MovimientosPorUsuarioReport quantityMode={quantityMode} />
        </TabsContent>
        <TabsContent value="consolidado" className="mt-4">
          <ConsolidadoReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
