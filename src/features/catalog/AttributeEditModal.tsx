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
import type { CategoryAttribute, AttributeDataType } from '@/types/api'

const DATA_TYPES: AttributeDataType[] = ['text', 'integer', 'decimal', 'date', 'boolean', 'select']

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  data_type: z.enum(['text', 'integer', 'decimal', 'date', 'boolean', 'select']),
  is_required: z.boolean(),
  select_options_raw: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  categoryId: number
  attribute: CategoryAttribute
  onClose: () => void
}

export function AttributeEditModal({ categoryId, attribute, onClose }: Props) {
  const update = useUpdateAttribute()
  const { toast } = useToast()
  const [typeWarning, setTypeWarning] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: attribute.name,
      data_type: attribute.data_type,
      is_required: attribute.is_required,
      select_options_raw: (attribute.select_options ?? []).join(', '),
    },
  })

  const dataType = watch('data_type')

  const handleTypeChange = (v: string) => {
    if (v !== attribute.data_type) setTypeWarning(true)
    else setTypeWarning(false)
    setValue('data_type', v as AttributeDataType)
  }

  const onSubmit = async (data: FormData) => {
    setFormError(null)
    try {
      const payload = {
        name: data.name,
        data_type: data.data_type,
        is_required: data.is_required,
        select_options: data.data_type === 'select'
          ? (data.select_options_raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
      }
      await update.mutateAsync({ categoryId, attrId: attribute.id, payload })
      toast({ variant: 'success', title: 'Atributo actualizado', description: `"${data.name}" actualizado.` })
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
                  {DATA_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {typeWarning && (
                <Alert variant="warning">
                  <AlertDescription>
                    Si existen productos con este atributo, el cambio de tipo será bloqueado.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {dataType === 'select' && (
              <FormField label="Opciones (separadas por coma)" error={errors.select_options_raw?.message}>
                <Input {...register('select_options_raw')} placeholder="rojo, verde, azul" />
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
