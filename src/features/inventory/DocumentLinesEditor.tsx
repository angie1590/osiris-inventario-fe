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
import { formatCurrency, formatQuantity as formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";

export type DiscountType = "percent" | "fixed";

export interface DocumentLine {
  product_id: number;
  product_name: string;
  product_stock?: number;
  product_code?: string | null;
  product_pvp?: number;
  quantity: string;
  unit_cost?: string;
  unit_cost_locked?: boolean;
  unit_cost_hint?: string;
  unit_price?: string;
  discount_type?: DiscountType;
  discount_value?: string;
}

interface Props {
  lines: DocumentLine[];
  onChange: (lines: DocumentLine[]) => void;
  defaultDiscountType?: DiscountType;
  showUnitCost?: boolean;
  showUnitPrice?: boolean;
  showDiscount?: boolean;
  enforceStockLimit?: boolean;
  prioritizeInStock?: boolean;
  lockUnitPrice?: boolean;
  autoFillUnitPriceFromProduct?: boolean;
  showSubtotal?: boolean;
  showTotals?: boolean;
  readOnly?: boolean;
  readOnlyUnitCost?: boolean;
  maxLines?: number;
  fillHeight?: boolean;
  unitPriceLabel?: string;
  subtotalLabel?: string;
  totalsAmountLabel?: string;
  showProductCode?: boolean;
  productCodeLabel?: string;
  productCodeMode?: "internal" | "barcode";
}

/** Calcula el total final aplicando el descuento al subtotal. */
export function applyDiscount(
  amount: number,
  discountType: DiscountType,
  discountValue: string,
): number {
  const d = parseFloat(discountValue) || 0;
  if (d <= 0) return amount;
  if (discountType === "percent") {
    const pct = Math.min(d, 100);
    return Math.max(0, amount - (amount * pct) / 100);
  }
  return Math.max(0, amount - d);
}

/** Convierte el valor de descuento de un tipo a otro. */
export function convertDiscountValue(
  value: string,
  fromType: DiscountType,
  toType: DiscountType,
  amount: number,
): string {
  if (fromType === toType || amount <= 0) return value;
  const v = parseFloat(value) || 0;
  if (v === 0) return "";
  if (fromType === "percent" && toType === "fixed") {
    return ((amount * v) / 100).toFixed(2);
  } else if (fromType === "fixed" && toType === "percent") {
    return ((v / amount) * 100).toFixed(2);
  }
  return value;
}

/** Obtiene el equivalente del descuento en la otra unidad. */
export function getEquivalentDiscount(
  value: string,
  discType: DiscountType,
  amount: number,
): string {
  const v = parseFloat(value) || 0;
  if (v === 0 || amount <= 0) return "0";
  if (discType === "percent") {
    return ((amount * v) / 100).toFixed(2);
  }
  return ((v / amount) * 100).toFixed(2);
}

function ProductCombobox({
  lineIndex,
  value,
  onChange,
  onDeleteLine,
  onScan,
  prioritizeInStock = false,
  integerMode = true,
}: {
  lineIndex: number;
  value: number | null;
  onChange: (p: Product) => boolean | void;
  onDeleteLine: () => void;
  onScan?: () => void;
  prioritizeInStock?: boolean;
  integerMode?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { data: products, isLoading } = useProducts({
    name: search || undefined,
    status: "active",
    stock_desc: prioritizeInStock,
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

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  const productItems = useMemo(() => {
    const list = [...(products ?? [])];
    list.sort((a, b) => {
      if (prioritizeInStock) {
        const stockDifference = Number(b.stock_actual) - Number(a.stock_actual);
        if (stockDifference !== 0) return stockDifference;
      }
      return a.name.localeCompare(b.name, "es-EC", { sensitivity: "base" });
    });
    return list;
  }, [products, prioritizeInStock]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = productItems.findIndex((item) => item.id === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, productItems, value]);

  const selectProduct = (product: Product) => {
    if (onChange(product) === false) return;
    setSearch(product.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (!open || !search.trim() || productItems.length !== 1) return;
    const onlyProduct = productItems[0];
    if (value === onlyProduct.id) return;
    selectProduct(onlyProduct);
  }, [open, productItems, search, value]);

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const selectActiveMatch = () => {
    const normalizedSearch = search.trim().toLowerCase();
    const exactCode = productItems.filter(
      (item) =>
        normalizedSearch &&
        [item.isbn, item.codigo_interno].some(
          (code) => code?.trim().toLowerCase() === normalizedSearch,
        ),
    );
    const option =
      exactCode.length === 1
        ? exactCode[0]
        : (productItems[activeIndex] ?? productItems[0]);
    if (!option) return;
    const scanned = exactCode.length === 1 && exactCode[0].id === option.id;
    if (onChange(option) === false) return;
    setSearch(option.name);
    setOpen(false);
    inputRef.current?.blur();
    if (scanned) onScan?.();
  };
  return (
    <div className="relative" ref={rootRef} data-line-index={lineIndex}>
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              onDeleteLine();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) setOpen(true);
              setActiveIndex((current) =>
                productItems.length === 0
                  ? 0
                  : (current + 1) % productItems.length,
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) setOpen(true);
              setActiveIndex((current) =>
                productItems.length === 0
                  ? 0
                  : (current - 1 + productItems.length) % productItems.length,
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              selectActiveMatch();
              selectActiveMatch();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
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
                ref={(node) => {
                  const optionIndex = productItems.findIndex(
                    (item) => item.id === p.id,
                  );
                  optionRefs.current[optionIndex] = node;
                }}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-accent",
                  activeIndex ===
                    productItems.findIndex((item) => item.id === p.id) &&
                    "bg-primary/10 font-medium text-foreground ring-1 ring-inset ring-primary/30 hover:bg-primary/10",
                )}
                onMouseEnter={() => {
                  const optionIndex = productItems.findIndex(
                    (item) => item.id === p.id,
                  );
                  setActiveIndex(optionIndex);
                }}
                onMouseDown={() => {
                  if (onChange(p) === false) return;
                  setSearch(p.name);
                  setOpen(false);
                  inputRef.current?.blur();
                }}
              >
                <div className="min-w-0 text-left">
                  <p className="truncate">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Código de barras: {p.isbn || "—"}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                  Stock:{" "}
                  {formatQty(
                    p.stock_actual,
                    integerMode ? "integer" : "decimal",
                  )}
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
  defaultDiscountType = "percent",
  showUnitCost = false,
  showUnitPrice = false,
  showDiscount = false,
  enforceStockLimit = false,
  prioritizeInStock = false,
  lockUnitPrice = false,
  autoFillUnitPriceFromProduct = false,
  showSubtotal = false,
  showTotals = false,
  readOnly = false,
  readOnlyUnitCost = false,
  maxLines,
  fillHeight = false,
  unitPriceLabel = "Precio unit.",
  subtotalLabel = "Subtotal",
  totalsAmountLabel = "Total del ingreso",
  showProductCode = false,
  productCodeLabel = "Código",
  productCodeMode = "internal",
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
  const [lastDeletedLine, setLastDeletedLine] = useState<{
    line: DocumentLine;
    index: number;
  } | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);

  const scrollToLastLine = () => {
    window.setTimeout(() => {
      const box = scrollBoxRef.current;
      if (box) box.scrollTop = box.scrollHeight;
    }, 0);
  };

  const addLine = () => {
    if (maxLines !== undefined && lines.length >= maxLines) return;
    setLastDeletedLine(null);
    scrollToLastLine();
    onChange([
      ...lines,
      {
        product_id: 0,
        product_name: "",
        quantity: "1",
        unit_cost: "",
        unit_price: "",
        discount_type: defaultDiscountType,
        discount_value: "",
      },
    ]);
  };

  const clearUndo = () => setLastDeletedLine(null);

  const focusLineProduct = (lineIndex: number) => {
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-line-index="${lineIndex}"] input`,
      );
      input?.focus();
      input?.select?.();
    }, 0);
  };

  const focusLineQuantity = (lineIndex: number) => {
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-quantity-index="${lineIndex}"]`,
      );
      input?.focus();
      input?.select?.();
    }, 0);
  };

  const addLineAndFocus = () => {
    const nextLineIndex = lines.length;
    addLine();
    focusLineProduct(nextLineIndex);
  };

  const removeLine = (i: number) => {
    const removedLine = lines[i];
    if (!removedLine) return;
    setLastDeletedLine({ line: removedLine, index: i });
    onChange(lines.filter((_, idx) => idx !== i));
    window.setTimeout(() => {
      const nextIndex = lines.length > 1 ? Math.min(i, lines.length - 2) : -1;
      if (nextIndex >= 0) {
        focusLineProduct(nextIndex);
      } else {
        addButtonRef.current?.focus();
      }
    }, 0);
  };

  const updateLine = (i: number, partial: Partial<DocumentLine>) => {
    clearUndo();
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...partial } : l)));
  };

  const restoreLastDeletedLine = () => {
    if (!lastDeletedLine) return;
    const nextLines = [...lines];
    nextLines.splice(
      Math.min(lastDeletedLine.index, nextLines.length),
      0,
      lastDeletedLine.line,
    );
    setLastDeletedLine(null);
    onChange(nextLines);
    window.setTimeout(() => {
      focusLineProduct(Math.min(lastDeletedLine.index, nextLines.length - 1));
    }, 0);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!lastDeletedLine) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      restoreLastDeletedLine();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [lastDeletedLine, lines]);

  const totals = useMemo(() => {
    const totalUnits = lines.reduce((acc, line) => {
      const qty = Number(line.quantity || 0);
      return acc + (Number.isFinite(qty) ? qty : 0);
    }, 0);
    const totalAmount = lines.reduce((acc, line) => {
      const qty = Number(line.quantity || 0);
      const cost = Number(line.unit_cost || 0);
      if (!Number.isFinite(qty) || !Number.isFinite(cost)) return acc;
      return acc + qty * cost;
    }, 0);
    return { totalUnits, totalAmount };
  }, [lines]);

  const discountSummaries = useMemo(
    () =>
      lines.map((line) => {
        const quantity = Number(line.quantity || 0);
        const unitPrice = Number(line.product_pvp ?? line.unit_price ?? 0);
        const subtotal = quantity * unitPrice;
        const discountType = line.discount_type ?? defaultDiscountType;
        const discountValue = Math.max(0, Number(line.discount_value || 0));
        const total = applyDiscount(
          subtotal,
          discountType,
          line.discount_value ?? "",
        );
        const appliedDiscount = Math.max(0, subtotal - total);
        return {
          subtotal,
          discount: discountType === "fixed" ? discountValue : appliedDiscount,
          total,
        };
      }),
    [lines],
  );

  return (
    <div
      className={cn("space-y-2", fillHeight && "flex min-h-0 flex-1 flex-col")}
    >
      <div
        className={cn("rounded-md border", fillHeight && "flex min-h-0 flex-1")}
      >
        <Table
          containerRef={scrollBoxRef}
          containerClassName={cn(
            fillHeight && "min-h-0 flex-1 overflow-y-auto",
          )}
        >
          <TableHeader
            className={cn(
              fillHeight &&
                "[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-[hsl(var(--table-head))]",
            )}
          >
            <TableRow>
              <TableHead className="w-[35%] text-center">Producto</TableHead>
              {showProductCode && (
                <TableHead className="w-28 text-center">
                  {productCodeLabel}
                </TableHead>
              )}
              <TableHead className="w-24 text-center">Cantidad</TableHead>
              {showUnitCost && (
                <TableHead className="w-28 text-center">
                  Costo unitario
                </TableHead>
              )}
              {showUnitPrice && (
                <TableHead className="w-28 text-center">
                  {unitPriceLabel}
                </TableHead>
              )}
              {showSubtotal && (
                <TableHead className="w-28 text-center">
                  {subtotalLabel}
                </TableHead>
              )}
              {showDiscount && (
                <TableHead className="w-36 text-center">Descuento</TableHead>
              )}
              {showDiscount && (
                <TableHead className="w-28 text-center">Precio final</TableHead>
              )}
              <TableHead className="w-10 text-center" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={
                    3 +
                    (showProductCode ? 1 : 0) +
                    (showUnitCost ? 1 : 0) +
                    (showUnitPrice ? 1 : 0) +
                    (showSubtotal ? 1 : 0) +
                    (showDiscount ? 2 : 0)
                  }
                  className="text-center text-sm text-muted-foreground py-4"
                >
                  Sin ítems. Haz clic en "Agregar ítem".
                </TableCell>
              </TableRow>
            )}
            {lines.map((line, i) => (
              <TableRow key={i}>
                <TableCell className="align-top">
                  <ProductCombobox
                    lineIndex={i}
                    value={line.product_id || null}
                    prioritizeInStock={prioritizeInStock}
                    onDeleteLine={() => removeLine(i)}
                    integerMode={integerMode}
                    onScan={() => {
                      if (i !== lines.length - 1) return;
                      addLineAndFocus();
                    }}
                    onChange={(p) => {
                      const duplicateIndex = lines.findIndex(
                        (currentLine, currentIndex) =>
                          currentIndex !== i && currentLine.product_id === p.id,
                      );
                      if (duplicateIndex >= 0) {
                        const confirmed = window.confirm(
                          `El producto "${p.name}" ya está en la lista. Se aumentará su cantidad en 1.`,
                        );
                        if (!confirmed) return false;
                        const current = Number(
                          lines[duplicateIndex].quantity ?? 0,
                        );
                        const nextQuantity = Number.isFinite(current)
                          ? current + 1
                          : 1;
                        clearUndo();
                        onChange(
                          lines
                            .map((currentLine, currentIndex) =>
                              currentIndex === duplicateIndex
                                ? {
                                    ...currentLine,
                                    quantity: String(nextQuantity),
                                  }
                                : currentLine,
                            )
                            .filter((_, currentIndex) => currentIndex !== i),
                        );
                        focusLineQuantity(
                          duplicateIndex > i
                            ? duplicateIndex - 1
                            : duplicateIndex,
                        );
                        return false;
                      }
                      clearUndo();
                      updateLine(i, {
                        product_id: p.id,
                        product_name: p.name,
                        product_stock: Number(p.stock_actual),
                        product_code: showProductCode
                          ? productCodeMode === "internal"
                            ? p.codigo_interno
                            : p.isbn
                          : null,
                        product_pvp: Number(p.pvp ?? 0),
                        unit_cost: "",
                        unit_cost_locked: false,
                        unit_cost_hint: undefined,
                        ...(autoFillUnitPriceFromProduct
                          ? { unit_price: Number(p.pvp ?? 0).toFixed(2) }
                          : {}),
                      });
                      return true;
                    }}
                  />
                </TableCell>
                {showProductCode && (
                  <TableCell className="align-middle text-center text-sm">
                    {line.product_code || "—"}
                  </TableCell>
                )}
                <TableCell className="align-middle text-center">
                  {(() => {
                    const quantityNumber = Number(line.quantity);
                    const exceedsStock =
                      enforceStockLimit &&
                      typeof line.product_stock === "number" &&
                      Number.isFinite(quantityNumber) &&
                      quantityNumber > line.product_stock;

                    return (
                      <div className="relative flex flex-col items-center">
                        <Input
                          type="number"
                          data-quantity-index={i}
                          min={integerMode ? "1" : "0.0001"}
                          step={integerMode ? "1" : "0.0001"}
                          disabled={!line.product_id || readOnly}
                          className={cn(
                            "h-8 w-20 text-center px-1 py-0",
                            !line.product_id &&
                              "bg-muted text-muted-foreground cursor-not-allowed",
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
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.shiftKey) {
                              e.preventDefault();
                              removeLine(i);
                              return;
                            }
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            if (i === lines.length - 1 && line.product_id) {
                              addLineAndFocus();
                            }
                          }}
                          aria-invalid={exceedsStock || undefined}
                        />
                        {typeof line.product_stock === "number" && (
                          <p className="text-[11px] text-center text-muted-foreground">
                            Disp:{" "}
                            {formatQty(
                              line.product_stock,
                              integerMode ? "integer" : "decimal",
                            )}
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
                  <TableCell className="align-top text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn(
                          "h-8 w-28 text-center pl-1 pr-2",
                          (readOnlyUnitCost || line.unit_cost_locked) &&
                            "bg-muted text-muted-foreground",
                        )}
                        placeholder="0.00"
                        disabled={readOnly}
                        readOnly={
                          readOnly || readOnlyUnitCost || line.unit_cost_locked
                        }
                        value={line.unit_cost ?? ""}
                        onChange={(e) =>
                          readOnlyUnitCost || line.unit_cost_locked
                            ? undefined
                            : updateLine(i, { unit_cost: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.shiftKey) {
                            e.preventDefault();
                            removeLine(i);
                            return;
                          }
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          if (i === lines.length - 1 && line.product_id) {
                            addLineAndFocus();
                          }
                        }}
                      />
                      {line.unit_cost_hint && (
                        <p className="max-w-32 text-[11px] leading-tight text-muted-foreground">
                          {line.unit_cost_hint}
                        </p>
                      )}
                    </div>
                  </TableCell>
                )}
                {showUnitPrice && (
                  <TableCell className="align-top text-right">
                    <div className="relative w-28">
                      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn(
                          "h-8 w-28 text-right pl-5 pr-2",
                          showDiscount || lockUnitPrice
                            ? "bg-muted text-muted-foreground"
                            : "",
                        )}
                        placeholder="0.00"
                        value={
                          showDiscount
                            ? Number(line.product_pvp ?? 0).toFixed(2)
                            : (line.unit_price ?? "")
                        }
                        onChange={(e) => {
                          if (showDiscount || lockUnitPrice) return;
                          updateLine(i, { unit_price: e.target.value });
                        }}
                        onBlur={() => {
                          if (showDiscount || lockUnitPrice || !line.unit_price)
                            return;
                          updateLine(i, {
                            unit_price: Number(line.unit_price).toFixed(2),
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.shiftKey) {
                            e.preventDefault();
                            removeLine(i);
                            return;
                          }
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          if (i === lines.length - 1 && line.product_id) {
                            addLineAndFocus();
                          }
                        }}
                        readOnly={showDiscount || lockUnitPrice || readOnly}
                        title={
                          showDiscount || lockUnitPrice
                            ? "Precio unitario tomado del producto"
                            : undefined
                        }
                      />
                    </div>
                  </TableCell>
                )}
                {showSubtotal && (
                  <TableCell className="align-middle text-right font-medium tabular-nums">
                    {formatCurrency(
                      showDiscount
                        ? (discountSummaries[i]?.subtotal ?? 0)
                        : Number(line.quantity || 0) *
                            Number(line.unit_cost || 0),
                    )}
                  </TableCell>
                )}
                {showDiscount &&
                  (() => {
                    const pvp = line.product_pvp ?? 0;
                    const quantity = Number(line.quantity || 0);
                    const subtotal = quantity * pvp;
                    const discType = line.discount_type ?? defaultDiscountType;
                    const finalPrice =
                      subtotal > 0
                        ? applyDiscount(
                            subtotal,
                            discType,
                            line.discount_value ?? "",
                          )
                        : 0;
                    const discountExceedsPvp =
                      subtotal > 0 &&
                      (line.discount_value ?? "") !== "" &&
                      finalPrice <= 0;
                    return (
                      <>
                        <TableCell className="align-top text-right">
                          <div className="relative">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                disabled={!line.product_id || readOnly}
                                className={cn(
                                  "h-8 rounded-l-md border px-2 text-xs font-semibold transition-colors",
                                  !line.product_id &&
                                    "opacity-50 cursor-not-allowed",
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
                                      subtotal,
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
                                disabled={!line.product_id || readOnly}
                                className={cn(
                                  "h-8 rounded-r-md border-y border-r px-2 text-xs font-semibold transition-colors",
                                  !line.product_id &&
                                    "opacity-50 cursor-not-allowed",
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
                                      subtotal,
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
                                readOnly={readOnly}
                                className={cn(
                                  "h-8 w-28 text-right pl-1 pr-2",
                                  !line.product_id &&
                                    "bg-muted text-muted-foreground cursor-not-allowed",
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
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && e.shiftKey) {
                                    e.preventDefault();
                                    removeLine(i);
                                    return;
                                  }
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  if (
                                    i === lines.length - 1 &&
                                    line.product_id
                                  ) {
                                    addLineAndFocus();
                                  }
                                }}
                              />
                            </div>
                            {(line.discount_value ?? "") !== "" &&
                              subtotal > 0 && (
                                <p className="text-[11px] text-right text-muted-foreground">
                                  {discType === "percent"
                                    ? `≈ $${getEquivalentDiscount(
                                        line.discount_value ?? "",
                                        discType,
                                        subtotal,
                                      )}`
                                    : `≈ ${getEquivalentDiscount(
                                        line.discount_value ?? "",
                                        discType,
                                        subtotal,
                                      )}%`}
                                </p>
                              )}
                            {discountExceedsPvp && (
                              <p className="text-[11px] text-right font-medium text-destructive">
                                Descuento supera el PVP.
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Precio final calculado */}
                        <TableCell className="align-top text-right">
                          <Input
                            type="number"
                            className="h-8 w-28 bg-muted font-medium text-right text-foreground pl-1 pr-2"
                            value={subtotal > 0 ? finalPrice.toFixed(2) : ""}
                            readOnly
                            placeholder="—"
                            title="Precio final tras descuento"
                          />
                        </TableCell>
                      </>
                    );
                  })()}
                <TableCell className="align-middle text-center">
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={readOnly}
                      onClick={() => removeLine(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {showTotals && (
        <div className="flex flex-wrap items-center justify-end gap-6 rounded-md border bg-muted/20 px-3 py-2 text-sm">
          {showDiscount ? (
            <>
              <p className="font-semibold">Totales:</p>
              <p>
                Ítems. <span className="font-semibold">{lines.length}</span>
              </p>
              <p>
                Productos.{" "}
                <span className="font-semibold">
                  {formatQty(
                    totals.totalUnits,
                    integerMode ? "integer" : "decimal",
                  )}
                </span>
              </p>
              <p>
                Subtotal.{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(
                    discountSummaries.reduce(
                      (acc, line) => acc + line.subtotal,
                      0,
                    ),
                  )}
                </span>
              </p>
              <p>
                Descuento.{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(
                    discountSummaries.reduce(
                      (acc, line) => acc + line.discount,
                      0,
                    ),
                  )}
                </span>
              </p>
              <p>
                PVP Final.{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(
                    discountSummaries.reduce(
                      (acc, line) => acc + line.total,
                      0,
                    ),
                  )}
                </span>
              </p>
            </>
          ) : (
            <>
              <p>
                Total de unidades:{" "}
                <span className="font-semibold">
                  {formatQty(
                    totals.totalUnits,
                    integerMode ? "integer" : "decimal",
                  )}
                </span>
              </p>
              <p>
                {totalsAmountLabel}:{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(totals.totalAmount)}
                </span>
              </p>
            </>
          )}
        </div>
      )}
      {lastDeletedLine && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm">
          <p className="text-muted-foreground">
            Línea eliminada:{" "}
            {lastDeletedLine.line.product_name || "sin producto"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={restoreLastDeletedLine}
          >
            Deshacer
          </Button>
        </div>
      )}
      <Button
        ref={addButtonRef}
        type="button"
        variant="outline"
        size="sm"
        className={cn(fillHeight && "self-start")}
        onClick={addLineAndFocus}
        disabled={
          readOnly || (maxLines !== undefined && lines.length >= maxLines)
        }
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Agregar ítem
      </Button>
    </div>
  );
}
