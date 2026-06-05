import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useIngresos } from '@/features/inventory/hooks'
import { useAuth } from '@/contexts/AuthContext'
import type { DocumentStatus } from '@/types/api'

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

export default function IngresosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreate = user?.role === 'admin' || user?.role === 'operator'

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [cursor, setCursor] = useState<number | undefined>()

  const { data: docs, isLoading } = useIngresos({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    cursor,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ingresos</h1>
        {canCreate && (
          <Button onClick={() => navigate('/inventory/ingresos/new')}>
            <Plus className="mr-2 h-4 w-4" />Nuevo ingreso
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" className="h-8 w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" className="h-8 w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading
          ? <Skeleton className="m-3 h-48" />
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Líneas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(docs ?? []).length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
                  : (docs ?? []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.number}</TableCell>
                      <TableCell>{d.reference || '—'}</TableCell>
                      <TableCell>{d.lines.length}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[d.status]}>{STATUS_LABELS[d.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString('es-EC')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/inventory/ingresos/${d.id}`}>Ver</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!cursor} onClick={() => setCursor(undefined)}>Primera página</Button>
        <Button variant="outline" size="sm"
          disabled={!docs || docs.length < 50}
          onClick={() => setCursor(docs?.[docs.length - 1]?.id)}>
          Siguiente →
        </Button>
      </div>
    </div>
  )
}
