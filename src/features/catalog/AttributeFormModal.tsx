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
import type { AttributeDataType } from '@/types/api'

const DATA_TYPES: AttributeDataType[] = ['text', 'integer', 'decimal', 'date', 'boolean', 'select']

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  data_type: z.enum(['text', 'integer', 'decimal', 'date', 'boolean', 'select']),
  is_required: z.boolean(),
  select_options_raw: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function AttributeFormModal({ categoryId, onClose }: { categoryId: number; onClose: () => void }) {
  const create = useCreateAttribute()
  const { toast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { data_type: 'text', is_required: false },
  })

  const dataType = watch('data_type')

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
                  {DATA_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {dataType === 'select' && (
              <FormField label="Opciones (separadas por coma)">
                <Input {...register('select_options_raw')} placeholder="rojo, verde, azul" />
              </FormField>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="is_required" onCheckedChange={(v) => setValue('is_required', !!v)} />
              <Label htmlFor="is_required">Requerido</Label>
            </div>
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
