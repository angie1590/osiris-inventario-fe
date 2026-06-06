import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { DateRangeFilter, type DateRange, currentMonthRange } from '@/features/reports/DateRangeFilter'
import { useConsolidado, useStockReport, useStockValorizado } from '@/features/reports/hooks'
import { useProducts } from '@/features/catalog/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { downloadBlob } from '@/lib/download'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n)
}

// ─── Movement report tabs (Ingresos/Egresos/Bajas/Ajustes) ───────────────────
const DOC_REPORT_TYPES: Array<{ value: string; label: string; endpoint: string; prefix: string }> = [
  { value: 'ingresos', label: 'Ingresos', endpoint: '/reports/ingresos', prefix: 'ingresos' },
  { value: 'egresos', label: 'Egresos', endpoint: '/reports/egresos', prefix: 'egresos' },
  { value: 'bajas', label: 'Bajas', endpoint: '/reports/bajas', prefix: 'bajas' },
  { value: 'ajustes', label: 'Ajustes', endpoint: '/reports/ajustes', prefix: 'ajustes' },
]

function MovementReport({ endpoint, prefix }: { endpoint: string; prefix: string }) {
  const { toast } = useToast()
  const [range, setRange] = useState<DateRange>(currentMonthRange())
  const [productId, setProductId] = useState<number | undefined>()
  const { data: products } = useProducts({ status: 'active' })

  const handleExport = async (fmt: 'pdf' | 'excel') => {
    if (!range) return
    try {
      const res = await api.get(`${endpoint}/export/${fmt}`, {
        params: { date_from: range.date_from, date_to: range.date_to, product_id: productId },
        responseType: 'blob',
      })
      downloadBlob(res, `${prefix}_${range.date_from}_${range.date_to}.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch {
      toast({ variant: 'destructive', description: 'Error al exportar' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <DateRangeFilter onApply={setRange} />
        <div className="space-y-1">
          <span className="text-xs font-medium">Producto (opcional)</span>
          <Select value={productId ? String(productId) : '__all__'} onValueChange={(v) => setProductId(v === '__all__' ? undefined : Number(v))}>
            <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los productos</SelectItem>
              {(products ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
          <Download className="mr-1.5 h-3.5 w-3.5" />PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
          <Download className="mr-1.5 h-3.5 w-3.5" />Excel
        </Button>
      </div>
    </div>
  )
}

// ─── Stock report ─────────────────────────────────────────────────────────────
function StockReport() {
  const { toast } = useToast()
  const { user } = useAuth()
  const canViewStockReports = user?.role === 'admin' || user?.role === 'supervisor'
  const [bajoStock, setBajoStock] = useState(false)
  const { data: products, isLoading, isError, refetch } = useStockReport(
    { bajo_stock: bajoStock || undefined },
    { enabled: canViewStockReports },
  )

  if (!canViewStockReports) {
    return (
      <EmptyState
        className="py-10"
        heading="Sin acceso"
        description="Este reporte está disponible solo para administradores y supervisores."
      />
    )
  }

  const handleExport = async (fmt: 'pdf' | 'excel') => {
    try {
      const res = await api.get(`/reports/stock/export/${fmt}`, { params: { bajo_stock: bajoStock || undefined }, responseType: 'blob' })
      downloadBlob(res, `stock.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch {
      toast({ variant: 'destructive', description: 'Error al exportar' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={bajoStock} onChange={(e) => setBajoStock(e.target.checked)} />
          Solo bajo stock
        </label>
        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="mr-1.5 h-3.5 w-3.5" />Excel</Button>
      </div>
      {isLoading ? <Skeleton className="h-48" /> : isError ? (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el reporte de stock."
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Stock actual</TableHead>
                <TableHead className="text-right">Stock mínimo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(products ?? []).length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0">
                      <EmptyState
                        className="py-10"
                        heading="Sin resultados"
                        description="No hay productos para los filtros aplicados."
                      />
                    </TableCell>
                  </TableRow>
                  )
                : (products ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className={`text-right ${p.bajo_stock ? 'text-destructive font-medium' : ''}`}>{p.stock_actual}</TableCell>
                    <TableCell className="text-right">{p.stock_minimo}</TableCell>
                    <TableCell><Badge variant={p.bajo_stock ? 'destructive' : 'default'}>{p.bajo_stock ? 'Bajo stock' : 'Normal'}</Badge></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Stock valorizado ─────────────────────────────────────────────────────────
function StockValorizadoReport() {
  const { toast } = useToast()
  const { user } = useAuth()
  const canViewStockReports = user?.role === 'admin' || user?.role === 'supervisor'
  const { data, isLoading, isError, refetch } = useStockValorizado({}, { enabled: canViewStockReports })

  if (!canViewStockReports) {
    return (
      <EmptyState
        className="py-10"
        heading="Sin acceso"
        description="Este reporte está disponible solo para administradores y supervisores."
      />
    )
  }

  const handleExport = async (fmt: 'pdf' | 'excel') => {
    try {
      const res = await api.get(`/reports/stock-valorizado/export/${fmt}`, { responseType: 'blob' })
      downloadBlob(res, `stock-valorizado.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch {
      toast({ variant: 'destructive', description: 'Error al exportar' })
    }
  }

  if (isLoading) return <Skeleton className="h-48" />
  if (isError) {
    return (
      <ErrorState
        className="py-10"
        message="No se pudo cargar el reporte de stock valorizado."
        onRetry={() => void refetch()}
      />
    )
  }
  if (!data) {
    return (
      <EmptyState
        className="py-10"
        heading="Sin datos disponibles"
        description="No hay informacion de valorizacion para mostrar."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="mr-1.5 h-3.5 w-3.5" />Excel</Button>
      </div>
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Valor total del inventario</p>
          <p className="text-3xl font-bold">{fmtCurrency(data.total_value)}</p>
          <p className="text-xs text-muted-foreground mt-1">Método: {data.method}</p>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Costo unit.</TableHead>
              <TableHead className="text-right">Valor total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    className="py-10"
                    heading="Sin productos valorizados"
                    description="No hay productos con costo para el calculo valorizado."
                  />
                </TableCell>
              </TableRow>
            ) : data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-right">{item.stock}</TableCell>
                <TableCell className="text-right">{fmtCurrency(item.cost)}</TableCell>
                <TableCell className="text-right font-medium">{fmtCurrency(item.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Kardex exportable ────────────────────────────────────────────────────────
function KardexReport() {
  const { toast } = useToast()
  const [productId, setProductId] = useState<number | undefined>()
  const [range, setRange] = useState<DateRange>(currentMonthRange())
  const { data: products } = useProducts({ status: 'active' })

  const handleExport = async (fmt: 'pdf' | 'excel') => {
    if (!productId) { toast({ variant: 'destructive', description: 'Selecciona un producto' }); return }
    try {
      const res = await api.get(`/reports/kardex/export/${fmt}`, {
        params: { product_id: productId, date_from: range.date_from, date_to: range.date_to },
        responseType: 'blob',
      })
      downloadBlob(res, `kardex_${productId}.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch {
      toast({ variant: 'destructive', description: 'Error al exportar' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <span className="text-xs font-medium">Producto</span>
          <Select value={productId ? String(productId) : ''} onValueChange={(v) => setProductId(Number(v))}>
            <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {(products ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter onApply={setRange} defaultValues={range} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="mr-1.5 h-3.5 w-3.5" />Excel</Button>
      </div>
    </div>
  )
}

// ─── Movimientos por usuario ──────────────────────────────────────────────────
function MovimientosPorUsuarioReport() {
  const { toast } = useToast()
  const [range, setRange] = useState<DateRange>(currentMonthRange())

  const handleExport = async (fmt: 'pdf' | 'excel') => {
    try {
      const res = await api.get(`/reports/movimientos-por-usuario/export/${fmt}`, {
        params: { date_from: range.date_from, date_to: range.date_to },
        responseType: 'blob',
      })
      downloadBlob(res, `movimientos_usuario_${range.date_from}_${range.date_to}.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch {
      toast({ variant: 'destructive', description: 'Error al exportar' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3">
        <DateRangeFilter onApply={setRange} defaultValues={range} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="mr-1.5 h-3.5 w-3.5" />Excel</Button>
      </div>
    </div>
  )
}

// ─── Consolidado ──────────────────────────────────────────────────────────────
function ConsolidadoReport() {
  const [range, setRange] = useState<DateRange>(currentMonthRange())
  const { data, isLoading, isError, refetch } = useConsolidado(range)

  const chartData = data
    ? Object.entries(data.movements).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3">
        <DateRangeFilter onApply={setRange} defaultValues={range} />
      </div>
      {isLoading && <Skeleton className="h-48" />}
      {isError && (
        <ErrorState
          className="py-10"
          message="No se pudo cargar el reporte consolidado."
          onRetry={() => void refetch()}
        />
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(data.movements).map(([k, v]) => (
              <Card key={k}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground uppercase">{k}</p>
                  <p className="text-2xl font-bold">{v}</p>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Productos activos</p>
                <p className="text-2xl font-bold">{data.active_products}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Bajo stock</p>
                <p className="text-2xl font-bold text-destructive">{data.products_below_minimum}</p>
              </CardContent>
            </Card>
          </div>
          {chartData.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-sm font-medium">Movimientos por tipo</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  ...DOC_REPORT_TYPES.map((t) => ({ value: t.value, label: t.label })),
  { value: 'stock', label: 'Stock' },
  { value: 'stock-valorizado', label: 'Stock valorizado' },
  { value: 'kardex', label: 'Kardex' },
  { value: 'movimientos-por-usuario', label: 'Por usuario' },
  { value: 'consolidado', label: 'Consolidado' },
]

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Reportes" />
      <Tabs defaultValue="consolidado">
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
        {DOC_REPORT_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <MovementReport endpoint={t.endpoint} prefix={t.prefix} />
          </TabsContent>
        ))}
        <TabsContent value="stock" className="mt-4"><StockReport /></TabsContent>
        <TabsContent value="stock-valorizado" className="mt-4"><StockValorizadoReport /></TabsContent>
        <TabsContent value="kardex" className="mt-4"><KardexReport /></TabsContent>
        <TabsContent value="movimientos-por-usuario" className="mt-4"><MovimientosPorUsuarioReport /></TabsContent>
        <TabsContent value="consolidado" className="mt-4"><ConsolidadoReport /></TabsContent>
      </Tabs>
    </div>
  )
}
