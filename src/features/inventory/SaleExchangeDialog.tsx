import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useProducts } from "@/features/catalog/hooks";
import { useExchangeSale } from "@/features/inventory/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { InventoryDocument } from "@/types/api";

type ReturnedRow = {
  product_id: string;
  quantity: string;
  return_condition: "available" | "damaged" | "requires_review";
};
type NewRow = {
  product_id: string;
  quantity: string;
  unit_price: string;
  product_label?: string;
  product_barcode?: string;
  product_stock?: number;
};

interface Props {
  doc: InventoryDocument;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SaleExchangeDialog({ doc, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const exchange = useExchangeSale();
  const [productSearch, setProductSearch] = useState("");
  const { data: products } = useProducts({
    name: productSearch || undefined,
    status: "active",
    limit: 200,
    stock_desc: true,
  });

  const [returnedRows, setReturnedRows] = useState<ReturnedRow[]>([
    {
      product_id: "",
      quantity: "1",
      return_condition: "available",
    },
  ]);
  const [newRows, setNewRows] = useState<NewRow[]>([
    { product_id: "", quantity: "1", unit_price: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsPin = user?.role === "operator";

  const soldByProduct = useMemo(() => {
    const acc = new Map<number, number>();
    for (const line of doc.lines) {
      const productId = Number(line.product_id);
      acc.set(
        productId,
        (acc.get(productId) ?? 0) + Number(line.quantity || 0),
      );
    }
    return acc;
  }, [doc.lines]);

  const soldOptions = useMemo(
    () =>
      Array.from(soldByProduct.entries()).map(([productId, qty]) => {
        const firstLine = doc.lines.find(
          (line) => Number(line.product_id) === productId,
        );
        const name = firstLine?.product_name || `#${productId}`;
        return {
          value: String(productId),
          label: `${name} (vendido: ${qty})`,
        };
      }),
    [doc.lines, soldByProduct],
  );

  const hasAvailableReturnedProduct = useMemo(() => {
    const selected = new Set(
      returnedRows
        .map((row) => Number(row.product_id || 0))
        .filter((id) => id > 0),
    );
    return soldOptions.some((option) => !selected.has(Number(option.value)));
  }, [returnedRows, soldOptions]);

  const returnedSelectedProductIds = useMemo(
    () =>
      new Set(
        returnedRows
          .map((row) => Number(row.product_id || 0))
          .filter((id) => id > 0),
      ),
    [returnedRows],
  );

  const soldUnitPriceByProduct = useMemo(() => {
    const totals = new Map<number, { qty: number; amount: number }>();
    for (const line of doc.lines) {
      const productId = Number(line.product_id);
      const qty = Number(line.quantity || 0);
      const amount = qty * Number(line.unit_price || 0);
      const current = totals.get(productId) ?? { qty: 0, amount: 0 };
      totals.set(productId, {
        qty: current.qty + qty,
        amount: current.amount + amount,
      });
    }
    const unitPrice = new Map<number, number>();
    for (const [productId, total] of totals.entries()) {
      unitPrice.set(productId, total.qty > 0 ? total.amount / total.qty : 0);
    }
    return unitPrice;
  }, [doc.lines]);

  const productMap = useMemo(() => {
    const map = new Map<
      number,
      { name: string; barcode: string; pvp: number; stock: number }
    >();
    for (const p of products ?? []) {
      map.set(Number(p.id), {
        name: p.name,
        barcode: p.isbn || "—",
        pvp: Number(p.pvp || 0),
        stock: Number(p.stock_actual || 0),
      });
    }
    return map;
  }, [products]);

  // La búsqueda se resuelve en el servidor: la opción elegida se conserva
  // aunque salga del listado filtrado.
  const buildNewProductOptions = (row: NewRow) => {
    const options = (products ?? [])
      .filter((p) => {
        const id = Number(p.id);
        return (
          id === Number(row.product_id || 0) ||
          !returnedSelectedProductIds.has(id)
        );
      })
      .slice()
      .sort((a, b) => Number(b.stock_actual || 0) - Number(a.stock_actual || 0))
      .map((p) => ({
        value: String(p.id),
        label: p.name,
        description: `Código de barras: ${p.isbn || "—"}`,
        meta: `Stock: ${Number(p.stock_actual || 0)}`,
      }));

    const selected = Number(row.product_id || 0);
    if (selected > 0 && !options.some((o) => o.value === String(selected))) {
      options.unshift({
        value: String(selected),
        label: row.product_label ?? `#${selected}`,
        description: `Código de barras: ${row.product_barcode ?? "—"}`,
        meta: `Stock: ${row.product_stock ?? 0}`,
      });
    }
    return options;
  };

  const availableByProduct = useMemo(() => {
    const byProduct = new Map<number, number>();
    for (const line of doc.lines) {
      const productId = Number(line.product_id);
      byProduct.set(
        productId,
        (byProduct.get(productId) ?? 0) + Number(line.quantity || 0),
      );
    }
    return byProduct;
  }, [doc.lines]);

  useEffect(() => {
    if (soldOptions.length === 0) return;
    setReturnedRows((prev) => {
      if (prev.length !== 1) return prev;
      if (prev[0].product_id) return prev;
      return [
        {
          product_id: soldOptions[0].value,
          quantity: "1",
          return_condition: "available",
        },
      ];
    });
  }, [soldOptions]);

  const returnTotal = useMemo(() => {
    return returnedRows.reduce((acc, row) => {
      const productId = Number(row.product_id || 0);
      const qty = Number(row.quantity || 0);
      const pvp =
        productMap.get(productId)?.pvp ??
        soldUnitPriceByProduct.get(productId) ??
        0;
      return acc + qty * pvp;
    }, 0);
  }, [returnedRows, productMap, soldUnitPriceByProduct]);

  const newTotal = useMemo(() => {
    return newRows.reduce((acc, row) => {
      const qty = Number(row.quantity || 0);
      const unitPrice = Number(row.unit_price || 0);
      return acc + qty * unitPrice;
    }, 0);
  }, [newRows]);

  const differenceTotal = newTotal - returnTotal;
  const differenceLabel =
    differenceTotal >= 0 ? "Valor por cobrar" : "Saldo a favor del cliente";

  const onSubmit = async () => {
    setError(null);
    const normalizedPin = pin.replace(/\D/g, "").slice(0, 4);

    if (needsPin && normalizedPin.length !== 4) {
      setError("Ingresa PIN de 4 dígitos de admin/supervisor.");
      return;
    }

    const parsedReturned = returnedRows
      .map((row) => ({
        product_id: Number(row.product_id || 0),
        quantity: Number(row.quantity || 0),
        return_condition: row.return_condition,
      }))
      .filter(
        (row) =>
          row.product_id > 0 && row.quantity > 0 && !!row.return_condition,
      );

    const parsedNew = newRows
      .map((row) => ({
        product_id: Number(row.product_id || 0),
        quantity: Number(row.quantity || 0),
        unit_price: Number(row.unit_price || 0),
        stock: row.product_stock ?? 0,
      }))
      .filter(
        (row) => row.product_id > 0 && row.quantity > 0 && row.unit_price >= 0,
      );

    if (parsedReturned.length === 0 || parsedNew.length === 0) {
      setError("Debes ingresar al menos un devuelto y un producto nuevo.");
      return;
    }

    const returnedByProduct = new Map<number, number>();
    for (const row of parsedReturned) {
      returnedByProduct.set(
        row.product_id,
        (returnedByProduct.get(row.product_id) ?? 0) + row.quantity,
      );
    }

    for (const [productId, qty] of returnedByProduct.entries()) {
      const maxQty = availableByProduct.get(productId) ?? 0;
      if (qty > maxQty) {
        setError("La cantidad total devuelta excede lo vendido.");
        return;
      }
    }

    for (const row of parsedNew) {
      if (returnedByProduct.has(row.product_id)) {
        setError(
          "Un producto devuelto no puede agregarse como producto nuevo.",
        );
        return;
      }
    }

    const newByProduct = new Map<number, number>();
    for (const row of parsedNew) {
      newByProduct.set(
        row.product_id,
        (newByProduct.get(row.product_id) ?? 0) + row.quantity,
      );
    }

    for (const [productId, qty] of newByProduct.entries()) {
      const maxQty =
        productMap.get(productId)?.stock ??
        parsedNew.find((row) => row.product_id === productId)?.stock ??
        0;
      if (qty > maxQty) {
        setError("La cantidad de productos nuevos excede el stock actual.");
        return;
      }
    }

    try {
      const result = await exchange.mutateAsync({
        id: doc.id,
        payload: {
          returned_lines: parsedReturned,
          new_lines: parsedNew,
          notes,
          authorizer_pin: needsPin ? normalizedPin : undefined,
        },
      });

      toast({
        variant: "success",
        title: "Cambio generado",
        description: `Nueva venta ${result.new_document.number}. Diferencia: ${formatCurrency(result.difference_total)}.`,
      });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err, "No se pudo generar el cambio", {
          VOID_PIN_REQUIRED: "Se requiere PIN de admin/supervisor.",
          VOID_PIN_INVALID: "PIN inválido.",
          CANNOT_VOID_STOCK_CONSUMED:
            "No se puede cambiar: la venta original no puede anularse por consumo posterior.",
          EXCHANGE_RETURN_EXCEEDS_SOLD:
            "La devolución excede cantidades vendidas.",
          EXCHANGE_PRODUCT_IN_RETURN_AND_NEW:
            "Un producto devuelto no puede agregarse como nuevo.",
          EXCHANGE_ALREADY_FROM_CHANGE:
            "Este egreso proviene de un cambio y no puede generar otro cambio.",
          EXCHANGE_ALREADY_GENERATED:
            "Este egreso ya tiene un cambio generado.",
          INSUFFICIENT_STOCK: "Sin stock suficiente en productos nuevos.",
        }),
      );
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !exchange.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Generar cambio de venta</DialogTitle>
          <DialogDescription>
            Se registrará una devolución para {doc.number} y se creará una nueva
            venta con los productos intercambiados.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5 overflow-y-auto">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Productos devueltos</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasAvailableReturnedProduct}
                onClick={() => {
                  const selected = new Set(
                    returnedRows
                      .map((row) => Number(row.product_id || 0))
                      .filter((id) => id > 0),
                  );
                  const nextOption = soldOptions.find(
                    (option) => !selected.has(Number(option.value)),
                  );
                  if (!nextOption) return;
                  setError(null);
                  setReturnedRows((prev) => [
                    ...prev,
                    {
                      product_id: nextOption.value,
                      quantity: "1",
                      return_condition: "available",
                    },
                  ]);
                }}
              >
                <Plus className="mr-1 h-3 w-3" />
                Agregar
              </Button>
            </div>
            <div className="max-h-[28vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">
                      Producto vendido
                    </TableHead>
                    <TableHead className="w-36 text-center">
                      Precio unitario
                    </TableHead>
                    <TableHead className="w-32 text-center">Cantidad</TableHead>
                    <TableHead className="w-56 text-center">
                      Estado devuelto
                    </TableHead>
                    <TableHead className="w-14 text-center"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnedRows.map((row, idx) => {
                    const selectedProductId = Number(row.product_id || 0);
                    const selectedByOthers = new Set(
                      returnedRows
                        .filter((_, rowIndex) => rowIndex !== idx)
                        .map((item) => Number(item.product_id || 0))
                        .filter((id) => id > 0),
                    );
                    const soldQty = selectedProductId
                      ? (availableByProduct.get(selectedProductId) ?? 0)
                      : 0;
                    const usedByOthers = returnedRows.reduce(
                      (acc, current, rowIndex) => {
                        if (rowIndex === idx) return acc;
                        if (
                          Number(current.product_id || 0) !== selectedProductId
                        )
                          return acc;
                        return acc + Number(current.quantity || 0);
                      },
                      0,
                    );
                    const maxForRow = Math.max(0, soldQty - usedByOthers);
                    const quantityNumber = Number(row.quantity);
                    const exceedsSold =
                      selectedProductId > 0 &&
                      Number.isFinite(quantityNumber) &&
                      quantityNumber > maxForRow;
                    return (
                      <TableRow key={`returned-${idx}`}>
                        <TableCell className="align-top">
                          <SearchableSelect
                            value={row.product_id || null}
                            onChange={(value) => {
                              const productId = Number(value || 0);
                              if (
                                productId > 0 &&
                                selectedByOthers.has(productId)
                              ) {
                                setError(
                                  "Ese producto ya fue agregado en devueltos.",
                                );
                                return;
                              }
                              setError(null);
                              setReturnedRows((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, product_id: value }
                                    : item,
                                ),
                              );
                            }}
                            options={soldOptions.filter(
                              (option) =>
                                Number(option.value) === selectedProductId ||
                                !selectedByOthers.has(Number(option.value)),
                            )}
                            placeholder="Producto vendido"
                          />
                        </TableCell>
                        <TableCell className="w-36 text-right tabular-nums align-top">
                          {selectedProductId > 0
                            ? formatCurrency(
                                soldUnitPriceByProduct.get(selectedProductId) ??
                                  0,
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="w-32 text-right align-top">
                          <div className="relative ml-auto flex w-24 flex-col">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={row.quantity}
                              className={cn(
                                "text-right",
                                exceedsSold &&
                                  "border-destructive bg-rose-50 text-destructive focus-visible:border-destructive focus-visible:ring-destructive",
                              )}
                              onChange={(e) => {
                                const value = e.target.value
                                  .replace(/[.,].*$/, "")
                                  .replace(/\D/g, "");
                                setReturnedRows((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          quantity: value,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                              placeholder="Cantidad"
                              aria-invalid={exceedsSold || undefined}
                            />
                            {selectedProductId > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                Disp: {maxForRow}
                              </p>
                            )}
                            {exceedsSold && (
                              <p className="text-[11px] font-medium text-destructive">
                                Cantidad superior a lo vendido disponible.
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-56 align-top">
                          <div className="mx-auto w-56">
                            <SearchableSelect
                              value={row.return_condition}
                              onChange={(value) =>
                                setReturnedRows((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          return_condition: value as
                                            | "available"
                                            | "damaged"
                                            | "requires_review",
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={[
                                {
                                  value: "available",
                                  label: "Disponible para la venta",
                                },
                                { value: "damaged", label: "Dañado" },
                                {
                                  value: "requires_review",
                                  label: "Requiere revisión",
                                },
                              ]}
                              placeholder="Estado"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="w-14 text-center align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setReturnedRows((prev) =>
                                prev.length === 1
                                  ? prev
                                  : prev.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Productos nuevos</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setNewRows((prev) => [
                    ...prev,
                    { product_id: "", quantity: "1", unit_price: "" },
                  ])
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                Agregar
              </Button>
            </div>
            <div className="max-h-[28vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">
                      Producto nuevo
                    </TableHead>
                    <TableHead className="w-40 text-center">Cantidad</TableHead>
                    <TableHead className="w-52 text-center">
                      Precio unitario
                    </TableHead>
                    <TableHead className="w-14 text-center"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newRows.map((row, idx) => {
                    const selectedProductId = Number(row.product_id || 0);
                    const stockQty = selectedProductId
                      ? (productMap.get(selectedProductId)?.stock ??
                        row.product_stock ??
                        0)
                      : 0;
                    const usedByOthers = newRows.reduce(
                      (acc, current, rowIndex) => {
                        if (rowIndex === idx) return acc;
                        if (
                          Number(current.product_id || 0) !== selectedProductId
                        )
                          return acc;
                        return acc + Number(current.quantity || 0);
                      },
                      0,
                    );
                    const maxForRow = Math.max(0, stockQty - usedByOthers);
                    const quantityNumber = Number(row.quantity);
                    const exceedsStock =
                      selectedProductId > 0 &&
                      Number.isFinite(quantityNumber) &&
                      quantityNumber > maxForRow;

                    return (
                      <TableRow key={`new-${idx}`}>
                        <TableCell className="align-top">
                          <SearchableSelect
                            value={row.product_id || null}
                            onChange={(value) => {
                              const productId = Number(value || 0);
                              if (
                                productId > 0 &&
                                returnedSelectedProductIds.has(productId)
                              ) {
                                setError(
                                  "Ese producto está en devueltos y no puede ir en nuevos.",
                                );
                                return;
                              }
                              const picked = productMap.get(productId);
                              setError(null);
                              setNewRows((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        product_id: value,
                                        unit_price: String(picked?.pvp ?? 0),
                                        product_label: picked?.name,
                                        product_barcode: picked?.barcode,
                                        product_stock: picked?.stock,
                                      }
                                    : item,
                                ),
                              );
                            }}
                            onSearch={setProductSearch}
                            searchPlaceholder="Buscar por nombre o código de barras..."
                            options={buildNewProductOptions(row)}
                            placeholder="Producto nuevo"
                          />
                        </TableCell>
                        <TableCell className="w-40 text-right align-top">
                          <div className="relative ml-auto flex w-32 flex-col">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={row.quantity}
                              className={cn(
                                "text-right",
                                exceedsStock &&
                                  "border-destructive bg-rose-50 text-destructive focus-visible:border-destructive focus-visible:ring-destructive",
                              )}
                              onChange={(e) => {
                                const value = e.target.value
                                  .replace(/[.,].*$/, "")
                                  .replace(/\D/g, "");
                                setNewRows((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          quantity: value,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                              placeholder="Cantidad"
                              aria-invalid={exceedsStock || undefined}
                            />
                            {selectedProductId > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                Disp: {maxForRow}
                              </p>
                            )}
                            {exceedsStock && (
                              <p className="text-[11px] font-medium text-destructive">
                                Cantidad superior al stock disponible.
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-52 text-right align-top">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="ml-auto w-44 text-right"
                            value={row.unit_price}
                            onChange={(e) =>
                              setNewRows((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, unit_price: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Precio unitario"
                          />
                        </TableCell>
                        <TableCell className="w-14 text-center align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setNewRows((prev) =>
                                prev.length === 1
                                  ? prev
                                  : prev.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 rounded-md border p-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Total devolución</p>
              <p className="text-right font-semibold">
                {formatCurrency(returnTotal)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Total nuevo egreso</p>
              <p className="text-right font-semibold">
                {formatCurrency(newTotal)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Diferencia</p>
              <p className="text-right font-semibold">
                {formatCurrency(differenceTotal)}
              </p>
              <p className="text-right text-xs text-muted-foreground">
                {differenceLabel}
              </p>
            </div>
          </div>

          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nota adicional del cambio (opcional)"
            maxLength={500}
          />

          {needsPin && (
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="PIN admin/supervisor (4 dígitos)"
            />
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={exchange.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={onSubmit} isLoading={exchange.isPending}>
            Confirmar cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
