import { useState } from 'react'
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useCategories, useDeleteCategory } from '@/features/catalog/hooks'
import { CategoryFormModal } from '@/features/catalog/CategoryFormModal'
import { AttributesPanel } from '@/features/catalog/AttributesPanel'
import type { Category } from '@/types/api'
import { useToast } from '@/hooks/use-toast'

function CategoryNode({
  cat,
  allCats,
  depth,
  onEdit,
  onDelete,
  onSelectAttrs,
}: {
  cat: Category
  allCats: Category[]
  depth: number
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  onSelectAttrs: (c: Category) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const children = allCats.filter((c) => c.parent_id === cat.id && c.is_active)

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded px-3 py-2 hover:bg-muted group"
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      >
        <button className="w-4 flex items-center" onClick={() => setExpanded((e) => !e)}>
          {children.length > 0
            ? (expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)
            : null}
        </button>
        <Tags className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm">{cat.name}</span>
        {children.length > 0 && <Badge variant="secondary" className="text-xs">{children.length}</Badge>}
        <div className="hidden group-hover:flex gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onSelectAttrs(cat)} title="Atributos">
            <Tags className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(cat)} title="Editar">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(cat)} title="Eliminar">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {expanded && children.map((child) => (
        <CategoryNode key={child.id} cat={child} allCats={allCats} depth={depth + 1}
          onEdit={onEdit} onDelete={onDelete} onSelectAttrs={onSelectAttrs} />
      ))}
    </div>
  )
}

export default function CategoriesPage() {
  const { data: cats, isLoading } = useCategories()
  const deleteCategory = useDeleteCategory()
  const { toast } = useToast()
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedForAttrs, setSelectedForAttrs] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const roots = (cats ?? []).filter((c) => !c.parent_id && c.is_active)

  const performDelete = async (cat: Category) => {
    try {
      await deleteCategory.mutateAsync(cat.id)
      toast({ variant: 'success', title: 'Categoría eliminada', description: `"${cat.name}" eliminada.` })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
      const restricted = code === 'CATEGORY_HAS_CHILDREN' || code === 'CATEGORY_HAS_PRODUCTS'
      toast({
        variant: restricted ? 'warning' : 'destructive',
        title: restricted ? 'Acción restringida' : 'Error al eliminar',
        description: code === 'CATEGORY_HAS_CHILDREN'
          ? 'No se puede eliminar una categoría con subcategorías activas.'
          : code === 'CATEGORY_HAS_PRODUCTS'
            ? 'No se puede eliminar una categoría con productos asignados.'
            : `No se pudo eliminar "${cat.name}". Intenta nuevamente.`,
      })
      throw err
    }
  }

  if (selectedForAttrs) {
    return <AttributesPanel category={selectedForAttrs} onBack={() => setSelectedForAttrs(null)} />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorías"
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />Nueva categoría</Button>}
      />

      <div className="rounded-lg border bg-card">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mx-3 my-2 h-8" />)
          : roots.length === 0
            ? <p className="p-6 text-center text-muted-foreground">No hay categorías todavía.</p>
            : roots.map((cat) => (
              <CategoryNode key={cat.id} cat={cat} allCats={cats ?? []} depth={0}
                onEdit={setEditTarget} onDelete={setDeleteTarget} onSelectAttrs={setSelectedForAttrs} />
            ))
        }
      </div>

      {(showCreate || editTarget) && (
        <CategoryFormModal
          category={editTarget ?? undefined}
          allCategories={cats ?? []}
          onClose={() => { setShowCreate(false); setEditTarget(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Eliminar categoría"
          description={<>¿Eliminar la categoría <strong>{deleteTarget.name}</strong>?</>}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={() => performDelete(deleteTarget)}
        />
      )}
    </div>
  )
}
