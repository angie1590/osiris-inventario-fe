import { useMemo, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { currentMonthRange } from "@/features/reports/DateRangeFilter";
import { ArrowLeft, Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DocumentDetailModal } from "@/features/inventory/DocumentDetailModal";
import { useKardex } from "@/features/kardex/hooks";
import { useProducts } from "@/features/catalog/hooks";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import type {
  EgresoType,
  IngresoType,
  InventoryDocument,
  KardexEntry,
  KardexEntryType,
} from "@/types/api";

const ENTRY_TYPE_LABELS: Record<KardexEntryType, string> = {
  IN: "Ingreso",
  OUT: "Egreso",
  ADJUST: "Ajuste",
};
const ENTRY_TYPE_VARIANTS: Record<
  KardexEntryType,
  "default" | "secondary" | "destructive"
> = {
  IN: "default",
  OUT: "destructive",
  ADJUST: "secondary",
};
const INGRESO_TYPE_LABELS: Record<IngresoType, string> = {
  purchase: "Compra",
  initial_inventory: "Inventario inicial",
  adjustment_positive: "Ajuste positivo",
  customer_return: "Devolucion de cliente",
  production: "Produccion",
  transfer_received: "Transferencia recibida",
  other: "Otro",
};
const EGRESO_TYPE_LABELS: Record<EgresoType, string> = {
  sale: "Venta",
  baja: "Baja",
  adjustment_negative: "Ajuste negativo",
  supplier_return: "Devolucion a proveedor",
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

function getEntryDisplayType(entry: KardexEntry): "IN" | "OUT" {
  if (entry.entry_type === "ADJUST") {
    return entry.quantity_in > 0 ? "IN" : "OUT";
  }
  return entry.entry_type;
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildPepsLayerSummary(
  entries: Array<any>,
  openingBalanceQty: number,
  closingQty: number,
  quantityMode: "integer" | "decimal",
) {
  const layers = new Map<number, { qty: number; cost: number }>();

  for (const e of entries) {
    const lotId = Number(e.lot_id);
    if (!Number.isFinite(lotId) || lotId <= 0) continue;

    const qtyIn = safeNumber(e.quantity_in, 0);
    const qtyOut = safeNumber(e.quantity_out, 0);
    const costIn = safeNumber(e.cost_in, 0);
    const current = layers.get(lotId) ?? { qty: 0, cost: costIn };

    if (qtyIn > 0) {
      current.qty += qtyIn;
      if (costIn > 0) current.cost = costIn;
    }
    if (qtyOut > 0) {
      current.qty -= qtyOut;
    }
    layers.set(lotId, current);
  }

  const positiveLayers = Array.from(layers.values()).filter(
    (l) => l.qty > 0.0000001,
  );
  const hasOpeningWithoutLayerDetail =
    openingBalanceQty > 0 && positiveLayers.length === 0;

  if (closingQty <= 0) {
    return {
      label: "Costo unitario saldo",
      valueText: formatCurrency(0),
      helperText: "Sin saldo",
    };
  }

  if (hasOpeningWithoutLayerDetail) {
    return {
      label: "Costo unitario saldo",
      valueText: "Múltiples capas",
      helperText: "El rango incluye saldo inicial sin desglose por capa.",
    };
  }

  if (positiveLayers.length === 1) {
    return {
      label: "Costo de capa restante",
      valueText: formatCurrency(positiveLayers[0].cost),
      helperText: `Capa restante: ${formatQuantity(positiveLayers[0].qty, quantityMode)} u.`,
    };
  }

  if (positiveLayers.length > 1) {
    const summary = positiveLayers
      .slice(0, 3)
      .map(
        (l) =>
          `${formatQuantity(l.qty, quantityMode)} u. @ ${formatCurrency(l.cost)}`,
      )
      .join(" | ");
    const more = positiveLayers.length > 3 ? " | ..." : "";
    return {
      label: "Costo unitario saldo",
      valueText: "Múltiples capas",
      helperText: `${positiveLayers.length} capas: ${summary}${more}`,
    };
  }

  return {
    label: "Costo unitario saldo",
    valueText: "Múltiples capas",
    helperText: "No se pudo determinar una única capa restante.",
  };
}

export default function KardexPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const defaultRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [selectedProductId, setSelectedProductId] = useState(
    productId ? Number(productId) : 0,
  );
  const [productOpen, setProductOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [viewDocumentId, setViewDocumentId] = useState<number | null>(null);
  const [viewDocumentType, setViewDocumentType] = useState<
    "ingresos" | "egresos" | null
  >(null);

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

  const { data: products } = useProducts({ status: "active" });
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products ?? [];
    return (products ?? []).filter((p) => {
      const name = p.name.toLowerCase();
      const isbn = p.isbn.toLowerCase();
      const internalCode = (p.codigo_interno ?? "").toLowerCase();
      return name.includes(q) || isbn.includes(q) || internalCode.includes(q);
    });
  }, [products, productQuery]);
  const {
    data: kardex,
    isLoading,
    isError,
    refetch,
  } = useKardex(selectedProductId, dateFrom || undefined, dateTo || undefined);

  const { data: detailDoc, isLoading: detailLoading } = useQuery({
    queryKey: ["kardex", "movement-detail", viewDocumentType, viewDocumentId],
    queryFn: async () => {
      const res = await api.get<InventoryDocument>(
        `/inventory/${viewDocumentType}/${viewDocumentId}`,
      );
      return res.data;
    },
    enabled: !!viewDocumentId && !!viewDocumentType,
  });

  const costSummary = useMemo(() => {
    if (!kardex) {
      return {
        label: "Costo unitario saldo",
        valueText: formatCurrency(0),
        helperText: "",
      };
    }

    const method = String(kardex.method || "").toUpperCase();
    if (method === "WEIGHTED_AVERAGE") {
      return {
        label: "Costo promedio ponderado",
        valueText: formatCurrency(safeNumber(kardex.weighted_avg_cost, 0)),
        helperText: "",
      };
    }

    return buildPepsLayerSummary(
      kardex.entries ?? [],
      safeNumber(kardex.opening_balance_quantity, 0),
      safeNumber(kardex.closing_balance_quantity, 0),
      quantityMode,
    );
  }, [kardex, quantityMode]);

  const handleProductChange = (id: string) => {
    const numId = Number(id);
    setSelectedProductId(numId);
    navigate(`/kardex/${numId}`, { replace: true });
  };

  const closeDocumentModal = () => {
    setViewDocumentId(null);
    setViewDocumentType(null);
  };

  const hasProductSelected = selectedProductId > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Kardex</h1>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1 flex-1 min-w-48">
          <Label className="text-xs">Producto</Label>
          <PopoverPrimitive.Root
            open={productOpen}
            onOpenChange={setProductOpen}
          >
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={productOpen}
                className={cn(
                  "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-lg border border-input bg-white px-3 text-sm shadow-token-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="truncate">
                  {selectedProductId
                    ? (products ?? []).find((p) => p.id === selectedProductId)
                        ?.name
                    : "Seleccionar producto"}
                </span>
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
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Buscar por nombre, cod. barras o cod. interno..."
                    className="h-7 border-none p-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1" role="listbox">
                  {filteredProducts.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      Sin resultados
                    </p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                          "cursor-pointer hover:bg-accent",
                          selectedProductId === p.id &&
                            "bg-primary/10 font-medium",
                        )}
                        onClick={() => {
                          handleProductChange(String(p.id));
                          setProductOpen(false);
                        }}
                      >
                        <span className="flex-1 truncate text-left">
                          {p.name}
                        </span>
                        {selectedProductId === p.id && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            className="h-9 w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            className="h-9 w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {!hasProductSelected && (
        <EmptyState
          heading="Selecciona un producto"
          description="Elige un producto para consultar su historial de movimientos en kardex."
          className="py-10"
        />
      )}

      {hasProductSelected && isLoading && <Skeleton className="h-64 w-full" />}

      {hasProductSelected && isError && (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el kardex del producto seleccionado."
          onRetry={() => void refetch()}
        />
      )}

      {kardex && !isError && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Saldo final (cantidad)
                </p>
                <p className="text-2xl font-bold text-right tabular-nums">
                  {formatQuantity(
                    kardex.closing_balance_quantity,
                    quantityMode,
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Saldo final (valor)
                </p>
                <p className="text-2xl font-bold text-right tabular-nums">
                  {formatCurrency(kardex.closing_balance_value)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  {costSummary.label}
                </p>
                <p className="text-2xl font-bold text-right tabular-nums">
                  {costSummary.valueText}
                </p>
                {costSummary.helperText ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {costSummary.helperText}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border bg-card max-h-[calc(100vh-22rem)] overflow-y-auto overflow-x-hidden">
            <Table className="table-fixed w-full [&_th]:px-2 [&_td]:px-2">
              <colgroup>
                <col style={{ width: "6%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-[hsl(var(--table-head))] [&_th]:whitespace-nowrap">
                <TableRow>
                  <TableHead className="text-center text-[11px]">
                    Fecha
                  </TableHead>
                  <TableHead className="text-center">Documento</TableHead>
                  <TableHead className="text-center">Movimiento</TableHead>
                  <TableHead className="text-center">
                    <span className="block leading-tight">
                      Cant.
                      <br />
                      entrada
                    </span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="block leading-tight">
                      Costo
                      <br />
                      unitario
                    </span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="block leading-tight">
                      Valor
                      <br />
                      entrada
                    </span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="block leading-tight">
                      Cant.
                      <br />
                      salida
                    </span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="block leading-tight">
                      Costo
                      <br />
                      unitario
                    </span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="block leading-tight">
                      Valor
                      <br />
                      salida
                    </span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="block leading-tight">
                      Saldo
                      <br />
                      cant.
                    </span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="block leading-tight">
                      Saldo
                      <br />
                      valor
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kardex.opening_balance_quantity > 0 && (
                  <TableRow className="bg-muted/30 italic">
                    <TableCell className="text-left text-muted-foreground whitespace-nowrap">
                      —
                    </TableCell>
                    <TableCell className="whitespace-nowrap" />
                    <TableCell className="text-left whitespace-nowrap">
                      <Badge variant="secondary">Saldo inicial</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap" />
                    <TableCell className="whitespace-nowrap" />
                    <TableCell className="whitespace-nowrap" />
                    <TableCell className="whitespace-nowrap" />
                    <TableCell className="whitespace-nowrap" />
                    <TableCell className="whitespace-nowrap" />
                    <TableCell className="text-center font-medium whitespace-nowrap">
                      {formatQuantity(
                        kardex.opening_balance_quantity,
                        quantityMode,
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                      {formatCurrency(kardex.opening_balance_value)}
                    </TableCell>
                  </TableRow>
                )}
                {kardex.entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="p-0">
                      <EmptyState
                        className="py-10"
                        heading="Sin movimientos en el periodo"
                        description="Modifica el rango de fechas para consultar otro periodo."
                      />
                    </TableCell>
                  </TableRow>
                )}
                {kardex.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-left text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleDateString("es-EC")}
                    </TableCell>
                    <TableCell className="text-left whitespace-nowrap">
                      {e.document_number &&
                      e.document_id &&
                      (e.document_doc_type === "IN" ||
                        e.document_doc_type === "EG") ? (
                        <button
                          type="button"
                          className="inline-block whitespace-nowrap align-middle font-mono text-sm text-primary underline"
                          onClick={() => {
                            setViewDocumentId(e.document_id);
                            setViewDocumentType(
                              e.document_doc_type === "IN"
                                ? "ingresos"
                                : "egresos",
                            );
                          }}
                          title={e.document_number}
                        >
                          {e.document_number}
                        </button>
                      ) : e.document_number ? (
                        <span
                          className="inline-block whitespace-nowrap align-middle font-mono text-sm"
                          title={e.document_number}
                        >
                          {e.document_number}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-left whitespace-nowrap">
                      <Badge
                        variant={ENTRY_TYPE_VARIANTS[getEntryDisplayType(e)]}
                      >
                        {ENTRY_TYPE_LABELS[getEntryDisplayType(e)]}
                      </Badge>
                      {(e.document_doc_type === "IN" &&
                        e.document_ingreso_type) ||
                      (e.document_doc_type === "EG" &&
                        e.document_egreso_type) ? (
                        <>
                          <span className="mx-2 text-muted-foreground">|</span>
                          {e.document_doc_type === "IN" &&
                          e.document_ingreso_type ? (
                            <Badge
                              variant="outline"
                              className={`inline-flex whitespace-nowrap ${INGRESO_TYPE_BADGE_CLASS[e.document_ingreso_type]}`}
                              title={
                                INGRESO_TYPE_LABELS[e.document_ingreso_type]
                              }
                            >
                              {INGRESO_TYPE_LABELS[e.document_ingreso_type]}
                            </Badge>
                          ) : e.document_doc_type === "EG" &&
                            e.document_egreso_type ? (
                            <Badge
                              variant="outline"
                              className={`inline-flex whitespace-nowrap ${EGRESO_TYPE_BADGE_CLASS[e.document_egreso_type]}`}
                              title={EGRESO_TYPE_LABELS[e.document_egreso_type]}
                            >
                              {EGRESO_TYPE_LABELS[e.document_egreso_type]}
                            </Badge>
                          ) : null}
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {e.quantity_in > 0
                        ? formatQuantity(e.quantity_in, quantityMode)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {e.cost_in > 0 ? formatCurrency(e.cost_in) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {e.quantity_in > 0 && e.cost_in > 0
                        ? formatCurrency(e.quantity_in * e.cost_in)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {e.quantity_out > 0
                        ? formatQuantity(e.quantity_out, quantityMode)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {e.cost_out > 0 ? formatCurrency(e.cost_out) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {e.quantity_out > 0 && e.cost_out > 0
                        ? formatCurrency(e.quantity_out * e.cost_out)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center font-medium whitespace-nowrap">
                      {formatQuantity(e.balance_quantity, quantityMode)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                      {formatCurrency(e.balance_value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {viewDocumentId &&
        viewDocumentType &&
        (detailLoading || !detailDoc ? (
          <Dialog open onOpenChange={(open) => !open && closeDocumentModal()}>
            <DialogContent className="w-[min(1200px,calc(100vw-3rem))] max-h-[calc(100vh-3rem)] overflow-y-auto">
              <Skeleton className="h-48" />
            </DialogContent>
          </Dialog>
        ) : (
          <DocumentDetailModal
            doc={detailDoc}
            onClose={closeDocumentModal}
            showCost
            showPrice={detailDoc.doc_type === "EG"}
          />
        ))}
    </div>
  );
}
