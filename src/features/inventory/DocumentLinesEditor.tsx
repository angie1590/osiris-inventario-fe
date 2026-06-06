import { useState } from 'react'
import { Search, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProducts } from '@/features/catalog/hooks'
import type { Product } from '@/types/api'

export interface DocumentLine {
  product_id: number
  product_name: string
  quantity: string
  unit_cost?: string
  unit_price?: string
}

interface Props {
  lines: DocumentLine[]
  onChange: (lines: DocumentLine[]) => void
  showUnitCost?: boolean
  showUnitPrice?: boolean
}

function ProductCombobox({ onChange }: { value: number | null; onChange: (p: Product) => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const { data: products } = useProducts({ name: search || undefined, status: 'active' })

  return (
    <div className="relative">
      <div className="flex items-center gap-1 rounded-md border px-2 focus-within:ring-1 focus-within:ring-ring">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && (products ?? []).length > 0 && (
        <div className="absolute mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md" style={{ zIndex: 350 }}>
          {(products ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-accent"
              onMouseDown={() => { onChange(p); setSearch(p.name); setOpen(false) }}
            >
              <span>{p.name}</span>
              <span className="text-xs text-muted-foreground">Stock: {p.stock_actual}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DocumentLinesEditor({ lines, onChange, showUnitCost = false, showUnitPrice = false }: Props) {
  const addLine = () => {
    onChange([...lines, { product_id: 0, product_name: '', quantity: '1', unit_cost: '', unit_price: '' }])
  }

  const removeLine = (i: number) => {
    onChange(lines.filter((_, idx) => idx !== i))
  }

  const updateLine = (i: number, partial: Partial<DocumentLine>) => {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...partial } : l)))
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Producto</TableHead>
              <TableHead className="w-24">Cantidad</TableHead>
              {showUnitCost && <TableHead className="w-28">Costo unit.</TableHead>}
              {showUnitPrice && <TableHead className="w-28">Precio unit.</TableHead>}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={showUnitCost || showUnitPrice ? 4 : 3} className="text-center text-sm text-muted-foreground py-4">
                  Sin líneas. Haz clic en "Agregar línea".
                </TableCell>
              </TableRow>
            )}
            {lines.map((line, i) => (
              <TableRow key={i}>
                <TableCell>
                  <ProductCombobox
                    value={line.product_id || null}
                    onChange={(p) => updateLine(i, { product_id: p.id, product_name: p.name })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    className="h-8 w-24"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  />
                </TableCell>
                {showUnitCost && (
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-28"
                      placeholder="0.00"
                      value={line.unit_cost ?? ''}
                      onChange={(e) => updateLine(i, { unit_cost: e.target.value })}
                    />
                  </TableCell>
                )}
                {showUnitPrice && (
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-28"
                      placeholder="0.00"
                      value={line.unit_price ?? ''}
                      onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />Agregar línea
      </Button>
    </div>
  )
}
