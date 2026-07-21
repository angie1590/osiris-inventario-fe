import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DetailModal } from "@/components/shared/DetailModal";
import { VoidDialog } from "./VoidDialog";
import { useAuth } from "@/contexts/AuthContext";
import { PURCHASE_DOCUMENT_TYPE_LABELS } from "@/features/inventory/documentTypes";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatQuantity } from "@/lib/format";
import api from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import type {
  DocumentStatus,
  DocumentType,
  BajaReason,
  AdjustmentReason,
  EgresoType,
  IngresoType,
  InventoryDocumentAttachment,
  InventoryDocument,
} from "@/types/api";

const INGRESO_TYPE_LABELS: Record<IngresoType, string> = {
  purchase: "Compra",
  initial_inventory: "Inventario inicial",
  adjustment_positive: "Ajuste positivo",
  customer_return: "Devolución de cliente",
  production: "Producción",
  transfer_received: "Transferencia recibida",
  other: "Otro",
};
const EGRESO_TYPE_LABELS: Record<EgresoType, string> = {
  sale: "Venta",
  baja: "Baja",
  adjustment_negative: "Ajuste negativo",
  supplier_return: "Devolución a proveedor",
  internal_consumption: "Consumo interno",
  transfer_sent: "Transferencia enviada",
  other: "Otro",
};
const BAJA_REASON_LABELS: Record<BajaReason, string> = {
  damage: "Daño",
  expiration: "Caducidad",
  loss: "Pérdida",
  theft: "Robo",
  donation: "Donación",
  gift: "Obsequio",
  destruction: "Destrucción",
  sample: "Muestra",
  other: "Otro",
};
const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  physical_count: "Conteo físico",
  record_error: "Error de registro",
  administrative_correction: "Corrección administrativa",
  other: "Otro",
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
const TYPE_LABELS: Record<DocumentType, string> = {
  IN: "Ingreso",
  EG: "Egreso",
  BI: "Baja de inventario",
  AI: "Ajuste de inventario",
};

interface Props {
  doc: InventoryDocument;
  onClose: () => void;
  showCost?: boolean;
  showPrice?: boolean;
  /** When provided, shows a "Gestionar" button that opens the full document page. */
  manageHref?: string;
}

