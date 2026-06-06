import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSystemParams, useUpdateParam } from '@/features/admin/hooks'
import { useToast } from '@/hooks/use-toast'

const FIXED_PARAM_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  report_include_logo: [
    { value: 'true', label: 'Sí (true)' },
    { value: 'false', label: 'No (false)' },
  ],
  stock_quantity_mode: [
    { value: 'integer', label: 'Entero (integer)' },
    { value: 'decimal', label: 'Decimal (decimal)' },
  ],
  kardex_method: [
    { value: 'PEPS', label: 'PEPS' },
    { value: 'WEIGHTED_AVERAGE', label: 'WEIGHTED_AVERAGE' },
  ],
}

export default function AdminParamsPage() {
  const { toast } = useToast()
  const { data: params, isLoading } = useSystemParams()
  const updateParam = useUpdateParam()
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (key: string, currentValue: string) => {
    setEditKey(key)
    setEditValue(currentValue)
  }

  const cancelEdit = () => {
    setEditKey(null)
    setEditValue('')
  }

  const saveEdit = async (key: string) => {
    try {
      await updateParam.mutateAsync({ key, value: editValue })
      toast({ title: 'Parámetro actualizado' })
      setEditKey(null)
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
      toast({
        variant: 'destructive',
        description: code === 'KARDEX_METHOD_LOCKED'
          ? 'No se puede cambiar el método Kardex mientras haya movimientos registrados'
          : 'Error al actualizar',
      })
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Parámetros del sistema</h1>

      <div className="rounded-lg border bg-card">
        {isLoading ? <Skeleton className="m-3 h-48" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clave</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Última actualización</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(params ?? []).length === 0
                ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin parámetros</TableCell></TableRow>
                : (params ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.key}</TableCell>
                    <TableCell>
                      {editKey === p.key ? (
                        FIXED_PARAM_OPTIONS[p.key] ? (
                          <Select value={editValue} onValueChange={setEditValue}>
                            <SelectTrigger className="h-7 w-44">
                              <SelectValue placeholder="Selecciona un valor" />
                            </SelectTrigger>
                            <SelectContent>
                              {FIXED_PARAM_OPTIONS[p.key].map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input className="h-7 w-36" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                        )
                      ) : (
                        <span>{p.value}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-64">{p.description ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString('es-EC')}
                    </TableCell>
                    <TableCell>
                      {editKey === p.key ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(p.key)} disabled={updateParam.isPending}>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(p.key, p.value)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
