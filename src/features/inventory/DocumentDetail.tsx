import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { VoidDialog } from "./VoidDialog";
import { useDocument, useCancelDocument } from "./hooks";
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
  id: number;
  docType: DocumentType;
  showCost?: boolean;
  showPrice?: boolean;
  extraActions?: React.ReactNode;
}

export function DocumentDetail({
  id,
  docType,
  showCost,
  showPrice,
  extraActions,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: doc, isLoading } = useDocument(id, docType);
  const cancel = useCancelDocument();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!doc) return <p>Documento no encontrado</p>;

  const isEgreso = doc.doc_type === "EG";
  const isCommercialEgreso = isEgreso && doc.egreso_type === "sale";
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

  const canCancel =
    (doc.doc_type === "BI" || doc.doc_type === "AI") &&
    doc.status === "pending" &&
    (user?.role === "admin" || user?.role === "operator");

  const canVoid =
    doc.status === "approved" &&
    (user?.role === "admin" ||
      user?.role === "operator" ||
      user?.role === "supervisor");

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

  const handleCancel = async () => {
    if (doc.doc_type !== "BI" && doc.doc_type !== "AI") return;
    try {
      await cancel.mutateAsync({ id, docType: doc.doc_type });
      toast({
        variant: "success",
        title: "Documento cancelado",
        description: `${doc.number} cancelado correctamente.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error al cancelar",
        description: `No se pudo cancelar ${doc.number}. Intenta nuevamente.`,
      });
      throw new Error("cancel failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (doc.doc_type === "IN") {
              navigate("/inventory/ingresos");
              return;
            }
            if (doc.doc_type === "EG") {
              navigate("/inventory/egresos");
              return;
            }
            navigate(-1);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {TYPE_LABELS[doc.doc_type]} {doc.number}
        </h1>
        <Badge variant={STATUS_VARIANTS[doc.status]}>
          {STATUS_LABELS[doc.status]}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cabecera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {doc.doc_type === "IN" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo de ingreso</span>
                  <span>
                    {INGRESO_TYPE_LABELS[doc.ingreso_type ?? "purchase"]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proveedor</span>
                  <span>{doc.supplier?.trade_name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo documento</span>
                  <span>
                    {doc.purchase_document_type
                      ? PURCHASE_DOCUMENT_TYPE_LABELS[
                          doc.purchase_document_type
                        ]
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nro. documento</span>
                  <span>{doc.purchase_document_number || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Fecha doc. respaldo
                  </span>
                  <span>
                    {doc.purchase_document_date
                      ? new Date(doc.purchase_document_date).toLocaleString(
                          "es-EC",
                        )
                      : "—"}
                  </span>
                </div>
              </>
            )}
            {doc.doc_type === "EG" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo de egreso</span>
                  <span>
                    {doc.egreso_type
                      ? EGRESO_TYPE_LABELS[doc.egreso_type]
                      : "—"}
                  </span>
                </div>
                {doc.egreso_type === "baja" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Motivo de la baja
                    </span>
                    <span>
                      {doc.baja_reason
                        ? BAJA_REASON_LABELS[doc.baja_reason]
                        : "—"}
                    </span>
                  </div>
                )}
                {doc.egreso_type === "adjustment_negative" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Motivo del ajuste
                    </span>
                    <span>
                      {doc.adjustment_reason
                        ? ADJUSTMENT_REASON_LABELS[doc.adjustment_reason]
                        : "—"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo documento</span>
                  <span>
                    {doc.purchase_document_type
                      ? PURCHASE_DOCUMENT_TYPE_LABELS[
                          doc.purchase_document_type
                        ]
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nro. documento</span>
                  <span>{doc.purchase_document_number || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Fecha doc. respaldo
                  </span>
                  <span>
                    {doc.purchase_document_date
                      ? new Date(doc.purchase_document_date).toLocaleString(
                          "es-EC",
                        )
                      : "—"}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Referencia interna</span>
              <span>{doc.reference || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notas</span>
              <span>{doc.notes || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha de registro</span>
              <span>{new Date(doc.created_at).toLocaleString("es-EC")}</span>
            </div>
            {doc.adjust_type && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo ajuste</span>
                <span>
                  {doc.adjust_type === "increment"
                    ? "Incremento"
                    : "Decremento"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Producto</TableHead>
              <TableHead className="text-center">Cantidad</TableHead>
              {isCommercialEgreso ? (
                <>
                  <TableHead className="text-center">PVP unitario</TableHead>
                  <TableHead className="text-center">Subtotal</TableHead>
                  <TableHead className="text-center">Descuento</TableHead>
                  <TableHead className="text-center">Precio final</TableHead>
                </>
              ) : (
                <>
                  {showCost && (
                    <TableHead className="text-center">
                      Costo unitario
                    </TableHead>
                  )}
                  {showCost && (
                    <TableHead className="text-center">
                      {isEgreso ? "Valor" : "Subtotal"}
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
                  colSpan={
                    isCommercialEgreso
                      ? 6
                      : 2 + (showCost ? 2 : 0) + (showPrice ? 1 : 0)
                  }
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
                  {isCommercialEgreso ? (
                    <>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(l.unit_price_base ?? l.unit_price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(
                          egresoLineSummaries[idx]?.subtotal ?? 0,
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          egresoLineSummaries[idx]?.discount ?? 0,
                        )}
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

      <div className="flex items-center justify-end gap-6 rounded-md border bg-muted/20 px-3 py-2 text-sm">
        {isCommercialEgreso ? (
          <>
            <p className="font-semibold">Totales:</p>
            <p>
              Ítems: <span className="font-semibold">{totalItems}</span>
            </p>
            <p>
              Total de unidades:{" "}
              <span className="font-semibold">
                {formatQuantity(totalUnits, "integer")}
              </span>
            </p>
            <p>
              Subtotal:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(egresoSubtotal)}
              </span>
            </p>
            <p>
              Descuento:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(egresoDiscount)}
              </span>
            </p>
            <p>
              PVP Final:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(egresoFinal)}
              </span>
            </p>
          </>
        ) : isEgreso ? (
          <>
            <p>
              Ítems: <span className="font-semibold">{totalItems}</span>
            </p>
            <p>
              Total de unidades:{" "}
              <span className="font-semibold">
                {formatQuantity(totalUnits, "integer")}
              </span>
            </p>
            <p>
              Valor total del movimiento:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(totalCost)}
              </span>
            </p>
          </>
        ) : (
          <>
            <p>
              Ítems: <span className="font-semibold">{totalItems}</span>
            </p>
            <p>
              Total de unidades:{" "}
              <span className="font-semibold">
                {formatQuantity(totalUnits, "integer")}
              </span>
            </p>
            {showCost && (
              <p>
                Total del ingreso:{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(totalCost)}
                </span>
              </p>
            )}
            {showPrice && (
              <p>
                PVP Final:{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(totalFinalPrice)}
                </span>
              </p>
            )}
          </>
        )}
      </div>

      {doc.doc_type === "IN" &&
        doc.attachments &&
        doc.attachments.length > 0 && (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-semibold">Documento de respaldo</p>
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
          </div>
        )}

      <div className="flex gap-2">
        {extraActions}
        {canCancel && (
          <Button
            variant="outline"
            onClick={() => setConfirmCancel(true)}
            disabled={cancel.isPending}
          >
            Cancelar documento
          </Button>
        )}
        {canVoid && (
          <Button variant="destructive" onClick={() => setVoidOpen(true)}>
            Anular documento
          </Button>
        )}
      </div>

      {voidOpen && <VoidDialog doc={doc} onClose={() => setVoidOpen(false)} />}

      {confirmCancel && (
        <ConfirmDialog
          open
          onClose={() => setConfirmCancel(false)}
          title="Cancelar documento"
          description={
            <>
              ¿Cancelar el documento <strong>{doc.number}</strong>? Esta acción
              no se puede deshacer.
            </>
          }
          confirmLabel="Cancelar documento"
          cancelLabel="Volver"
          variant="danger"
          onConfirm={handleCancel}
        />
      )}
    </div>
  );
}
