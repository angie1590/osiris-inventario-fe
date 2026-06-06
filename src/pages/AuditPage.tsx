import { useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, ChevronsUpDown, Download, Search } from 'lucide-react'
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
import { useAuditLogs, useAuditUsers, type AuditFilters } from '@/features/audit/hooks'
import { downloadBlob } from '@/lib/download'
import { differenceInDays, parseISO } from 'date-fns'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
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

function highlightMatch(text: string, query: string) {
  const q = query.trim()
  if (!q) return text

  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts: React.ReactNode[] = []
  let cursor = 0

  while (cursor < text.length) {
    const idx = lower.indexOf(needle, cursor)
    if (idx === -1) {
      parts.push(text.slice(cursor))
      break
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx))
    parts.push(
      <span key={`${idx}-${needle}`} className="rounded bg-cyan-100 px-0.5 text-cyan-900">
        {text.slice(idx, idx + needle.length)}
      </span>
    )
    cursor = idx + needle.length
  }

  return parts
}

export default function AuditPage() {
  const { toast } = useToast()
  const [range, setRange] = useState<DateRange>(currentMonthRange())
  const [action, setAction] = useState<AuditAction | undefined>()
  const [userOpen, setUserOpen] = useState(false)
  const [userQuery, setUserQuery] = useState('')
  const [userId, setUserId] = useState<number | undefined>()
  const [selectedUserLabel, setSelectedUserLabel] = useState<string>('Todos los usuarios')
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [cursor, setCursor] = useState<number | undefined>()
  const { data: users, isLoading: usersLoading } = useAuditUsers(userQuery || undefined)
  const currentUserLabel = userId
    ? (users?.find((u) => u.id === userId)
      ? `${users.find((u) => u.id === userId)!.full_name} (${users.find((u) => u.id === userId)!.username})`
      : selectedUserLabel)
    : 'Todos los usuarios'

  const filters: AuditFilters = {
    date_from: range.date_from,
    date_to: range.date_to,
    user_id: userId,
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
          <Label className="text-xs">Usuario</Label>
          <PopoverPrimitive.Root open={userOpen} onOpenChange={setUserOpen}>
            <PopoverPrimitive.Trigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={userOpen}
                className="h-8 w-56 justify-between font-normal"
              >
                <span className="truncate">{currentUserLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                className={cn(
                  'w-(--radix-popover-trigger-width) rounded-md border bg-popover p-0 shadow-md',
                  'data-[state=open]:animate-in data-[state=closed]:animate-out',
                  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                )}
                style={{ zIndex: 350 }}
                align="start"
                sideOffset={4}
              >
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Buscar usuario..."
                    className="h-7 border-none p-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1" role="listbox">
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm',
                      'cursor-pointer hover:bg-accent',
                      !userId && 'bg-primary/10 font-medium',
                    )}
                    onClick={() => {
                      setUserId(undefined)
                      setSelectedUserLabel('Todos los usuarios')
                      setUserOpen(false)
                    }}
                  >
                    <span className="flex-1 truncate text-left">Todos los usuarios</span>
                    {!userId && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                  {usersLoading ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">Cargando...</p>
                  ) : (users ?? []).length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">Sin resultados</p>
                  ) : (
                    (users ?? []).map((u) => {
                      const label = `${u.full_name} (${u.username})`
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm',
                            'cursor-pointer hover:bg-accent',
                            userId === u.id && 'bg-primary/10 font-medium',
                          )}
                          onClick={() => {
                            setUserId(u.id)
                            setSelectedUserLabel(label)
                            setUserOpen(false)
                          }}
                        >
                          <span className="flex-1 truncate text-left">{highlightMatch(label, userQuery)}</span>
                          {userId === u.id && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
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
