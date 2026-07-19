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
import { formatCurrency, formatQuantity } from "@/lib/format";
import type {
  DocumentStatus,
  DocumentType,
  InventoryDocument,
} from "@/types/api";

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
  const colSpan = 2 + (showCost ? 2 : 0) + (showPrice ? 1 : 0);
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Producto</TableHead>
            <TableHead className="text-center">Cantidad</TableHead>
            {showCost && (
              <TableHead className="text-center">Costo unitario</TableHead>
            )}
            {showCost && (
              <TableHead className="text-center">Subtotal</TableHead>
            )}
            {showPrice && (
              <TableHead className="text-center">Precio unit.</TableHead>
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
            doc.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  {l.product_name
                    ? `${l.product_name}${l.product_isbn ? ` (${l.product_isbn})` : ""}`
                    : `#${l.product_id}`}
                </TableCell>
                <TableCell className="text-center">
                  {formatQuantity(l.quantity, "integer")}
                </TableCell>
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
  const [voidOpen, setVoidOpen] = useState(false);
  const canVoid =
    doc.status === "approved" &&
    (user?.role === "admin" ||
      user?.role === "operator" ||
      user?.role === "supervisor");

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
                label: "Fecha",
                value: new Date(doc.created_at).toLocaleString("es-EC"),
              },
              { label: "Referencia interna", value: doc.reference || "—" },
              ...(doc.doc_type === "IN"
                ? [
                    {
                      label: "Tipo de ingreso",
                      value:
                        doc.ingreso_type === "initial_inventory"
                          ? "Inventario inicial"
                          : "Compra",
                    },
                    {
                      label: "Proveedor",
                      value: doc.supplier?.trade_name || "—",
                    },
                    {
                      label: "Tipo documento",
                      value:
                        doc.purchase_document_type === "invoice"
                          ? "Factura"
                          : doc.purchase_document_type === "sales_note"
                            ? "Nota de venta"
                            : doc.purchase_document_type === "receipt"
                              ? "Recibo"
                              : doc.purchase_document_type === "none"
                                ? "Sin documento"
                                : "—",
                    },
                    {
                      label: "Nro. documento",
                      value: doc.purchase_document_number || "—",
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
          ...(showCost
            ? [
                {
                  title: "Totales",
                  fields: [
                    {
                      label: "Total de unidades",
                      value: formatQuantity(
                        doc.lines.reduce(
                          (acc, l) => acc + Number(l.quantity || 0),
                          0,
                        ),
                        "integer",
                      ),
                    },
                    {
                      label: "Total del ingreso",
                      value: formatCurrency(
                        doc.lines.reduce(
                          (acc, l) =>
                            acc +
                            Number(l.quantity || 0) * Number(l.unit_cost || 0),
                          0,
                        ),
                      ),
                    },
                  ],
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
