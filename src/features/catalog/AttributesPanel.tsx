import { useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCategoryAttributes, useDeleteAttribute } from './hooks'
import { AttributeFormModal } from './AttributeFormModal'
import type { Category } from '@/types/api'
import { useToast } from '@/hooks/use-toast'

interface Props { category: Category; onBack: () => void }

export function AttributesPanel({ category, onBack }: Props) {
  const { data: attrs, isLoading } = useCategoryAttributes(category.id)
  const deleteAttr = useDeleteAttribute()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)

  const handleDelete = async (attrId: number) => {
    if (!confirm('¿Eliminar este atributo?')) return
    try {
      await deleteAttr.mutateAsync({ categoryId: category.id, attrId })
      toast({ title: 'Atributo eliminado' })
    } catch {
      toast({ variant: 'destructive', description: 'Error al eliminar' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">Atributos — {category.name}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1 h-4 w-4" />Agregar</Button>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading
          ? <Skeleton className="m-3 h-32" />
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Requerido</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(attrs ?? []).length === 0
                  ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin atributos</TableCell></TableRow>
                  : (attrs ?? []).map((attr) => (
                    <TableRow key={attr.id}>
                      <TableCell className="font-medium">{attr.name}</TableCell>
                      <TableCell><Badge variant="outline">{attr.data_type}</Badge></TableCell>
                      <TableCell>{attr.is_required ? 'Sí' : 'No'}</TableCell>
                      <TableCell>
                        {attr.inherited
                          ? <Badge variant="secondary">Heredado</Badge>
                          : <Badge variant="default">Propio</Badge>}
                      </TableCell>
                      <TableCell>
                        {!attr.inherited && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(attr.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
      </div>

      {showCreate && (
        <AttributeFormModal categoryId={category.id} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
