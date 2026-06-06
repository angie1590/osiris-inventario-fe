import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { DateRangeFilter, type DateRange, currentMonthRange } from '@/features/reports/DateRangeFilter'
import { useAuditLogs, type AuditFilters } from '@/features/audit/hooks'
import { downloadBlob } from '@/lib/download'
import { differenceInDays, parseISO } from 'date-fns'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { AuditAction } from '@/types/api'

const ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'CANCEL', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGED']

const ACTION_VARIANTS: Partial<Record<AuditAction, 'default' | 'secondary' | 'destructive'>> = {
  CREATE: 'default',
  DELETE: 'destructive',
  CANCEL: 'destructive',
  APPROVE: 'default',
  LOGIN: 'secondary',
  LOGOUT: 'secondary',
}

export default function AuditPage() {
  const { toast } = useToast()
  const [range, setRange] = useState<DateRange>(currentMonthRange())
  const [action, setAction] = useState<AuditAction | undefined>()
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [cursor, setCursor] = useState<number | undefined>()

  const filters: AuditFilters = {
    date_from: range.date_from,
    date_to: range.date_to,
    action,
    entity_type: entityType || undefined,
    entity_id: entityId || undefined,
    cursor,
  }

  const { data: logs, isLoading, isError, refetch } = useAuditLogs(filters)

  const handleExport = async () => {
    const days = differenceInDays(parseISO(range.date_to), parseISO(range.date_from))
    if (days > 90) {
      toast({ variant: 'destructive', description: 'El rango de exportación no puede superar 90 días' })
      return
    }
    try {
      const res = await api.get('/audit/export', {
        params: { date_from: range.date_from, date_to: range.date_to, action, entity_type: entityType || undefined },
        responseType: 'blob',
      })
      downloadBlob(res, `auditoria_${range.date_from}_${range.date_to}.xlsx`)
    } catch {
      toast({ variant: 'destructive', description: 'Error al exportar' })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Auditoría"
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />Exportar Excel (máx. 90 días)
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
        <DateRangeFilter onApply={(r) => { setRange(r); setCursor(undefined) }} defaultValues={range} />
        <div className="space-y-1">
          <Label className="text-xs">Acción</Label>
          <Select value={action ?? '__all__'} onValueChange={(v) => setAction(v === '__all__' ? undefined : v as AuditAction)}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo entidad</Label>
          <Input className="h-8 w-36" placeholder="product, user..." value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ID entidad</Label>
          <Input className="h-8 w-24" placeholder="ID..." value={entityId} onChange={(e) => setEntityId(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
          {isLoading ? <Skeleton className="m-3 h-48" /> : isError ? (
            <ErrorState
              className="py-10"
              message="No se pudo cargar el historial de auditoria."
              onRetry={() => void refetch()}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs ?? []).length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState
                          className="py-10"
                          heading="Sin resultados"
                          description="Ajusta los filtros para encontrar registros de auditoria."
                        />
                      </TableCell>
                    </TableRow>
                    )
                  : (logs ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(l.timestamp).toLocaleString('es-EC')}
                      </TableCell>
                      <TableCell className="text-sm">{l.username ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANTS[l.action] ?? 'secondary'} className="text-xs">
                          {l.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{l.entity_type ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{l.entity_id ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.ip_address ?? '—'}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate" title={l.description ?? undefined}>{l.description ?? '—'}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!cursor} onClick={() => setCursor(undefined)}>Primera página</Button>
        <Button variant="outline" size="sm"
          disabled={!logs || logs.length < 50}
          onClick={() => setCursor(logs?.[logs.length - 1]?.id)}>
          Siguiente →
        </Button>
      </div>
    </div>
  )
}
