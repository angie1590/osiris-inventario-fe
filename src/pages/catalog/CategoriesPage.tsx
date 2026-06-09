import { useState } from 'react'
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { FilterBar } from '@/components/shared/FilterBar'
import { SearchInput } from '@/components/shared/SearchInput'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useCategories, useDeleteCategory } from '@/features/catalog/hooks'
import { CategoryFormModal } from '@/features/catalog/CategoryFormModal'
import { AttributesPanel } from '@/features/catalog/AttributesPanel'
import { buildCategoryPath } from '@/features/catalog/categoryPath'
import type { Category } from '@/types/api'
import { useToast } from '@/hooks/use-toast'
import { parseApiError } from '@/lib/api-error'
import { useAuth } from '@/contexts/AuthContext'

function CategoryNode({
  cat,
  allCats,
  depth,
  canManage,
  onEdit,
  onDelete,
  onSelectAttrs,
}: {
  cat: Category
  allCats: Category[]
  depth: number
  canManage: boolean
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
          {canManage && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(cat)} title="Editar">
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {canManage && (
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(cat)} title="Eliminar">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {expanded && children.map((child) => (
        <CategoryNode key={child.id} cat={child} allCats={allCats} depth={depth + 1}
          canManage={canManage} onEdit={onEdit} onDelete={onDelete} onSelectAttrs={onSelectAttrs} />
      ))}
    </div>
  )
}

export default function CategoriesPage() {
  const { data: cats, isLoading } = useCategories()
  const deleteCategory = useDeleteCategory()
  const { toast } = useToast()
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'supervisor'
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedForAttrs, setSelectedForAttrs] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [filter, setFilter] = useState('')
  const [productsPrompt, setProductsPrompt] = useState<{ cat: Category; message: string } | null>(null)

  const roots = (cats ?? []).filter((c) => !c.parent_id && c.is_active)
  const q = filter.trim().toLowerCase()
  const matches = q
    ? (cats ?? []).filter((c) => c.is_active && c.name.toLowerCase().includes(q))
    : []

  // First step: try a plain delete. If the category has products, open a
  // second confirmation asking whether to also delete those products.
  const handleDelete = async (cat: Category) => {
    try {
      await deleteCategory.mutateAsync({ id: cat.id })
      toast({ variant: 'success', title: 'Categoría eliminada', description: `"${cat.name}" eliminada.` })
    } catch (err: unknown) {
      const { code, message } = parseApiError(err)
      if (code === 'CATEGORY_HAS_PRODUCTS') {
        setProductsPrompt({ cat, message: message ?? 'La categoría tiene productos asociados.' })
        return
      }
      const restricted = code === 'CATEGORY_HAS_CHILDREN' || code === 'CATEGORY_HAS_PRODUCTS_WITH_STOCK'
      toast({
        variant: restricted ? 'warning' : 'destructive',
        title: restricted ? 'Acción restringida' : 'Error al eliminar',
        description: message ?? `No se pudo eliminar "${cat.name}". Intenta nuevamente.`,
      })
    }
  }

  // Second step: delete the category and deactivate its products.
  const handleDeleteWithProducts = async (cat: Category) => {
    try {
      await deleteCategory.mutateAsync({ id: cat.id, deleteProducts: true })
      toast({
        variant: 'success',
        title: 'Categoría y productos eliminados',
        description: `"${cat.name}" y sus productos asociados fueron eliminados.`,
      })
    } catch (err: unknown) {
      const { message } = parseApiError(err)
      toast({ variant: 'destructive', title: 'Error al eliminar', description: message ?? `No se pudo eliminar "${cat.name}".` })
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
        actions={canManage && <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />Nueva categoría</Button>}
      />

      <FilterBar>
        <SearchInput value={filter} onChange={setFilter} placeholder="Buscar categoría por nombre..." />
      </FilterBar>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mx-3 my-2 h-8" />)
        ) : q ? (
          matches.length === 0
            ? <p className="p-6 text-center text-muted-foreground">Sin coincidencias para "{filter}".</p>
            : matches.map((cat) => (
              <div key={cat.id} className="group flex items-center gap-2 rounded px-3 py-2 hover:bg-muted">
                <Tags className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{cat.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{buildCategoryPath(cats ?? [], cat.id)}</p>
                </div>
                <div className="hidden group-hover:flex gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedForAttrs(cat)} title="Atributos"><Tags className="h-3 w-3" /></Button>
                  {canManage && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditTarget(cat)} title="Editar"><Pencil className="h-3 w-3" /></Button>}
                  {canManage && <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteTarget(cat)} title="Eliminar"><Trash2 className="h-3 w-3" /></Button>}
                </div>
              </div>
            ))
        ) : roots.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">No hay categorías todavía.</p>
        ) : (
          roots.map((cat) => (
            <CategoryNode key={cat.id} cat={cat} allCats={cats ?? []} depth={0}
              canManage={canManage} onEdit={setEditTarget} onDelete={setDeleteTarget} onSelectAttrs={setSelectedForAttrs} />
          ))
        )}
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
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}

      {productsPrompt && (
        <ConfirmDialog
          open
          onClose={() => setProductsPrompt(null)}
          title="La categoría tiene productos"
          description={
            <>
              {productsPrompt.message} ¿Deseas eliminar también los productos
              asociados a <strong>{productsPrompt.cat.name}</strong>? Quedarán inactivos.
            </>
          }
          confirmLabel="Eliminar categoría y productos"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => handleDeleteWithProducts(productsPrompt.cat)}
        />
      )}
    </div>
  )
}
