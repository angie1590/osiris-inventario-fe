import { useEffect, useRef, useState } from "react";
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

export interface DocumentLine {
  product_id: number;
  product_name: string;
  product_stock?: number;
  quantity: string;
  unit_cost?: string;
  unit_price?: string;
}

interface Props {
  lines: DocumentLine[];
  onChange: (lines: DocumentLine[]) => void;
  showUnitCost?: boolean;
  showUnitPrice?: boolean;
  enforceStockLimit?: boolean;
}

function ProductCombobox({
  onChange,
}: {
  value: number | null;
  onChange: (p: Product) => void;
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

  const productItems = products ?? [];

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-center gap-1 rounded-md border px-2 focus-within:ring-1 focus-within:ring-ring">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Buscar producto..."
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
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground">
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
  enforceStockLimit = false,
}: Props) {
  const { data: settings } = useQuery<{ stock_quantity_mode: "integer" | "decimal" }>({
    queryKey: ["reports", "settings"],
    queryFn: async () => (await api.get("/reports/settings")).data,
    staleTime: 5 * 60 * 1000,
  });
  const integerMode = (settings?.stock_quantity_mode ?? "integer") === "integer";

  const addLine = () => {
    onChange([
      ...lines,
      {
        product_id: 0,
        product_name: "",
        quantity: "1",
        unit_cost: "",
        unit_price: "",
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
              <TableHead className="w-[40%]">Producto</TableHead>
              <TableHead className="w-24">Cantidad</TableHead>
              {showUnitCost && (
                <TableHead className="w-28">Costo unit.</TableHead>
              )}
              {showUnitPrice && (
                <TableHead className="w-28">Precio unit.</TableHead>
              )}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showUnitCost || showUnitPrice ? 4 : 3}
                  className="text-center text-sm text-muted-foreground py-4"
                >
                  Sin líneas. Haz clic en "Agregar línea".
                </TableCell>
              </TableRow>
            )}
            {lines.map((line, i) => (
              <TableRow key={i}>
                <TableCell>
                  <ProductCombobox
                    value={line.product_id || null}
                    onChange={(p) =>
                      updateLine(i, {
                        product_id: p.id,
                        product_name: p.name,
                        product_stock: Number(p.stock_actual),
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  {(() => {
                    const quantityNumber = Number(line.quantity);
                    const exceedsStock =
                      enforceStockLimit &&
                      typeof line.product_stock === "number" &&
                      Number.isFinite(quantityNumber) &&
                      quantityNumber > line.product_stock;

                    return (
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min={integerMode ? "1" : "0.0001"}
                          step={integerMode ? "1" : "0.0001"}
                          className={cn(
                            "h-8 w-28",
                            exceedsStock &&
                              "border-destructive bg-rose-50 text-destructive focus-visible:border-destructive focus-visible:ring-destructive",
                          )}
                          value={line.quantity}
                          onChange={(e) => {
                            let v = e.target.value;
                            // Integer stock mode: strip any decimal part.
                            if (integerMode) v = v.replace(/[.,].*$/, "").replace(/\D/g, "");
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
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-28"
                      placeholder="0.00"
                      value={line.unit_cost ?? ""}
                      onChange={(e) =>
                        updateLine(i, { unit_cost: e.target.value })
                      }
                    />
                  </TableCell>
                )}
                {showUnitPrice && (
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-28"
                      placeholder="0.00"
                      value={line.unit_price ?? ""}
                      onChange={(e) =>
                        updateLine(i, { unit_price: e.target.value })
                      }
                    />
                  </TableCell>
                )}
                <TableCell>
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
        Agregar línea
      </Button>
    </div>
  );
}
