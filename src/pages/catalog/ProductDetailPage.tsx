import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Pencil, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useProduct, useToggleProductStatus, useCategories } from '@/features/catalog/hooks'
import { buildCategoryPath } from '@/features/catalog/categoryPath'
import { ReactivateProductDialog } from '@/features/catalog/ReactivateProductDialog'
import { useStockMode, formatQuantity } from '@/hooks/useStockMode'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const canEdit = user?.role === 'admin' || user?.role === 'operator'
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [reactivate, setReactivate] = useState(false)

  const { data: product, isLoading } = useProduct(Number(id))
  const { data: categories } = useCategories()
  const { integerMode } = useStockMode()
  const toggleStatus = useToggleProductStatus()

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!product) return <p>Producto no encontrado</p>

  const handleToggle = async () => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    try {
      await toggleStatus.mutateAsync({ id: product.id, status: newStatus })
      toast({
        variant: 'success',
        title: newStatus === 'active' ? 'Producto activado' : 'Producto desactivado',
        description: `"${product.name}" ${newStatus === 'active' ? 'activado' : 'desactivado'} correctamente.`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error al cambiar estado',
        description: `No se pudo actualizar "${product.name}". Intenta nuevamente.`,
      })
      throw new Error('toggle failed')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={product.name}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
              {product.status === 'active' ? 'Activo' : 'Inactivo'}
            </Badge>
            {product.bajo_stock && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Bajo Stock</Badge>}
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Información general</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Categoría</span><span className="text-right">{buildCategoryPath(categories ?? [], product.category_id)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Descripción</span><span>{product.description || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">PVP</span><span>${Number(product.pvp).toFixed(2)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stock</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock actual</span>
              <span className={product.bajo_stock ? 'text-destructive font-bold' : 'font-bold'}>{formatQuantity(product.stock_actual, integerMode)}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stock mínimo</span><span>{formatQuantity(product.stock_minimo, integerMode)}</span></div>
          </CardContent>
        </Card>
      </div>

      {Object.keys(product.custom_attributes ?? {}).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Atributos personalizados</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {Object.entries(product.custom_attributes).map(([k, v]) => (
                <div key={k} className="flex justify-between rounded bg-muted/50 px-3 py-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span>{typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {canEdit && (
          <Button onClick={() => navigate(`/products/${product.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />Editar
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => {
              const categoryAlive = (categories ?? []).some((c) => c.id === product.category_id)
              if (product.status === 'inactive' && !categoryAlive) setReactivate(true)
              else setConfirmToggle(true)
            }}
          >
            {product.status === 'active' ? 'Desactivar' : 'Activar'}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to={`/kardex/${product.id}`}><BookOpen className="mr-2 h-4 w-4" />Ver Kardex</Link>
        </Button>
      </div>

      {confirmToggle && (
        <ConfirmDialog
          open
          onClose={() => setConfirmToggle(false)}
          title={product.status === 'active' ? 'Desactivar producto' : 'Activar producto'}
          description={<>¿{product.status === 'active' ? 'Desactivar' : 'Activar'} el producto <strong>{product.name}</strong>?</>}
          confirmLabel={product.status === 'active' ? 'Desactivar' : 'Activar'}
          variant={product.status === 'active' ? 'danger' : 'default'}
          onConfirm={handleToggle}
        />
      )}

      {reactivate && (
        <ReactivateProductDialog product={product} onClose={() => setReactivate(false)} />
      )}
    </div>
  )
}
