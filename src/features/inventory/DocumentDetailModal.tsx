import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DetailModal } from '@/components/shared/DetailModal'
import type { DocumentStatus, DocumentType, InventoryDocument } from '@/types/api'

const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  cancelled: 'Cancelado',
}
const STATUS_VARIANTS: Record<DocumentStatus, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  cancelled: 'destructive',
}
const TYPE_LABELS: Record<DocumentType, string> = {
  IN: 'Ingreso',
  EG: 'Egreso',
  BI: 'Baja de inventario',
  AI: 'Ajuste de inventario',
}

interface Props {
  doc: InventoryDocument
  onClose: () => void
  showCost?: boolean
  showPrice?: boolean
  /** When provided, shows a "Gestionar" button that opens the full document page. */
  manageHref?: string
}

function LinesTable({ doc, showCost, showPrice }: { doc: InventoryDocument; showCost?: boolean; showPrice?: boolean }) {
  const colSpan = 2 + (showCost ? 1 : 0) + (showPrice ? 1 : 0)
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            {showCost && <TableHead className="text-right">Costo unit.</TableHead>}
            {showPrice && <TableHead className="text-right">Precio unit.</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {doc.lines.length === 0 ? (
            <TableRow><TableCell colSpan={colSpan} className="text-center text-muted-foreground">Sin líneas</TableCell></TableRow>
          ) : (
            doc.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.product_name ? `${l.product_name}${l.product_isbn ? ` (${l.product_isbn})` : ''}` : `#${l.product_id}`}</TableCell>
                <TableCell className="text-right">{l.quantity}</TableCell>
                {showCost && <TableCell className="text-right">{l.unit_cost != null ? `$${Number(l.unit_cost).toFixed(2)}` : '—'}</TableCell>}
                {showPrice && <TableCell className="text-right">{l.unit_price != null ? `$${Number(l.unit_price).toFixed(2)}` : '—'}</TableCell>}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function DocumentDetailModal({ doc, onClose, showCost, showPrice, manageHref }: Props) {
  return (
    <DetailModal
      open
      onClose={onClose}
      title={`${TYPE_LABELS[doc.doc_type]} ${doc.number}`}
      size="lg"
      sections={[
        {
          title: 'Cabecera',
          fields: [
            { label: 'Estado', value: <Badge variant={STATUS_VARIANTS[doc.status]}>{STATUS_LABELS[doc.status]}</Badge> },
            { label: 'Fecha', value: new Date(doc.created_at).toLocaleString('es-EC') },
            { label: 'Referencia', value: doc.reference || '—' },
            ...(doc.adjust_type
              ? [{ label: 'Tipo de ajuste', value: doc.adjust_type === 'increment' ? 'Incremento' : 'Decremento' }]
              : []),
            { label: 'Notas', value: doc.notes || '—', full: true },
          ],
        },
        {
          title: 'Productos',
          content: <LinesTable doc={doc} showCost={showCost} showPrice={showPrice} />,
        },
      ]}
      footer={
        <>
          {manageHref && (
            <Button variant="outline" asChild>
              <Link to={manageHref}>Gestionar</Link>
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </>
      }
    />
  )
}
