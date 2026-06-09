import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/shared/FormField'
import { useCreateAttribute } from './hooks'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { useCatalogs } from './catalogHooks'
import { pluralizeEs } from './pluralize'
import type { AttributeDataType } from '@/types/api'

const AUTO_CATALOG = '__auto__'

const DATA_TYPES: AttributeDataType[] = ['text', 'integer', 'decimal', 'date', 'boolean', 'select', 'catalog']
export const DATA_TYPE_LABELS: Record<AttributeDataType, string> = {
  text: 'Texto', integer: 'Entero', decimal: 'Decimal', date: 'Fecha',
  boolean: 'Sí / No', select: 'Lista (opciones fijas)', catalog: 'Catálogo (lista maestra)',
}

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  data_type: z.enum(['text', 'integer', 'decimal', 'date', 'boolean', 'select', 'catalog']),
  is_required: z.boolean(),
  select_options_raw: z.string().optional(),
  catalog_id: z.number().optional(),
  allow_negative: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>

export function AttributeFormModal({ categoryId, onClose }: { categoryId: number; onClose: () => void }) {
  const create = useCreateAttribute()
  const { toast } = useToast()
  const { data: catalogs } = useCatalogs()
  const [formError, setFormError] = useState<string | null>(null)
  // '__auto__' = let the backend auto-create/reuse a catalog named after the attribute.
  const [catalogChoice, setCatalogChoice] = useState<string>(AUTO_CATALOG)

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { data_type: 'text', is_required: false, allow_negative: false },
  })

  const dataType = watch('data_type')
  const isNumeric = dataType === 'integer' || dataType === 'decimal'

  const onSubmit = async (data: FormData) => {
    setFormError(null)
    // catalog: '__auto__' → send no catalog_id (backend auto-creates the plural); otherwise the chosen id.
    const catalogId = data.data_type === 'catalog' && catalogChoice !== AUTO_CATALOG ? Number(catalogChoice) : undefined
    try {
      const payload = {
        name: data.name,
        data_type: data.data_type,
        is_required: data.is_required,
        select_options: data.data_type === 'select'
          ? (data.select_options_raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        catalog_id: catalogId,
        allow_negative: isNumeric ? !!data.allow_negative : false,
      }
      await create.mutateAsync({ categoryId, payload })
      toast({ variant: 'success', title: 'Atributo creado', description: `"${data.name}" creado.` })
      onClose()
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err, 'No se pudo crear el atributo. Intenta nuevamente.', {
        SELECT_REQUIRES_OPTIONS: 'Un atributo de tipo "select" debe tener al menos una opción.',
      }))
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogHeader><DialogTitle>Nuevo atributo</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            {formError && (
              <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>
            )}
            <FormField label="Nombre" required error={errors.name?.message}>
              <Input {...register('name')} />
            </FormField>
            <div className="space-y-1.5">
              <Label>Tipo de dato</Label>
              <Select defaultValue="text" onValueChange={(v) => setValue('data_type', v as AttributeDataType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((t) => <SelectItem key={t} value={t}>{DATA_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {dataType === 'select' && (
              <FormField label="Opciones (separadas por coma)">
                <Input {...register('select_options_raw')} placeholder="rojo, verde, azul" />
              </FormField>
            )}
            {dataType === 'catalog' && (
              <FormField label="Catálogo" hint="Se crea automáticamente (en plural) según el nombre del atributo, o puedes reutilizar uno existente.">
                <Select value={catalogChoice} onValueChange={setCatalogChoice}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_CATALOG}>
                      ➕ Crear automáticamente{watch('name') ? ` «${pluralizeEs(watch('name') || '')}»` : ''}
                    </SelectItem>
                    {(catalogs ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="is_required" onCheckedChange={(v) => setValue('is_required', !!v)} />
              <Label htmlFor="is_required">Requerido</Label>
            </div>
            {isNumeric && (
              <div className="flex items-center gap-2">
                <Checkbox id="allow_negative" checked={!!watch('allow_negative')} onCheckedChange={(v) => setValue('allow_negative', !!v)} />
                <Label htmlFor="allow_negative">Permite valores negativos</Label>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" isLoading={isSubmitting}>Crear</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
