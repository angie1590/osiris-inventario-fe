import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useStockReport } from '@/features/reports/hooks'
import { useIngresos, useEgresos } from '@/features/inventory/hooks'
import { useAuth } from '@/contexts/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: lowStock, isLoading: stockLoading } = useStockReport({ bajo_stock: true })
  const { data: recentIn } = useIngresos({ cursor: undefined })
  const { data: recentOut } = useEgresos({ cursor: undefined })

  const recentMovements = [
    ...(recentIn ?? []).slice(0, 3).map((d) => ({ ...d, label: 'Ingreso' })),
    ...(recentOut ?? []).slice(0, 3).map((d) => ({ ...d, label: 'Egreso' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bienvenido, {user?.full_name}</h1>
        <p className="text-muted-foreground text-sm">Resumen del sistema de inventario</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos bajo mínimo</CardTitle>
          </CardHeader>
          <CardContent>
            {stockLoading
              ? <Skeleton className="h-8 w-16" />
              : <p className={`text-3xl font-bold ${(lowStock ?? []).length > 0 ? 'text-destructive' : ''}`}>{(lowStock ?? []).length}</p>}
            {(lowStock ?? []).length > 0 && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />Requiere atención
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(recentIn ?? []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">Últimos documentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Egresos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(recentOut ?? []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">Últimos documentos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(lowStock ?? []).length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Productos bajo stock</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/products?bajo_stock=true">Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lowStock ?? []).slice(0, 5).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link to={`/products/${p.id}`} className="font-medium hover:underline text-sm">{p.name}</Link>
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">{p.stock_actual}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.stock_minimo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Movimientos recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reports"><BarChart3 className="mr-1 h-3.5 w-3.5" />Ver reportes</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos recientes</p>
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMovements.map((d) => (
                      <TableRow key={`${d.label}-${d.id}`}>
                        <TableCell className="font-mono text-xs">{d.number}</TableCell>
                        <TableCell><Badge variant={d.label === 'Ingreso' ? 'default' : 'secondary'}>{d.label}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString('es-EC')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
