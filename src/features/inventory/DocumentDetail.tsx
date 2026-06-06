import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDocument, useCancelDocument } from './hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import type { DocumentStatus, DocumentType } from '@/types/api'

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
  id: number
  docType: DocumentType
  showCost?: boolean
  showPrice?: boolean
  extraActions?: React.ReactNode
}

export function DocumentDetail({ id, docType, showCost, showPrice, extraActions }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: doc, isLoading } = useDocument(id, docType)
  const cancel = useCancelDocument()

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!doc) return <p>Documento no encontrado</p>

  const canCancel =
    (doc.doc_type === 'BI' || doc.doc_type === 'AI')
    && doc.status === 'pending'
    && (user?.role === 'admin' || user?.role === 'operator')

  const handleCancel = async () => {
    if (!confirm('¿Cancelar este documento?')) return
    if (doc.doc_type !== 'BI' && doc.doc_type !== 'AI') return
    try {
      await cancel.mutateAsync({ id, docType: doc.doc_type })
      toast({ title: 'Documento cancelado' })
    } catch {
      toast({ variant: 'destructive', description: 'Error al cancelar' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{TYPE_LABELS[doc.doc_type]} {doc.number}</h1>
        <Badge variant={STATUS_VARIANTS[doc.status]}>{STATUS_LABELS[doc.status]}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cabecera</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Referencia</span><span>{doc.reference || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Notas</span><span>{doc.notes || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fecha</span><span>{new Date(doc.created_at).toLocaleString('es-EC')}</span></div>
            {doc.adjust_type && (
              <div className="flex justify-between"><span className="text-muted-foreground">Tipo ajuste</span><span>{doc.adjust_type === 'increment' ? 'Incremento' : 'Decremento'}</span></div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              {showCost && <TableHead>Costo unit.</TableHead>}
              {showPrice && <TableHead>Precio unit.</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {doc.lines.length === 0
              ? <TableRow><TableCell colSpan={showCost || showPrice ? 3 : 2} className="text-center text-muted-foreground">Sin líneas</TableCell></TableRow>
              : doc.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>#{l.product_id}</TableCell>
                  <TableCell>{l.quantity}</TableCell>
                  {showCost && <TableCell>{l.unit_cost != null ? `$${Number(l.unit_cost).toFixed(2)}` : '—'}</TableCell>}
                  {showPrice && <TableCell>{l.unit_price != null ? `$${Number(l.unit_price).toFixed(2)}` : '—'}</TableCell>}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        {extraActions}
        {canCancel && (
          <Button variant="outline" onClick={handleCancel} disabled={cancel.isPending}>Cancelar documento</Button>
        )}
      </div>
    </div>
  )
}