function LinesTable({
  doc,
  showCost,
  showPrice,
}: {
  doc: InventoryDocument;
  showCost?: boolean;
  showPrice?: boolean;
}) {
  const isEgresoCommercial =
    doc.doc_type === "EG" && doc.egreso_type === "sale";
  const isEgresoInventory = doc.doc_type === "EG" && !isEgresoCommercial;
  const egresoLineSummaries = doc.lines.map((l) => {
    const quantity = Number(l.quantity || 0);
    const finalTotal = quantity * Number(l.unit_price || 0);
    const hasDiscountData =
      l.unit_price_base != null ||
      l.discount_type != null ||
      l.discount_value != null;
    if (!hasDiscountData) {
      return {
        subtotal: finalTotal,
        discount: 0,
        final: finalTotal,
      };
    }
    const unitPriceBase = Number(l.unit_price_base ?? l.unit_price ?? 0);
    const subtotal = quantity * unitPriceBase;
    const rawDiscountValue = Math.max(0, Number(l.discount_value || 0));
    const discount =
      l.discount_type === "percent"
        ? (subtotal * Math.min(rawDiscountValue, 100)) / 100
        : rawDiscountValue;
    const boundedDiscount = Math.min(subtotal, discount);
    return {
      subtotal,
      discount: boundedDiscount,
      final: Math.max(0, subtotal - boundedDiscount),
    };
  });
  const colSpan = isEgresoCommercial
    ? 6
    : 2 + (showCost ? 2 : 0) + (showPrice ? 1 : 0);
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Producto</TableHead>
            <TableHead className="text-center">Cantidad</TableHead>
            {isEgresoCommercial ? (
              <>
                <TableHead className="text-center">PVP unitario</TableHead>
                <TableHead className="text-center">Subtotal</TableHead>
                <TableHead className="text-center">Descuento</TableHead>
                <TableHead className="text-center">Precio final</TableHead>
              </>
            ) : (
              <>
                {showCost && (
                  <TableHead className="text-center">Costo unitario</TableHead>
                )}
                {showCost && (
                  <TableHead className="text-center">
                    {isEgresoInventory ? "Valor" : "Subtotal"}
                  </TableHead>
                )}
                {showPrice && (
                  <TableHead className="text-center">Precio unit.</TableHead>
                )}
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {doc.lines.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="text-center text-muted-foreground"
              >
                Sin ítems
              </TableCell>
            </TableRow>
          ) : (
            doc.lines.map((l, idx) => (
              <TableRow key={l.id}>
                <TableCell>
                  {l.product_name
                    ? `${l.product_name}${l.product_isbn ? ` (${l.product_isbn})` : ""}`
                    : `#${l.product_id}`}
                </TableCell>
                <TableCell className="text-center">
                  {formatQuantity(l.quantity, "integer")}
                </TableCell>
                {isEgresoCommercial ? (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(l.unit_price_base ?? l.unit_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(egresoLineSummaries[idx]?.subtotal ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(egresoLineSummaries[idx]?.discount ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(egresoLineSummaries[idx]?.final ?? 0)}
                    </TableCell>
                  </>
                ) : (
                  <>
                    {showCost && (
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(l.unit_cost)}
                      </TableCell>
                    )}
                    {showCost && (
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(
                          Number(l.quantity) * Number(l.unit_cost || 0),
                        )}
                      </TableCell>
                    )}
                    {showPrice && (
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(l.unit_price)}
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function DocumentDetailModal({
  doc,
  onClose,
  showCost,
  showPrice,
  manageHref,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [voidOpen, setVoidOpen] = useState(false);
  const canVoid =
    doc.status === "approved" &&
    (user?.role === "admin" ||
      user?.role === "operator" ||
      user?.role === "supervisor");
  const totalItems = doc.lines.length;
  const totalUnits = doc.lines.reduce(
    (acc, l) => acc + Number(l.quantity || 0),
    0,
  );
  const totalCost = doc.lines.reduce(
    (acc, l) => acc + Number(l.quantity || 0) * Number(l.unit_cost || 0),
    0,
  );
  const totalFinalPrice = doc.lines.reduce(
    (acc, l) => acc + Number(l.quantity || 0) * Number(l.unit_price || 0),
    0,
  );
  const isEgreso = doc.doc_type === "EG";
  const isCommercialEgreso = isEgreso && doc.egreso_type === "sale";
  const egresoLineSummaries = doc.lines.map((l) => {
    const quantity = Number(l.quantity || 0);
    const finalTotal = quantity * Number(l.unit_price || 0);
    const hasDiscountData =
      l.unit_price_base != null ||
      l.discount_type != null ||
      l.discount_value != null;
    if (!hasDiscountData) {
      return {
        subtotal: finalTotal,
        discount: 0,
        final: finalTotal,
      };
    }
    const unitPriceBase = Number(l.unit_price_base ?? l.unit_price ?? 0);
    const subtotal = quantity * unitPriceBase;
    const rawDiscountValue = Math.max(0, Number(l.discount_value || 0));
    const discount =
      l.discount_type === "percent"
        ? (subtotal * Math.min(rawDiscountValue, 100)) / 100
        : rawDiscountValue;
    const boundedDiscount = Math.min(subtotal, discount);
    return {
      subtotal,
      discount: boundedDiscount,
      final: Math.max(0, subtotal - boundedDiscount),
    };
  });
  const egresoSubtotal = egresoLineSummaries.reduce(
    (acc, l) => acc + l.subtotal,
    0,
  );
  const egresoDiscount = egresoLineSummaries.reduce(
    (acc, l) => acc + l.discount,
    0,
  );
  const egresoFinal = egresoLineSummaries.reduce((acc, l) => acc + l.final, 0);

  const openAttachment = async (attachment: InventoryDocumentAttachment) => {
    const newTab = window.open("about:blank", "_blank");
    if (newTab) {
      newTab.document.write(
        '<p style="font-family:sans-serif">Cargando adjunto...</p>',
      );
      newTab.document.close();
    }
    try {
      const response = await api.get(
        `/inventory/ingresos/${doc.id}/attachments/${attachment.id}`,
        { responseType: "blob" },
      );
      const blob = new Blob([response.data], {
        type:
          (response.headers["content-type"] as string | undefined) ||
          attachment.mime_type ||
          "application/octet-stream",
      });
      const objectUrl = URL.createObjectURL(blob);
      if (newTab) {
        newTab.location.href = objectUrl;
      } else {
        window.open(objectUrl, "_blank");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err: unknown) {
      if (newTab) newTab.close();
      toast({
        variant: "destructive",
        title: "No se pudo abrir el adjunto",
        description: getApiErrorMessage(
          err,
          "Revisa tu sesión e intenta nuevamente.",
        ),
      });
    }
  };

  return (
    <>
      <DetailModal
        open
        onClose={onClose}
        title={`${TYPE_LABELS[doc.doc_type]} ${doc.number}`}
        size="lg"
        sections={[
          {
            title: "Cabecera",
            fields: [
              {
                label: "Estado",
                value: (
                  <Badge variant={STATUS_VARIANTS[doc.status]}>
                    {STATUS_LABELS[doc.status]}
                  </Badge>
                ),
              },
              {
                label: "Fecha de registro",
                value: new Date(doc.created_at).toLocaleString("es-EC"),
              },
              { label: "Referencia interna", value: doc.reference || "—" },
              ...(doc.doc_type === "IN"
                ? [
                    {
                      label: "Tipo de ingreso",
                      value:
                        INGRESO_TYPE_LABELS[doc.ingreso_type ?? "purchase"],
                    },
                    {
                      label: "Proveedor",
                      value: doc.supplier?.trade_name || "—",
                    },
                    {
                      label: "Tipo documento",
                      value: doc.purchase_document_type
                        ? PURCHASE_DOCUMENT_TYPE_LABELS[
                            doc.purchase_document_type
                          ]
                        : "—",
                    },
                    {
                      label: "Nro. documento",
                      value: doc.purchase_document_number || "—",
                    },
                    {
                      label: "Fecha doc. respaldo",
                      value: doc.purchase_document_date
                        ? new Date(doc.purchase_document_date).toLocaleString(
                            "es-EC",
                          )
                        : "—",
                    },
                  ]
                : []),
              ...(doc.doc_type === "EG"
                ? [
                    {
                      label: "Tipo de egreso",
                      value: doc.egreso_type
                        ? EGRESO_TYPE_LABELS[doc.egreso_type]
                        : "—",
                    },
                    ...(doc.egreso_type === "baja"
                      ? [
                          {
                            label: "Motivo de la baja",
                            value: doc.baja_reason
                              ? BAJA_REASON_LABELS[doc.baja_reason]
                              : "—",
                          },
                        ]
                      : []),
                    ...(doc.egreso_type === "adjustment_negative"
                      ? [
                          {
                            label: "Motivo del ajuste",
                            value: doc.adjustment_reason
                              ? ADJUSTMENT_REASON_LABELS[doc.adjustment_reason]
                              : "—",
                          },
                        ]
                      : []),
                    {
                      label: "Tipo documento",
                      value: doc.purchase_document_type
                        ? PURCHASE_DOCUMENT_TYPE_LABELS[
                            doc.purchase_document_type
                          ]
                        : "—",
                    },
                    {
                      label: "Nro. documento",
                      value: doc.purchase_document_number || "—",
                    },
                    {
                      label: "Fecha doc. respaldo",
                      value: doc.purchase_document_date
                        ? new Date(doc.purchase_document_date).toLocaleString(
                            "es-EC",
                          )
                        : "—",
                    },
                  ]
                : []),
              ...(doc.adjust_type
                ? [
                    {
                      label: "Tipo de ajuste",
                      value:
                        doc.adjust_type === "increment"
                          ? "Incremento"
                          : "Decremento",
                    },
                  ]
                : []),
              { label: "Notas", value: doc.notes || "—", full: true },
            ],
          },
          {
            title: "Productos",
            content: (
              <LinesTable doc={doc} showCost={showCost} showPrice={showPrice} />
            ),
          },
          ...(isCommercialEgreso
            ? [
                {
                  title: "Totales",
                  fields: [
                    {
                      label: "Ítems",
                      value: totalItems,
                    },
                    {
                      label: "Total de unidades",
                      value: formatQuantity(totalUnits, "integer"),
                    },
                    {
                      label: "Subtotal",
                      value: formatCurrency(egresoSubtotal),
                    },
                    {
                      label: "Descuento",
                      value: formatCurrency(egresoDiscount),
                    },
                    {
                      label: "PVP Final",
                      value: formatCurrency(egresoFinal),
                    },
                  ],
                },
              ]
            : isEgreso
              ? [
                  {
                    title: "Totales",
                    fields: [
                      {
                        label: "Ítems",
                        value: totalItems,
                      },
                      {
                        label: "Total de unidades",
                        value: formatQuantity(totalUnits, "integer"),
                      },
                      {
                        label: "Valor total del movimiento",
                        value: formatCurrency(totalCost),
                      },
                    ],
                  },
                ]
              : showCost || showPrice
                ? [
                    {
                      title: "Totales",
                      fields: [
                        {
                          label: "Ítems",
                          value: totalItems,
                        },
                        {
                          label: "Total de unidades",
                          value: formatQuantity(totalUnits, "integer"),
                        },
                        ...(showCost
                          ? [
                              {
                                label:
                                  doc.doc_type === "EG"
                                    ? "Total costo"
                                    : "Total del ingreso",
                                value: formatCurrency(totalCost),
                              },
                            ]
                          : []),
                        ...(showPrice
                          ? [
                              {
                                label: "PVP Final",
                                value: formatCurrency(totalFinalPrice),
                              },
                            ]
                          : []),
                      ],
                    },
                  ]
                : []),
          ...(doc.doc_type === "IN"
            ? [
                {
                  title: "Documento de respaldo",
                  content:
                    doc.attachments && doc.attachments.length > 0 ? (
                      <div className="space-y-1">
                        {doc.attachments.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => void openAttachment(a)}
                            className="block text-sm text-primary underline"
                          >
                            {a.original_name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sin adjuntos
                      </p>
                    ),
                },
              ]
            : []),
        ]}
        footer={
          <>
            {canVoid && (
              <Button variant="destructive" onClick={() => setVoidOpen(true)}>
                Anular
              </Button>
            )}
            {manageHref && (
              <Button variant="outline" asChild>
                <Link to={manageHref}>Gestionar</Link>
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </>
        }
      />
      {voidOpen && (
        <VoidDialog
          doc={doc}
          onClose={() => setVoidOpen(false)}
          onVoided={onClose}
        />
      )}
    </>
  );
}
