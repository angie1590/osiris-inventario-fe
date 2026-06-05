import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKardex } from '@/features/kardex/hooks'
import { useProducts } from '@/features/catalog/hooks'
import type { KardexEntryType } from '@/types/api'

const ENTRY_TYPE_LABELS: Record<KardexEntryType, string> = {
  IN: 'Ingreso',
  OUT: 'Egreso',
  ADJUST: 'Ajuste',
}
const ENTRY_TYPE_VARIANTS: Record<KardexEntryType, 'default' | 'secondary' | 'destructive'> = {
  IN: 'default',
  OUT: 'destructive',
  ADJUST: 'secondary',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-EC', { minimumFractionDigits: 4 }).format(n)
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n)
}

export default function KardexPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(productId ? Number(productId) : 0)

  const { data: products } = useProducts({ status: 'active' })
  const { data: kardex, isLoading } = useKardex(
    selectedProductId,
    dateFrom || undefined,
    dateTo || undefined,
  )

  const handleProductChange = (id: string) => {
    const numId = Number(id)
    setSelectedProductId(numId)
    navigate(`/kardex/${numId}`, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Kardex</h1>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1 flex-1 min-w-48">
          <Label className="text-xs">Producto</Label>
          <Select value={selectedProductId ? String(selectedProductId) : ''} onValueChange={handleProductChange}>
            <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
            <SelectContent>
              {(products ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" className="h-9 w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" className="h-9 w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {!selectedProductId && (
        <p className="text-center text-muted-foreground py-8">Selecciona un producto para ver su Kardex</p>
      )}

      {selectedProductId && isLoading && <Skeleton className="h-64 w-full" />}

      {kardex && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Saldo final (cantidad)</p>
                <p className="text-2xl font-bold">{fmt(kardex.closing_balance_quantity)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Saldo final (valor)</p>
                <p className="text-2xl font-bold">{fmtCurrency(kardex.closing_balance_value)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Costo promedio ponderado</p>
                <p className="text-2xl font-bold">{fmtCurrency(kardex.weighted_avg_cost)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cant. entrada</TableHead>
                  <TableHead className="text-right">Costo entrada</TableHead>
                  <TableHead className="text-right">Cant. salida</TableHead>
                  <TableHead className="text-right">Costo salida</TableHead>
                  <TableHead className="text-right">Saldo cant.</TableHead>
                  <TableHead className="text-right">Saldo valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kardex.opening_balance_quantity > 0 && (
                  <TableRow className="bg-muted/30 italic">
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell><Badge variant="secondary">Saldo inicial</Badge></TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right font-medium">{fmt(kardex.opening_balance_quantity)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtCurrency(kardex.opening_balance_value)}</TableCell>
                  </TableRow>
                )}
                {kardex.entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">Sin movimientos en el período</TableCell>
                  </TableRow>
                )}
                {kardex.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm text-muted-foreground">{new Date(e.created_at).toLocaleDateString('es-EC')}</TableCell>
                    <TableCell><Badge variant={ENTRY_TYPE_VARIANTS[e.entry_type]}>{ENTRY_TYPE_LABELS[e.entry_type]}</Badge></TableCell>
                    <TableCell className="text-right">{e.quantity_in > 0 ? fmt(e.quantity_in) : '—'}</TableCell>
                    <TableCell className="text-right">{e.cost_in > 0 ? fmtCurrency(e.cost_in) : '—'}</TableCell>
                    <TableCell className="text-right">{e.quantity_out > 0 ? fmt(e.quantity_out) : '—'}</TableCell>
                    <TableCell className="text-right">{e.cost_out > 0 ? fmtCurrency(e.cost_out) : '—'}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(e.balance_quantity)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtCurrency(e.balance_value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
