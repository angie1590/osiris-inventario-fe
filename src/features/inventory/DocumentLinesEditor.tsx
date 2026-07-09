import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProducts } from "@/features/catalog/hooks";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";

export type DiscountType = "percent" | "fixed";

export interface DocumentLine {
  product_id: number;
  product_name: string;
  product_stock?: number;
  product_pvp?: number;
  quantity: string;
  unit_cost?: string;
  unit_price?: string;
  discount_type?: DiscountType;
  discount_value?: string;
}

interface Props {
  lines: DocumentLine[];
  onChange: (lines: DocumentLine[]) => void;
  showUnitCost?: boolean;
  showUnitPrice?: boolean;
  showDiscount?: boolean;
  enforceStockLimit?: boolean;
  prioritizeInStock?: boolean;
  lockUnitPrice?: boolean;
  autoFillUnitPriceFromProduct?: boolean;
}

/** Calcula el precio final aplicando el descuento al pvp. */
export function applyDiscount(
  pvp: number,
  discountType: DiscountType,
  discountValue: string,
): number {
  const d = parseFloat(discountValue) || 0;
  if (d <= 0) return pvp;
  if (discountType === "percent") {
    const pct = Math.min(d, 100);
    return Math.max(0, pvp - (pvp * pct) / 100);
  }
  return Math.max(0, pvp - d);
}

/** Convierte el valor de descuento de un tipo a otro. */
export function convertDiscountValue(
  value: string,
  fromType: DiscountType,
  toType: DiscountType,
  pvp: number,
): string {
  if (fromType === toType || pvp <= 0) return value;
  const v = parseFloat(value) || 0;
  if (v === 0) return "";
  if (fromType === "percent" && toType === "fixed") {
    // % -> $: 10% de 1000 = 100
    return ((pvp * v) / 100).toFixed(2);
  } else if (fromType === "fixed" && toType === "percent") {
    // $ -> %: 100 de 1000 = 10%
    return ((v / pvp) * 100).toFixed(2);
  }
  return value;
}

/** Obtiene el equivalente del descuento en la otra unidad. */
export function getEquivalentDiscount(
  value: string,
  discType: DiscountType,
  pvp: number,
): string {
  const v = parseFloat(value) || 0;
  if (v === 0 || pvp <= 0) return "0";
  if (discType === "percent") {
    return ((pvp * v) / 100).toFixed(2);
  }
  return ((v / pvp) * 100).toFixed(2);
}

