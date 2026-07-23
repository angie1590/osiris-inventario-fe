import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProducts } from "@/features/catalog/hooks";
import { useStockMode } from "@/hooks/useStockMode";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";

export interface CountDraftLine {
  product_id: number;
  product_name: string;
  physical_quantity: string;
}

function ProductCombobox({
  lineIndex,
  value,
  initialLabel,
  onChange,
  readOnly = false,
  onRequestNextLine,
}: {
  lineIndex: number;
  value: number | null;
  initialLabel?: string;
  onChange: (product: Product) => void;
  readOnly?: boolean;
  onRequestNextLine?: () => void;
}) {
  const [search, setSearch] = useState(initialLabel ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { data: products, isLoading } = useProducts({
    name: search || undefined,
    status: "active",
  });

  const productItems = useMemo(() => products ?? [], [products]);

  useEffect(() => {
    setSearch(initialLabel ?? "");
  }, [initialLabel, value]);

  const updateMenuPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const selectProduct = (product: Product) => {
    onChange(product);
    setSearch(product.name);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef} data-line-index={lineIndex}>
      <div className="flex items-center gap-1 rounded-md border px-2 focus-within:ring-1 focus-within:ring-ring">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Nombre, código de barras o interno"
          value={search}
          disabled={readOnly}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            updateMenuPosition();
          }}
          onFocus={() => {
            if (readOnly) return;
            setOpen(true);
            updateMenuPosition();
          }}
          onKeyDown={(e) => {
            if (readOnly) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((current) =>
                productItems.length === 0
                  ? 0
                  : (current + 1) % productItems.length,
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((current) =>
                productItems.length === 0
                  ? 0
                  : (current - 1 + productItems.length) % productItems.length,
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const selected = productItems[activeIndex] ?? productItems[0];
              if (selected && open) {
                selectProduct(selected);
                return;
              }
              if (value) onRequestNextLine?.();
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
            {productItems.map((product, index) => (
              <button
                key={`${product.id}-${index}`}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-accent",
                  activeIndex === index &&
                    "bg-primary/10 font-medium text-foreground ring-1 ring-inset ring-primary/30 hover:bg-primary/10",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={() => selectProduct(product)}
              >
                <div className="min-w-0 text-left">
                  <p className="truncate">{product.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    CB: {product.isbn || "—"} | Int:{" "}
                    {product.codigo_interno || "—"}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                  Stock: {product.stock_actual}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      {value ? null : null}
    </div>
  );
}

export function CountLinesEditor({
  lines,
  onChange,
  readOnly = false,
}: {
  lines: CountDraftLine[];
  onChange: (lines: CountDraftLine[]) => void;
  readOnly?: boolean;
}) {
  const { integerMode } = useStockMode();

  const focusProductSearchAt = (lineIndex: number) => {
    requestAnimationFrame(() => {
      const rowRoot = document.querySelector(
        `[data-line-index="${lineIndex}"]`,
      );
      const input = rowRoot?.querySelector("input") as HTMLInputElement | null;
      input?.focus();
    });
  };

  const addLine = (afterIndex?: number) => {
    const nextLine = {
      product_id: 0,
      product_name: "",
      physical_quantity: "1",
    };
    if (
      afterIndex === undefined ||
      afterIndex < 0 ||
      afterIndex >= lines.length
    ) {
      onChange([...lines, nextLine]);
      focusProductSearchAt(lines.length);
      return;
    }
    const nextLines = [...lines];
    nextLines.splice(afterIndex + 1, 0, nextLine);
    onChange(nextLines);
    focusProductSearchAt(afterIndex + 1);
  };

  const updateLine = (index: number, partial: Partial<CountDraftLine>) => {
    onChange(
      lines.map((line, current) =>
        current === index ? { ...line, ...partial } : line,
      ),
    );
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, current) => current !== index));
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70%]">Producto</TableHead>
              <TableHead className="w-32 text-center">
                Cantidad física
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-4 text-center text-sm text-muted-foreground"
                >
                  Sin ítems.
                </TableCell>
              </TableRow>
            )}
            {lines.map((line, index) => (
              <TableRow key={index}>
                <TableCell>
                  <ProductCombobox
                    lineIndex={index}
                    value={line.product_id || null}
                    initialLabel={line.product_name}
                    readOnly={readOnly}
                    onRequestNextLine={() => addLine(index)}
                    onChange={(product) =>
                      updateLine(index, {
                        product_id: product.id,
                        product_name: product.name,
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={integerMode ? "1" : "0.0001"}
                    step={integerMode ? "1" : "0.0001"}
                    disabled={!line.product_id || readOnly}
                    className="text-center"
                    value={line.physical_quantity}
                    onChange={(e) =>
                      updateLine(index, {
                        physical_quantity: integerMode
                          ? e.target.value
                              .replace(/[.,].*$/, "")
                              .replace(/\D/g, "")
                          : e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      addLine(index);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={readOnly}
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!readOnly && (
        <Button type="button" variant="outline" onClick={() => addLine()}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar producto
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Puedes repetir un producto mientras capturas. Al guardar, el sistema
        consolidará las líneas por producto y sumará la cantidad física.
      </p>
    </div>
  );
}
