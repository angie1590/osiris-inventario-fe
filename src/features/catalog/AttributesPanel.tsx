import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Pencil, PowerOff, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useCategoryAttributes, useDeleteAttribute, useDeactivateAttribute, useReactivateAttribute } from './hooks'
import { AttributeFormModal } from './AttributeFormModal'
import { AttributeEditModal } from './AttributeEditModal'
import type { Category, CategoryAttribute } from '@/types/api'
import { useToast } from '@/hooks/use-toast'

interface Props { category: Category; onBack: () => void }

export function AttributesPanel({ category, onBack }: Props) {
  const { data: attrs, isLoading, isError, refetch } = useCategoryAttributes(category.id)
  const deleteAttr = useDeleteAttribute()
  const deactivate = useDeactivateAttribute()
  const reactivate = useReactivateAttribute()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<CategoryAttribute | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategoryAttribute | null>(null)
  const [toggleTarget, setToggleTarget] = useState<CategoryAttribute | null>(null)

  const handleDelete = async (attr: CategoryAttribute) => {
    try {
      await deleteAttr.mutateAsync({ categoryId: category.id, attrId: attr.id })
      toast({ variant: 'success', title: 'Atributo eliminado', description: `"${attr.name}" eliminado.` })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      const inUse = code === 'ATTRIBUTE_IN_USE'
      toast({
        variant: inUse ? 'warning' : 'destructive',
        title: inUse ? 'Acción restringida' : 'Error al eliminar',
        description: inUse
          ? 'Hay productos con este atributo. Usa "Desactivar" en su lugar.'
          : `No se pudo eliminar "${attr.name}". Intenta nuevamente.`,
      })
      throw err
    }
  }

  const handleToggleActive = async (attr: CategoryAttribute) => {
    try {
      if (attr.is_active) {
        await deactivate.mutateAsync({ categoryId: category.id, attrId: attr.id })
        toast({ variant: 'success', title: 'Atributo desactivado', description: `"${attr.name}" desactivado.` })
      } else {
        await reactivate.mutateAsync({ categoryId: category.id, attrId: attr.id })
        toast({ variant: 'success', title: 'Atributo reactivado', description: `"${attr.name}" reactivado.` })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error al cambiar estado', description: `No se pudo actualizar "${attr.name}".` })
      throw new Error('toggle failed')
    }
  }

  const columns: Column<CategoryAttribute>[] = [
    { key: 'name', header: 'Nombre', sortable: true, sortAccessor: (a) => a.name, cell: (a) => <span className={`font-medium ${!a.is_active ? 'opacity-60' : ''}`}>{a.name}</span> },
    { key: 'data_type', header: 'Tipo', sortable: true, sortAccessor: (a) => a.data_type, cell: (a) => <Badge variant="outline">{a.data_type}</Badge> },
    { key: 'is_required', header: 'Requerido', sortable: true, sortAccessor: (a) => (a.is_required ? 1 : 0), cell: (a) => (a.is_required ? 'Sí' : 'No') },
    { key: 'is_active', header: 'Estado', sortable: true, sortAccessor: (a) => (a.is_active ? 1 : 0), cell: (a) => <Badge variant={a.is_active ? 'success' : 'secondary'}>{a.is_active ? 'Activo' : 'Inactivo'}</Badge> },
    { key: 'inherited', header: 'Origen', sortable: true, sortAccessor: (a) => (a.inherited ? 'Heredado' : 'Propio'), cell: (a) => <Badge variant={a.inherited ? 'secondary' : 'default'}>{a.inherited ? 'Heredado' : 'Propio'}</Badge> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (a) => (!a.inherited ? (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTarget(a)} title="Editar">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setToggleTarget(a)} title={a.is_active ? 'Desactivar' : 'Activar'}>
            {a.is_active ? <PowerOff className="h-3 w-3 text-warning" /> : <Power className="h-3 w-3 text-success" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(a)} title="Eliminar">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : null),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">Atributos — {category.name}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1 h-4 w-4" />Agregar</Button>
      </div>

      <DataTable
        columns={columns}
        data={attrs ?? []}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyHeading="Sin atributos"
        emptyDescription="Esta categoría no tiene atributos definidos."
      />

      {showCreate && <AttributeFormModal categoryId={category.id} onClose={() => setShowCreate(false)} />}
      {editTarget && (
        <AttributeEditModal categoryId={category.id} attribute={editTarget} onClose={() => setEditTarget(null)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Eliminar atributo"
          description={<>¿Eliminar el atributo <strong>{deleteTarget.name}</strong>? Esta acción no se puede deshacer.</>}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}

      {toggleTarget && (
        <ConfirmDialog
          open
          onClose={() => setToggleTarget(null)}
          title={toggleTarget.is_active ? 'Desactivar atributo' : 'Activar atributo'}
          description={<>¿{toggleTarget.is_active ? 'Desactivar' : 'Activar'} el atributo <strong>{toggleTarget.name}</strong>?</>}
          confirmLabel={toggleTarget.is_active ? 'Desactivar' : 'Activar'}
          variant={toggleTarget.is_active ? 'danger' : 'default'}
          onConfirm={() => handleToggleActive(toggleTarget)}
        />
      )}
    </div>
  )
}
