import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { useKardex } from "@/features/kardex/hooks";
import { useProducts } from "@/features/catalog/hooks";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import type { KardexEntryType } from "@/types/api";

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
    return (products ?? []).filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productQuery]);
  const {
    data: kardex,
    isLoading,
    isError,
    refetch,
  } = useKardex(selectedProductId, dateFrom || undefined, dateTo || undefined);

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
                    placeholder="Buscar producto..."
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

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Fecha</TableHead>
                  <TableHead className="text-center">Documento</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Cant. entrada</TableHead>
                  <TableHead className="text-center">Costo unitario</TableHead>
                  <TableHead className="text-center">Valor entrada</TableHead>
                  <TableHead className="text-center">Cant. salida</TableHead>
                  <TableHead className="text-center">Costo unitario</TableHead>
                  <TableHead className="text-center">Valor salida</TableHead>
                  <TableHead className="text-center">Saldo cant.</TableHead>
                  <TableHead className="text-center">Saldo valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kardex.opening_balance_quantity > 0 && (
                  <TableRow className="bg-muted/30 italic">
                    <TableCell className="text-left text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-left">
                      <Badge variant="secondary">Saldo inicial</Badge>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-center font-medium">
                      {formatQuantity(
                        kardex.opening_balance_quantity,
                        quantityMode,
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
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
                    <TableCell className="text-left text-sm text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("es-EC")}
                    </TableCell>
                    <TableCell className="text-left whitespace-nowrap">
                      {e.document_number && e.document_id ? (
                        <Link
                          className="inline-block whitespace-nowrap font-mono text-sm text-primary underline"
                          to={
                            e.document_doc_type === "IN"
                              ? `/inventory/ingresos/${e.document_id}`
                              : e.document_doc_type === "EG"
                                ? `/inventory/egresos/${e.document_id}`
                                : e.document_doc_type === "BI"
                                  ? `/inventory/bajas/${e.document_id}`
                                  : e.document_doc_type === "AI"
                                    ? `/inventory/ajustes/${e.document_id}`
                                    : "#"
                          }
                        >
                          {e.document_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-left">
                      <Badge variant={ENTRY_TYPE_VARIANTS[e.entry_type]}>
                        {ENTRY_TYPE_LABELS[e.entry_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {e.quantity_in > 0
                        ? formatQuantity(e.quantity_in, quantityMode)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.cost_in > 0 ? formatCurrency(e.cost_in) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.quantity_in > 0 && e.cost_in > 0
                        ? formatCurrency(e.quantity_in * e.cost_in)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {e.quantity_out > 0
                        ? formatQuantity(e.quantity_out, quantityMode)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.cost_out > 0 ? formatCurrency(e.cost_out) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.quantity_out > 0 && e.cost_out > 0
                        ? formatCurrency(e.quantity_out * e.cost_out)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {formatQuantity(e.balance_quantity, quantityMode)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(e.balance_value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
