import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/shared/FormField'
import { useUpdateAttribute } from './hooks'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { useCatalogs } from './catalogHooks'
import { pluralizeEs } from './pluralize'
import { DATA_TYPE_LABELS } from './AttributeFormModal'
import type { CategoryAttribute, AttributeDataType } from '@/types/api'

const DATA_TYPES: AttributeDataType[] = ['text', 'integer', 'decimal', 'date', 'boolean', 'select', 'catalog']

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  data_type: z.enum(['text', 'integer', 'decimal', 'date', 'boolean', 'select', 'catalog']),
  is_required: z.boolean(),
  select_options_raw: z.string().optional(),
  catalog_id: z.number().optional(),
  allow_negative: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  categoryId: number
  attribute: CategoryAttribute
  onClose: () => void
}

const AUTO_CATALOG = '__auto__'

export function AttributeEditModal({ categoryId, attribute, onClose }: Props) {
  const update = useUpdateAttribute()
  const { toast } = useToast()
  const { data: catalogs } = useCatalogs()
  const [typeWarning, setTypeWarning] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [catalogChoice, setCatalogChoice] = useState<string>(
    attribute.catalog_id ? String(attribute.catalog_id) : AUTO_CATALOG,
  )

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: attribute.name,
      data_type: attribute.data_type,
      is_required: attribute.is_required,
      select_options_raw: (attribute.select_options ?? []).join(', '),
      catalog_id: attribute.catalog_id ?? undefined,
      allow_negative: attribute.allow_negative ?? false,
    },
  })

  const dataType = watch('data_type')
  const isNumeric = dataType === 'integer' || dataType === 'decimal'

  const handleTypeChange = (v: string) => {
    if (v !== attribute.data_type) setTypeWarning(true)
    else setTypeWarning(false)
    setValue('data_type', v as AttributeDataType)
  }

  const onSubmit = async (data: FormData) => {
    setFormError(null)
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
      const result = await update.mutateAsync({ categoryId, attrId: attribute.id, payload })
      const pending = (result as { remap_pending?: number }).remap_pending ?? 0
      toast({
        variant: 'success',
        title: 'Atributo actualizado',
        description: pending > 0
          ? `"${data.name}" actualizado. ${pending} valor(es) requieren remapeo (ver la alerta).`
          : `"${data.name}" actualizado.`,
      })
      onClose()
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err, 'No se pudo actualizar el atributo. Intenta nuevamente.', {
        ATTRIBUTE_TYPE_CHANGE_BLOCKED: 'No se puede cambiar el tipo: hay productos con este atributo.',
        SELECT_REQUIRES_OPTIONS: 'Un atributo de tipo "select" debe tener al menos una opción.',
      }))
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogHeader><DialogTitle>Editar atributo</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            {formError && (
              <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>
            )}
            <FormField label="Nombre" required error={errors.name?.message}>
              <Input {...register('name')} />
            </FormField>

            <div className="space-y-1.5">
              <Label>Tipo de dato</Label>
              <Select value={dataType} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((t) => <SelectItem key={t} value={t}>{DATA_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              {typeWarning && (
                <Alert variant="warning">
                  <AlertDescription>
                    Los valores existentes se convertirán automáticamente cuando sea posible.
                    Los que no se puedan convertir quedarán pendientes para remapear (no se
                    pierden productos). De lista a catálogo, se creará el catálogo con las opciones.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {dataType === 'select' && (
              <FormField label="Opciones (separadas por coma)" error={errors.select_options_raw?.message}>
                <Input {...register('select_options_raw')} placeholder="rojo, verde, azul" />
              </FormField>
            )}
            {dataType === 'catalog' && (
              <FormField label="Catálogo" hint="Se crea automáticamente (en plural) según el nombre, o reutiliza uno existente.">
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
              <Checkbox
                id="is_required_edit"
                checked={watch('is_required')}
                onCheckedChange={(v) => setValue('is_required', !!v)}
              />
              <Label htmlFor="is_required_edit">Requerido</Label>
            </div>
            {isNumeric && (
              <div className="flex items-center gap-2">
                <Checkbox id="allow_negative_edit" checked={!!watch('allow_negative')} onCheckedChange={(v) => setValue('allow_negative', !!v)} />
                <Label htmlFor="allow_negative_edit">Permite valores negativos</Label>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" isLoading={isSubmitting}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
