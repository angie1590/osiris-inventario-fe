import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateCategory, useUpdateCategory } from './hooks'
import type { Category } from '@/types/api'
import { useToast } from '@/hooks/use-toast'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  parent_id: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  category?: Category
  allCategories: Category[]
  onClose: () => void
}

export function CategoryFormModal({ category, allCategories, onClose }: Props) {
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const { toast } = useToast()
  const isEdit = !!category

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      parent_id: category?.parent_id ? String(category.parent_id) : undefined,
    },
  })

  const parentId = watch('parent_id')

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        name: data.name,
        description: data.description,
        parent_id: data.parent_id ? Number(data.parent_id) : null,
      }
      if (isEdit) {
        await update.mutateAsync({ id: category!.id, payload })
        toast({ title: 'Categoría actualizada' })
      } else {
        await create.mutateAsync(payload)
        toast({ title: 'Categoría creada' })
      }
      onClose()
    } catch {
      toast({ variant: 'destructive', description: 'Error al guardar la categoría' })
    }
  }

  const availableParents = allCategories.filter((c) => c.is_active && c.id !== category?.id)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Descripción (opcional)</Label>
            <Input {...register('description')} />
          </div>
          <div className="space-y-1">
            <Label>Categoría padre (opcional)</Label>
            <Select value={parentId ?? '__none__'} onValueChange={(v) => setValue('parent_id', v === '__none__' ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Sin padre (raíz)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin padre (raíz)</SelectItem>
                {availableParents.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isEdit ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
