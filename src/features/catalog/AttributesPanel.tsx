import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Pencil, PowerOff, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCategoryAttributes, useDeleteAttribute, useDeactivateAttribute, useReactivateAttribute } from './hooks'
import { AttributeFormModal } from './AttributeFormModal'
import { AttributeEditModal } from './AttributeEditModal'
import type { Category, CategoryAttribute } from '@/types/api'
import { useToast } from '@/hooks/use-toast'

interface Props { category: Category; onBack: () => void }

export function AttributesPanel({ category, onBack }: Props) {
  const { data: attrs, isLoading } = useCategoryAttributes(category.id)
  const deleteAttr = useDeleteAttribute()
  const deactivate = useDeactivateAttribute()
  const reactivate = useReactivateAttribute()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<CategoryAttribute | null>(null)

  const handleDelete = async (attrId: number) => {
    if (!confirm('¿Eliminar este atributo? Esta acción no se puede deshacer.')) return
    try {
      await deleteAttr.mutateAsync({ categoryId: category.id, attrId })
      toast({ title: 'Atributo eliminado' })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      const msg = code === 'ATTRIBUTE_IN_USE'
        ? 'No se puede eliminar: hay productos con este atributo. Usa "Desactivar" en su lugar.'
        : 'Error al eliminar'
      toast({ variant: 'destructive', description: msg })
    }
  }

  const handleToggleActive = async (attr: CategoryAttribute) => {
    const action = attr.is_active ? 'desactivar' : 'activar'
    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} el atributo "${attr.name}"?`)) return
    try {
      if (attr.is_active) {
        await deactivate.mutateAsync({ categoryId: category.id, attrId: attr.id })
        toast({ title: 'Atributo desactivado' })
      } else {
        await reactivate.mutateAsync({ categoryId: category.id, attrId: attr.id })
        toast({ title: 'Atributo reactivado' })
      }
    } catch {
      toast({ variant: 'destructive', description: 'Error al cambiar el estado del atributo' })
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
                  <TableHead>Estado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(attrs ?? []).length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin atributos</TableCell></TableRow>
                  : (attrs ?? []).map((attr) => (
                    <TableRow key={attr.id} className={!attr.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{attr.name}</TableCell>
                      <TableCell><Badge variant="outline">{attr.data_type}</Badge></TableCell>
                      <TableCell>{attr.is_required ? 'Sí' : 'No'}</TableCell>
                      <TableCell>
                        {attr.is_active
                          ? <Badge variant="default">Activo</Badge>
                          : <Badge variant="secondary">Inactivo</Badge>}
                      </TableCell>
                      <TableCell>
                        {attr.inherited
                          ? <Badge variant="secondary">Heredado</Badge>
                          : <Badge variant="default">Propio</Badge>}
                      </TableCell>
                      <TableCell>
                        {!attr.inherited && (
                          <div className="flex gap-1">
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setEditTarget(attr)}
                              title="Editar"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => handleToggleActive(attr)}
                              title={attr.is_active ? 'Desactivar' : 'Activar'}
                            >
                              {attr.is_active
                                ? <PowerOff className="h-3 w-3 text-warning" />
                                : <Power className="h-3 w-3 text-success" />}
                            </Button>
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => handleDelete(attr.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
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
      {editTarget && (
        <AttributeEditModal
          categoryId={category.id}
          attribute={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}
