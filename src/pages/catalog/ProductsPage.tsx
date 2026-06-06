import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { TreeSelector } from '@/components/shared/TreeSelector'
import { PageHeader } from '@/components/shared/PageHeader'
import { useProducts, useCategories } from '@/features/catalog/hooks'
import { useAuth } from '@/contexts/AuthContext'
import type { ProductStatus } from '@/types/api'

export default function ProductsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canEdit = user?.role === 'admin' || user?.role === 'operator'

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [status, setStatus] = useState<ProductStatus | undefined>()
  const [bajoStock, setBajoStock] = useState(false)
  const [cursor, setCursor] = useState<number | undefined>()

  const { data: products, isLoading } = useProducts({ name: name || undefined, category_id: categoryId ?? undefined, status, bajo_stock: bajoStock || undefined, cursor })
  const { data: categories } = useCategories()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Productos"
        actions={canEdit && (
          <Button onClick={() => navigate('/products/new')}>
            <Plus className="mr-2 h-4 w-4" />Nuevo producto
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nombre..." value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-56">
          <TreeSelector
            categories={categories ?? []}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Todas las categorías"
          />
        </div>
        <Select value={status ?? '__all__'} onValueChange={(v) => setStatus(v === '__all__' ? undefined : v as ProductStatus)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="inactive">Inactivo</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox id="bajo_stock" checked={bajoStock} onCheckedChange={(v) => setBajoStock(!!v)} />
          <Label htmlFor="bajo_stock">Solo bajo stock</Label>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading
          ? <Skeleton className="m-3 h-48" />
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Stock mín.</TableHead>
                  <TableHead>PVP</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(products ?? []).length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
                  : (products ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link to={`/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                        {p.bajo_stock && <AlertTriangle className="ml-1 inline h-3 w-3 text-destructive" />}
                      </TableCell>
                      <TableCell className={p.bajo_stock ? 'text-destructive font-medium' : ''}>{p.stock_actual}</TableCell>
                      <TableCell>{p.stock_minimo}</TableCell>
                      <TableCell>${Number(p.pvp).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status === 'active' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild><Link to={`/products/${p.id}`}>Ver</Link></Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!cursor} onClick={() => setCursor(undefined)}>Primera página</Button>
        <Button variant="outline" size="sm"
          disabled={!products || products.length < 50}
          onClick={() => setCursor(products?.[products.length - 1]?.id)}>
          Siguiente →
        </Button>
      </div>
    </div>
  )
}
