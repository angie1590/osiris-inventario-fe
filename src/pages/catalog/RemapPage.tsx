import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { usePendingRemap, useResolveRemap, type RemapGroup } from '@/features/catalog/remapHooks'
import { useCatalogValues } from '@/features/catalog/catalogHooks'
import { DATA_TYPE_LABELS } from '@/features/catalog/AttributeFormModal'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api-error'

function RemapInput({ group, value, onChange }: { group: RemapGroup; value: string | undefined; onChange: (v: string) => void }) {
  const { target_type, allowed_values } = group
  // Catalog values are read live so newly-added values appear immediately.
  const { data: catalogValues } = useCatalogValues(
    target_type === 'catalog' ? group.catalog_id : null,
    false,
  )

  if (target_type === 'boolean') {
    return (
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Sí / No" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Sí</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (target_type === 'select' || target_type === 'catalog') {
    const options = target_type === 'catalog'
      ? (catalogValues ?? []).filter((v) => v.is_active).map((v) => v.value)
      : (allowed_values ?? [])
    return (
      <SearchableSelect value={value ?? null} onChange={onChange} options={options} placeholder="Elegir valor…" />
    )
  }
  return (
    <Input
      type={target_type === 'integer' || target_type === 'decimal' ? 'number' : target_type === 'date' ? 'date' : 'text'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Nuevo valor"
    />
  )
}

export default function RemapPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data, isLoading } = usePendingRemap()
  const resolve = useResolveRemap()
  // itemId -> string value (undefined = untouched)
  const [values, setValues] = useState<Record<number, string>>({})

  const touched = Object.keys(values).length

  const handleSubmit = async () => {
    const assignments = Object.entries(values).map(([id, raw]) => {
      const v = raw === '' ? null : raw === 'true' ? true : raw === 'false' ? false : raw
      return { id: Number(id), value: v }
    })
    if (assignments.length === 0) {
      toast({ variant: 'warning', title: 'Nada que guardar', description: 'Asigna un valor a al menos un producto.' })
      return
    }
    try {
      const res = await resolve.mutateAsync(assignments)
      toast({ variant: 'success', title: 'Valores actualizados', description: `${res.resolved} valor(es) remapeado(s).` })
      setValues({})
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Error al remapear', description: getApiErrorMessage(err, 'No se pudo remapear. Revisa los valores requeridos.') })
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  const groups = data?.groups ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Remapear valores de atributos"
        actions={groups.length > 0 && (
          <Button onClick={handleSubmit} isLoading={resolve.isPending} disabled={touched === 0}>
            Guardar ({touched})
          </Button>
        )}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10 text-success" />}
          heading="No hay valores pendientes"
          description="Todos los valores de atributos son compatibles con su tipo."
          action={{ label: 'Ir a categorías', onClick: () => navigate('/categories') }}
        />
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/80 bg-amber-100/95 px-4 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Al cambiar el tipo de estos atributos, algunos valores no se pudieron convertir automáticamente.
              Define el nuevo valor de cada producto. Los atributos no requeridos pueden dejarse vacíos.
            </span>
          </div>

          {groups.map((g) => (
            <div key={g.attribute_id} className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
                <span className="font-medium">{g.attribute_name}</span>
                <Badge variant="outline">{DATA_TYPE_LABELS[g.target_type]}</Badge>
                {g.is_required && <Badge variant="secondary">Requerido</Badge>}
                <span className="text-muted-foreground">— {g.items.length} producto(s)</span>
              </div>
              <div className="divide-y">
                {g.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">Valor anterior: {it.old_value || '—'}</p>
                    </div>
                    <div className="w-64">
                      <RemapInput group={g} value={values[it.id]} onChange={(v) => setValues((prev) => ({ ...prev, [it.id]: v }))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
