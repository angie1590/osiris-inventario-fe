import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useCreateAttribute } from './hooks'
import { useToast } from '@/hooks/use-toast'
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

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { data_type: 'text', is_required: false },
  })

  const dataType = watch('data_type')

  const onSubmit = async (data: FormData) => {
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
      toast({ title: 'Atributo creado' })
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
      const msg = code === 'ATTRIBUTE_NAME_EXISTS_IN_HIERARCHY'
        ? 'Ya existe un atributo con ese nombre en la jerarquía'
        : 'Error al crear el atributo'
      toast({ variant: 'destructive', description: msg })
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo atributo</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Tipo de dato</Label>
            <Select defaultValue="text" onValueChange={(v) => setValue('data_type', v as AttributeDataType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {dataType === 'select' && (
            <div className="space-y-1">
              <Label>Opciones (separadas por coma)</Label>
              <Input {...register('select_options_raw')} placeholder="rojo, verde, azul" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="is_required" onCheckedChange={(v) => setValue('is_required', !!v)} />
            <Label htmlFor="is_required">Requerido</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>Crear</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
