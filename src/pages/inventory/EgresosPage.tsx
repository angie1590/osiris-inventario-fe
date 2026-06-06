import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { useEgresos } from '@/features/inventory/hooks'
import { currentMonthRange } from '@/features/reports/DateRangeFilter'
import { useAuth } from '@/contexts/AuthContext'
import type { DocumentStatus, InventoryDocument } from '@/types/api'

const STATUS_LABELS: Record<DocumentStatus, string> = { pending: 'Pendiente', approved: 'Aprobado', cancelled: 'Cancelado' }
const STATUS_VARIANTS: Record<DocumentStatus, 'default' | 'secondary' | 'destructive'> = { pending: 'secondary', approved: 'default', cancelled: 'destructive' }

const columns: Column<InventoryDocument>[] = [
  { key: 'number', header: 'Número', cell: (d) => <span className="font-mono text-sm">{d.number}</span> },
  { key: 'reference', header: 'Referencia', cell: (d) => d.reference || '—' },
  { key: 'lines', header: 'Líneas', cell: (d) => d.lines.length },
  { key: 'status', header: 'Estado', cell: (d) => <Badge variant={STATUS_VARIANTS[d.status]}>{STATUS_LABELS[d.status]}</Badge> },
  { key: 'created_at', header: 'Fecha', cell: (d) => <span className="text-sm text-muted-foreground">{new Date(d.created_at).toLocaleDateString('es-EC')}</span> },
  { key: 'actions', header: '', cell: (d) => <Button variant="ghost" size="sm" asChild><Link to={`/inventory/egresos/${d.id}`}>Ver</Link></Button> },
]

export default function EgresosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreate = user?.role === 'admin' || user?.role === 'operator'
  const defaultRange = currentMonthRange()
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from)
  const [dateTo, setDateTo] = useState(defaultRange.date_to)
  const [cursor, setCursor] = useState<number | undefined>()
  const { data: docs, isLoading, isError, refetch } = useEgresos({ date_from: dateFrom || undefined, date_to: dateTo || undefined, cursor })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Egresos"
        actions={canCreate && <Button onClick={() => navigate('/inventory/egresos/new')}><Plus className="mr-2 h-4 w-4" />Nuevo egreso</Button>}
      />
      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" className="h-8 w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" className="h-8 w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
      </div>
      <DataTable columns={columns} data={docs ?? []} rowKey={(d) => d.id} isLoading={isLoading} isError={isError} onRetry={refetch} emptyHeading="Sin egresos" />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!cursor} onClick={() => setCursor(undefined)}>Primera página</Button>
        <Button variant="outline" size="sm" disabled={!docs || docs.length < 50} onClick={() => setCursor(docs?.[docs.length - 1]?.id)}>Siguiente →</Button>
      </div>
    </div>
  )
}
