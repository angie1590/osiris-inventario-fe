import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, AlertTriangle, BookOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { FilterBar } from '@/components/shared/FilterBar'
import { SearchInput } from '@/components/shared/SearchInput'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { DetailModal } from '@/components/shared/DetailModal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TreeSelector } from '@/components/shared/TreeSelector'
import { ProductFormModal } from '@/features/catalog/ProductFormModal'
import { useProducts, useCategories, useToggleProductStatus } from '@/features/catalog/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import type { Product, ProductStatus } from '@/types/api'

function fmtCurrency(value: number) {
  return `$${Number(value).toFixed(2)}`
}

function StatusBadge({ status }: { status: ProductStatus }) {
  return <Badge variant={status === 'active' ? 'success' : 'secondary'}>{status === 'active' ? 'Activo' : 'Inactivo'}</Badge>
}

export default function ProductsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const canEdit = user?.role === 'admin' || user?.role === 'operator'

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [status, setStatus] = useState<ProductStatus | undefined>('active')
  const [bajoStock, setBajoStock] = useState(false)
  const [cursor, setCursor] = useState<number | undefined>()

  // Any filter change must reset pagination so we never land on a stale page.
  const resetPage = () => setCursor(undefined)
  const hasActiveFilters = name !== '' || categoryId !== null || status !== 'active' || bajoStock
  const clearFilters = () => {
    setName('')
    setCategoryId(null)
    setStatus('active')
    setBajoStock(false)
    setCursor(undefined)
  }
  const [viewProduct, setViewProduct] = useState<Product | undefined>()
  const [toggleTarget, setToggleTarget] = useState<Product | undefined>()
  const [showCreate, setShowCreate] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | undefined>()

  const { data: products, isLoading, isError, refetch } = useProducts({ name: name || undefined, category_id: categoryId ?? undefined, status, bajo_stock: bajoStock || undefined, cursor })
  const { data: categories } = useCategories()
  const toggleStatus = useToggleProductStatus()

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of categories ?? []) map.set(c.id, c.name)
    return map
  }, [categories])

  const categoryName = (id: number) => categoryNameById.get(id) ?? '—'

  const handleToggle = async (p: Product) => {
    const newStatus: ProductStatus = p.status === 'active' ? 'inactive' : 'active'
    try {
      await toggleStatus.mutateAsync({ id: p.id, status: newStatus })
      toast({
        variant: 'success',
        title: newStatus === 'active' ? 'Producto activado' : 'Producto desactivado',
        description: `"${p.name}" ${newStatus === 'active' ? 'activado' : 'desactivado'} correctamente.`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error al cambiar estado',
        description: `No se pudo actualizar "${p.name}". Intenta nuevamente.`,
      })
      throw new Error('toggle failed')
    }
  }

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      sortAccessor: (p) => p.name,
      cell: (p) => (
        <button type="button" className="inline-flex items-center gap-1 text-left font-medium text-primary hover:underline" onClick={() => setViewProduct(p)}>
          {p.name}
          {p.bajo_stock && <AlertTriangle className="h-3 w-3 text-destructive" />}
        </button>
      ),
    },
    {
      key: 'category',
      header: 'Categoría',
      sortable: true,
      sortAccessor: (p) => categoryName(p.category_id),
      cell: (p) => <span className="text-sm">{categoryName(p.category_id)}</span>,
    },
    {
      key: 'stock_actual',
      header: 'Stock',
      align: 'right',
      sortable: true,
      sortAccessor: (p) => p.stock_actual,
      cell: (p) => <span className={p.bajo_stock ? 'font-medium text-destructive' : ''}>{p.stock_actual}</span>,
    },
    {
      key: 'stock_minimo',
      header: 'Stock mín.',
      align: 'right',
      sortable: true,
      sortAccessor: (p) => p.stock_minimo,
      cell: (p) => p.stock_minimo,
    },
    {
      key: 'pvp',
      header: 'PVP',
      align: 'right',
      sortable: true,
      sortAccessor: (p) => p.pvp,
      cell: (p) => fmtCurrency(p.pvp),
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      sortAccessor: (p) => p.status,
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setViewProduct(p)}>Ver</Button>
          {canEdit && <Button variant="ghost" size="sm" onClick={() => setEditProduct(p)}>Editar</Button>}
          {canEdit && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToggleTarget(p)}>
              {p.status === 'active' ? 'Desactivar' : 'Activar'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Productos"
        actions={canEdit && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />Nuevo producto
          </Button>
        )}
      />

      <FilterBar>
        <SearchInput value={name} onChange={(v) => { setName(v); resetPage() }} placeholder="Buscar por nombre..." />
        <div className="w-56">
          <TreeSelector
            categories={categories ?? []}
            value={categoryId}
            onChange={(id) => { setCategoryId(id); resetPage() }}
            placeholder="Todas las categorías"
            allowRootOption
            rootLabel="Todas las categorías"
          />
        </div>
        <Select value={status ?? '__all__'} onValueChange={(v) => { setStatus(v === '__all__' ? undefined : v as ProductStatus); resetPage() }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="inactive">Inactivo</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex h-9 items-center gap-2">
          <Checkbox id="bajo_stock" checked={bajoStock} onCheckedChange={(v) => { setBajoStock(!!v); resetPage() }} />
          <Label htmlFor="bajo_stock">Solo bajo stock</Label>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" className="h-9" onClick={clearFilters}>
            <X className="mr-1.5 h-4 w-4" />Limpiar filtros
          </Button>
        )}
      </FilterBar>

      <DataTable
        columns={columns}
        data={products ?? []}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyHeading="Sin resultados"
        emptyDescription="No se encontraron productos para los filtros seleccionados."
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!cursor} onClick={() => setCursor(undefined)}>Primera página</Button>
        <Button variant="outline" size="sm"
          disabled={!products || products.length < 50}
          onClick={() => setCursor(products?.[products.length - 1]?.id)}>
          Siguiente →
        </Button>
      </div>

      {viewProduct && (
        <DetailModal
          open
          onClose={() => setViewProduct(undefined)}
          title={viewProduct.name}
          subtitle={viewProduct.bajo_stock ? 'Bajo stock' : undefined}
          sections={[
            {
              title: 'Información general',
              fields: [
                { label: 'Descripción', value: viewProduct.description || '—', full: true },
                { label: 'Categoría', value: categoryName(viewProduct.category_id) },
                { label: 'PVP', value: fmtCurrency(viewProduct.pvp) },
                { label: 'Estado', value: <StatusBadge status={viewProduct.status} /> },
              ],
            },
            {
              title: 'Stock',
              fields: [
                {
                  label: 'Stock actual',
                  value: <span className={viewProduct.bajo_stock ? 'font-semibold text-destructive' : 'font-semibold'}>{viewProduct.stock_actual}</span>,
                },
                { label: 'Stock mínimo', value: viewProduct.stock_minimo },
              ],
            },
            ...(Object.keys(viewProduct.custom_attributes ?? {}).length > 0
              ? [{
                  title: 'Atributos personalizados',
                  fields: Object.entries(viewProduct.custom_attributes).map(([k, v]) => ({ label: k, value: String(v) })),
                }]
              : []),
          ]}
          footer={
            <>
              <Button variant="outline" asChild>
                <Link to={`/kardex/${viewProduct.id}`}><BookOpen className="mr-2 h-4 w-4" />Ver Kardex</Link>
              </Button>
              {canEdit && (
                <Button onClick={() => { setEditProduct(viewProduct); setViewProduct(undefined) }}>Editar</Button>
              )}
              <Button variant="ghost" onClick={() => setViewProduct(undefined)}>Cerrar</Button>
            </>
          }
        />
      )}

      {showCreate && <ProductFormModal onClose={() => setShowCreate(false)} />}
      {editProduct && <ProductFormModal product={editProduct} onClose={() => setEditProduct(undefined)} />}

      {toggleTarget && (
        <ConfirmDialog
          open
          onClose={() => setToggleTarget(undefined)}
          title={toggleTarget.status === 'active' ? 'Desactivar producto' : 'Activar producto'}
          description={
            <>¿{toggleTarget.status === 'active' ? 'Desactivar' : 'Activar'} el producto <strong>{toggleTarget.name}</strong>?</>
          }
          confirmLabel={toggleTarget.status === 'active' ? 'Desactivar' : 'Activar'}
          variant={toggleTarget.status === 'active' ? 'danger' : 'default'}
          onConfirm={() => handleToggle(toggleTarget)}
        />
      )}
    </div>
  )
}
