import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useCreateProduct, useUpdateProduct, useCategoryAttributes } from './hooks'
import type { Category, Product, CategoryAttribute } from '@/types/api'
import { useToast } from '@/hooks/use-toast'

const baseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category_id: z.string().min(1, 'Requerido'),
  stock_minimo: z.string().optional(),
  pvp: z.string().min(1, 'Requerido'),
})

interface Props {
  product?: Product
  categories: Category[]
  onClose: () => void
}

function AttributeField({ attr, value, onChange }: { attr: CategoryAttribute; value: unknown; onChange: (v: unknown) => void }) {
  switch (attr.data_type) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={onChange} />
          <Label>{attr.name}{attr.is_required && ' *'}</Label>
        </div>
      )
    case 'select':
      return (
        <div className="space-y-1">
          <Label>{attr.name}{attr.is_required && ' *'}</Label>
          <Select value={String(value ?? '')} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder={`Seleccionar ${attr.name}`} /></SelectTrigger>
            <SelectContent>
              {(attr.select_options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )
    default:
      return (
        <div className="space-y-1">
          <Label>{attr.name}{attr.is_required && ' *'}</Label>
          <Input
            type={attr.data_type === 'integer' || attr.data_type === 'decimal' ? 'number' : attr.data_type === 'date' ? 'date' : 'text'}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )
  }
}

export function ProductFormModal({ product, categories, onClose }: Props) {
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const { toast } = useToast()
  const isEdit = !!product

  const { register, handleSubmit, watch, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      category_id: product?.category_id ? String(product.category_id) : '',
      stock_minimo: product?.stock_minimo ? String(product.stock_minimo) : '0',
      pvp: product?.pvp ? String(product.pvp) : '',
    },
  })

  const categoryId = watch('category_id')
  const { data: attrs } = useCategoryAttributes(categoryId ? Number(categoryId) : 0)
  const customAttrs: Record<string, unknown> = { ...(product?.custom_attributes ?? {}) }

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      const payload = {
        name: data.name as string,
        description: data.description as string | undefined,
        category_id: Number(data.category_id),
        stock_minimo: Number(data.stock_minimo ?? 0),
        pvp: data.pvp as string,
        custom_attributes: customAttrs,
      }
      if (isEdit) {
        await update.mutateAsync({ id: product!.id, payload })
        toast({ title: 'Producto actualizado' })
      } else {
        await create.mutateAsync(payload)
        toast({ title: 'Producto creado' })
      }
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
      toast({ variant: 'destructive', description: code === 'MISSING_REQUIRED_ATTRIBUTE' ? 'Hay atributos requeridos sin completar' : 'Error al guardar' })
    }
  }

  useEffect(() => {
    // reset custom attrs when category changes
    Object.keys(customAttrs).forEach((k) => { delete customAttrs[k] })
  }, [categoryId])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar producto' : 'Nuevo producto'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{String(errors.name.message)}</p>}
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Input {...register('description')} />
          </div>
          <div className="space-y-1">
            <Label>Categoría</Label>
            <Controller control={control} name="category_id" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
            {errors.category_id && <p className="text-xs text-destructive">{String(errors.category_id.message)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Stock mínimo</Label>
              <Input type="number" step="0.0001" {...register('stock_minimo')} />
            </div>
            <div className="space-y-1">
              <Label>PVP</Label>
              <Input type="number" step="0.01" {...register('pvp')} />
              {errors.pvp && <p className="text-xs text-destructive">{String(errors.pvp.message)}</p>}
            </div>
          </div>

          {isEdit && (
            <div className="space-y-1">
              <Label>Stock actual (solo lectura)</Label>
              <Input value={product?.stock_actual ?? 0} disabled className="bg-muted" />
            </div>
          )}

          {(attrs ?? []).length > 0 && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium text-muted-foreground">Atributos personalizados</p>
              {(attrs ?? []).map((attr) => (
                <AttributeField
                  key={attr.id}
                  attr={attr}
                  value={customAttrs[attr.name]}
                  onChange={(v) => { customAttrs[attr.name] = v }}
                />
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isEdit ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