function ProductCombobox({
  onChange,
  prioritizeInStock = false,
}: {
  value: number | null;
  onChange: (p: Product) => void;
  prioritizeInStock?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { data: products, isLoading } = useProducts({
    name: search || undefined,
    status: "active",
  });

  const updateMenuPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    const onWindowChange = () => updateMenuPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);
    document.addEventListener("mousedown", onDocClick);

    return () => {
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open]);

  const productItems = useMemo(() => {
    const list = [...(products ?? [])];
    if (prioritizeInStock && !search.trim()) {
      // For outbound docs, show products with stock first in the default list.
      list.sort((a, b) => {
        const aHasStock = Number(a.stock_actual) > 0 ? 1 : 0;
        const bHasStock = Number(b.stock_actual) > 0 ? 1 : 0;
        if (aHasStock !== bHasStock) return bHasStock - aHasStock;
        return a.name.localeCompare(b.name, "es-EC", { sensitivity: "base" });
      });
    }
    return list;
  }, [products, prioritizeInStock, search]);

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-center gap-1 rounded-md border px-2 focus-within:ring-1 focus-within:ring-ring">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Buscar por nombre o código de barras..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            updateMenuPosition();
          }}
          onFocus={() => {
            setOpen(true);
            updateMenuPosition();
          }}
        />
      </div>
      {open &&
        createPortal(
          <div
            className="fixed max-h-56 overflow-y-auto rounded-md border bg-popover shadow-md"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 550,
            }}
          >
            {isLoading && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Cargando productos...
              </p>
            )}
            {!isLoading && productItems.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Sin resultados
              </p>
            )}
            {productItems.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-accent"
                onMouseDown={() => {
                  onChange(p);
                  setSearch(p.name);
                  setOpen(false);
                }}
              >
                <div className="min-w-0 text-left">
                  <p className="truncate">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Código de barras: {p.isbn || "—"}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                  Stock: {p.stock_actual}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function DocumentLinesEditor({
  lines,
  onChange,
  showUnitCost = false,
  showUnitPrice = false,
  showDiscount = false,
  enforceStockLimit = false,
  prioritizeInStock = false,
  lockUnitPrice = false,
  autoFillUnitPriceFromProduct = false,
}: Props) {
  const { data: settings } = useQuery<{
    stock_quantity_mode: "integer" | "decimal";
  }>({
    queryKey: ["reports", "settings"],
    queryFn: async () => (await api.get("/reports/settings")).data,
    staleTime: 5 * 60 * 1000,
  });
  const integerMode =
    (settings?.stock_quantity_mode ?? "integer") === "integer";

  const addLine = () => {
    onChange([
      ...lines,
      {
        product_id: 0,
        product_name: "",
        quantity: "1",
        unit_cost: "",
        unit_price: "",
        discount_type: "percent",
        discount_value: "",
      },
    ]);
  };

  const removeLine = (i: number) => {
    onChange(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, partial: Partial<DocumentLine>) => {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...partial } : l)));
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Producto</TableHead>
              <TableHead className="w-24">Cantidad</TableHead>
              {showUnitCost && (
                <TableHead className="w-28">Costo unit.</TableHead>
              )}
              {showDiscount && <TableHead className="w-24">PVP</TableHead>}
              {showDiscount && (
                <TableHead className="w-36">Descuento</TableHead>
              )}
              {showDiscount && (
                <TableHead className="w-28">Precio final</TableHead>
              )}
              {showUnitPrice && !showDiscount && (
                <TableHead className="w-28">Precio unit.</TableHead>
              )}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={
                    3 +
                    (showUnitCost ? 1 : 0) +
                    (showDiscount ? 3 : 0) +
                    (showUnitPrice && !showDiscount ? 1 : 0)
                  }
                  className="text-center text-sm text-muted-foreground py-4"
                >
                  Sin líneas. Haz clic en "Agregar línea".
                </TableCell>
              </TableRow>
            )}
            {lines.map((line, i) => (
              <TableRow key={i}>
                <TableCell className="align-top">
                  <ProductCombobox
                    value={line.product_id || null}
                    prioritizeInStock={prioritizeInStock}
                    onChange={(p) =>
                      updateLine(i, {
                        product_id: p.id,
                        product_name: p.name,
                        product_stock: Number(p.stock_actual),
                        product_pvp: Number(p.pvp ?? 0),
                        ...(autoFillUnitPriceFromProduct
                          ? { unit_price: String(p.pvp ?? "") }
                          : {}),
                      })
                    }
                  />
                </TableCell>
                <TableCell className="align-top">
                  {(() => {
                    const quantityNumber = Number(line.quantity);
                    const exceedsStock =
                      enforceStockLimit &&
                      typeof line.product_stock === "number" &&
                      Number.isFinite(quantityNumber) &&
                      quantityNumber > line.product_stock;

                    return (
                      <div className="relative">
                        <Input
                          type="number"
                          min={integerMode ? "1" : "0.0001"}
                          step={integerMode ? "1" : "0.0001"}
                          disabled={!line.product_id}
                          className={cn(
                            "h-8 w-20 text-center px-1 py-0",
                            !line.product_id && "bg-muted text-muted-foreground cursor-not-allowed",
                            exceedsStock &&
                              "border-destructive bg-rose-50 text-destructive focus-visible:border-destructive focus-visible:ring-destructive",
                          )}
                          value={line.quantity}
                          onChange={(e) => {
                            let v = e.target.value;
                            // Integer stock mode: strip any decimal part.
                            if (integerMode)
                              v = v.replace(/[.,].*$/, "").replace(/\D/g, "");
                            updateLine(i, { quantity: v });
                          }}
                          aria-invalid={exceedsStock || undefined}
                        />
                        {typeof line.product_stock === "number" && (
                          <p className="text-[11px] text-muted-foreground">
                            Disp: {line.product_stock}
                          </p>
                        )}
                        {exceedsStock && (
                          <p className="text-[11px] font-medium text-destructive">
                            Cantidad superior al stock disponible.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </TableCell>
                {showUnitCost && (
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-28 text-right pl-1 pr-2"
                      placeholder="0.00"
                      value={line.unit_cost ?? ""}
                      onChange={(e) =>
                        updateLine(i, { unit_cost: e.target.value })
                      }
                    />
                  </TableCell>
                )}
                {showDiscount &&
                  (() => {
                    const pvp = line.product_pvp ?? 0;
                    const discType = line.discount_type ?? "percent";
                    const finalPrice =
                      pvp > 0
                        ? applyDiscount(
                            pvp,
                            discType,
                            line.discount_value ?? "",
                          )
                        : 0;
                    const discountExceedsPvp =
                      pvp > 0 &&
                      (line.discount_value ?? "") !== "" &&
                      finalPrice <= 0;
                    return (
                      <>
                        {/* PVP locked */}
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            className="h-8 w-24 bg-muted text-muted-foreground text-right pl-1 pr-2"
                            value={pvp > 0 ? pvp.toFixed(2) : ""}
                            readOnly
                            placeholder="—"
                            title="Precio de venta del producto"
                          />
                        </TableCell>

                        {/* Descuento: toggle tipo + valor */}
                        <TableCell className="align-top">
                          <div className="relative">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={!line.product_id}
                                className={cn(
                                  "h-8 rounded-l-md border px-2 text-xs font-semibold transition-colors",
                                  !line.product_id && "opacity-50 cursor-not-allowed",
                                  discType === "percent"
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input bg-background text-muted-foreground hover:bg-accent",
                                )}
                                onClick={() => {
                                  if (discType !== "percent") {
                                    const converted = convertDiscountValue(
                                      line.discount_value ?? "",
                                      discType,
                                      "percent",
                                      pvp,
                                    );
                                    updateLine(i, {
                                      discount_type: "percent",
                                      discount_value: converted,
                                    });
                                  }
                                }}
                                title="Descuento en porcentaje"
                              >
                                %
                              </button>
                              <button
                                type="button"
                                disabled={!line.product_id}
                                className={cn(
                                  "h-8 rounded-r-md border-y border-r px-2 text-xs font-semibold transition-colors",
                                  !line.product_id && "opacity-50 cursor-not-allowed",
                                  discType === "fixed"
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input bg-background text-muted-foreground hover:bg-accent",
                                )}
                                onClick={() => {
                                  if (discType !== "fixed") {
                                    const converted = convertDiscountValue(
                                      line.discount_value ?? "",
                                      discType,
                                      "fixed",
                                      pvp,
                                    );
                                    updateLine(i, {
                                      discount_type: "fixed",
                                      discount_value: converted,
                                    });
                                  }
                                }}
                                title="Descuento en valor fijo"
                              >
                                $
                              </button>
                              <Input
                                type="number"
                                min="0"
                                max={discType === "percent" ? "100" : undefined}
                                step="0.01"
                                disabled={!line.product_id}
                                className={cn(
                                  "h-8 w-28 text-right pl-1 pr-2",
                                  !line.product_id && "bg-muted text-muted-foreground cursor-not-allowed",
                                  discountExceedsPvp &&
                                    "border-destructive bg-rose-50 text-destructive",
                                )}
                                placeholder={
                                  discType === "percent" ? "0 %" : "0.00"
                                }
                                value={line.discount_value ?? ""}
                                onChange={(e) =>
                                  updateLine(i, {
                                    discount_value: e.target.value,
                                  })
                                }
                              />
                            </div>
                            {(line.discount_value ?? "") !== "" && pvp > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                {discType === "percent"
                                  ? `≈ $${getEquivalentDiscount(
                                      line.discount_value ?? "",
                                      discType,
                                      pvp,
                                    )}`
                                  : `≈ ${getEquivalentDiscount(
                                      line.discount_value ?? "",
                                      discType,
                                      pvp,
                                    )}%`}
                              </p>
                            )}
                            {discountExceedsPvp && (
                              <p className="text-[11px] font-medium text-destructive">
                                Descuento supera el PVP.
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Precio final calculado */}
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            className="h-8 w-28 bg-muted font-medium text-foreground text-right pl-1 pr-2"
                            value={pvp > 0 ? finalPrice.toFixed(2) : ""}
                            readOnly
                            placeholder="—"
                            title="Precio final tras descuento"
                          />
                        </TableCell>
                      </>
                    );
                  })()}

                {showUnitPrice && !showDiscount && (
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className={cn(
                        "h-8 w-28 text-right pl-1 pr-2",
                        lockUnitPrice && "bg-muted text-muted-foreground",
                      )}
                      placeholder="0.00"
                      value={line.unit_price ?? ""}
                      onChange={(e) => {
                        if (lockUnitPrice) return;
                        updateLine(i, { unit_price: e.target.value });
                      }}
                      readOnly={lockUnitPrice}
                      title={
                        lockUnitPrice
                          ? "Precio unitario tomado del producto"
                          : undefined
                      }
                    />
                  </TableCell>
                )}
                <TableCell className="align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeLine(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Agregar ítem
      </Button>
    </div>
  );
}
