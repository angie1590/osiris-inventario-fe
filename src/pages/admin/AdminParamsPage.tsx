import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSystemParams, useUpdateParam } from '@/features/admin/hooks'
import { useToast } from '@/hooks/use-toast'

export default function AdminParamsPage() {
  const { toast } = useToast()
  const { data: params, isLoading } = useSystemParams()
  const updateParam = useUpdateParam()
  const [editId, setEditId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (id: number, currentValue: string) => {
    setEditId(id)
    setEditValue(currentValue)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditValue('')
  }

  const saveEdit = async (id: number) => {
    try {
      await updateParam.mutateAsync({ id, value: editValue })
      toast({ title: 'Parámetro actualizado' })
      setEditId(null)
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
                      {editId === p.id ? (
                        <Input className="h-7 w-36" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                      ) : (
                        <span>{p.value}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-64">{p.description ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString('es-EC')}
                    </TableCell>
                    <TableCell>
                      {editId === p.id ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(p.id)} disabled={updateParam.isPending}>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(p.id, p.value)}>
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
