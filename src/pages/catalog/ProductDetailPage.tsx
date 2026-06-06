import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Pencil, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { useProduct, useToggleProductStatus } from '@/features/catalog/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const canEdit = user?.role === 'admin' || user?.role === 'operator'

  const { data: product, isLoading } = useProduct(Number(id))
  const toggleStatus = useToggleProductStatus()

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!product) return <p>Producto no encontrado</p>

  const handleToggle = async () => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    if (!confirm(`¿${newStatus === 'inactive' ? 'Desactivar' : 'Activar'} "${product.name}"?`)) return
    try {
      await toggleStatus.mutateAsync({ id: product.id, status: newStatus })
      toast({ title: `Producto ${newStatus === 'active' ? 'activado' : 'desactivado'}` })
    } catch {
      toast({ variant: 'destructive', description: 'Error al cambiar estado' })
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
            <div className="flex justify-between"><span className="text-muted-foreground">Descripción</span><span>{product.description || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">PVP</span><span>${Number(product.pvp).toFixed(2)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stock</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock actual</span>
              <span className={product.bajo_stock ? 'text-destructive font-bold' : 'font-bold'}>{product.stock_actual}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stock mínimo</span><span>{product.stock_minimo}</span></div>
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
                  <span>{String(v)}</span>
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
          <Button variant="outline" onClick={handleToggle}>
            {product.status === 'active' ? 'Desactivar' : 'Activar'}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to={`/kardex/${product.id}`}><BookOpen className="mr-2 h-4 w-4" />Ver Kardex</Link>
        </Button>
      </div>
    </div>
  )
}
