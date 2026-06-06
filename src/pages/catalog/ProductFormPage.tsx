import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/shared/FormField'
import { PageHeader } from '@/components/shared/PageHeader'
import { Section } from '@/components/shared/Section'
import { TreeSelector } from '@/components/shared/TreeSelector'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  useProduct, useCreateProduct, useUpdateProduct,
  useCategories, useCategoryAttributes,
} from '@/features/catalog/hooks'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'
import type { CategoryAttribute } from '@/types/api'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  category_id: z.number({ error: 'Requerido' }).min(1, 'Requerido'),
  stock_minimo: z.string().optional(),
  pvp: z.string().min(1, 'Requerido'),
})
type FormData = z.infer<typeof schema>

type ApiError = {
  response?: {
    data?: {
      code?: string
      message?: string
      errors?: Record<string, string>
    }
  }
}

function AttributeField({ attr, value, onChange }: { attr: CategoryAttribute; value: unknown; onChange: (v: unknown) => void }) {
  switch (attr.data_type) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={onChange} id={`attr-${attr.id}`} />
          <label htmlFor={`attr-${attr.id}`} className="text-sm cursor-pointer">
            {attr.name}{attr.is_required && <span className="ml-0.5 text-destructive">*</span>}
          </label>
        </div>
      )
    case 'select':
      return (
        <FormField label={attr.name} required={attr.is_required}>
          <Select value={String(value ?? '')} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder={`Seleccionar ${attr.name}`} /></SelectTrigger>
            <SelectContent>
              {(attr.select_options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
      )
    default:
      return (
        <FormField label={attr.name} required={attr.is_required}>
          <Input
            type={attr.data_type === 'integer' || attr.data_type === 'decimal' ? 'number' : attr.data_type === 'date' ? 'date' : 'text'}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        </FormField>
      )
  }
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isEdit = !!id

  const { data: product, isLoading: productLoading } = useProduct(id ? Number(id) : 0)
  const { data: categories } = useCategories()
  const create = useCreateProduct()
  const update = useUpdateProduct()

  const [formError, setFormError] = useState<string | null>(null)
  const [customAttrs, setCustomAttrs] = useState<Record<string, unknown>>({})

  const { register, handleSubmit, watch, control, formState: { errors, isSubmitting }, setError, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description ?? '',
        category_id: product.category_id,
        stock_minimo: String(product.stock_minimo),
        pvp: String(product.pvp),
      })
      setCustomAttrs({ ...(product.custom_attributes ?? {}) })
    }
  }, [product, reset])

  const categoryId = watch('category_id')
  const { data: attrs, isLoading: attrsLoading } = useCategoryAttributes(categoryId ?? 0)

  useEffect(() => {
    if (!isEdit) setCustomAttrs({})
  }, [categoryId, isEdit])

  const onSubmit = async (data: FormData) => {
    setFormError(null)
    const payload = {
      name: data.name,
      description: data.description || undefined,
      category_id: data.category_id,
      stock_minimo: Number(data.stock_minimo ?? 0),
      pvp: data.pvp,
      custom_attributes: customAttrs,
    }

    try {
      if (isEdit) {
        await update.mutateAsync({ id: product!.id, payload })
        toast({ title: 'Producto actualizado' })
        navigate(`/products/${product!.id}`)
      } else {
        const created = await create.mutateAsync(payload)
        toast({ title: 'Producto creado' })
        navigate(`/products/${created.id}`)
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError
      const fieldErrors = apiErr?.response?.data?.errors
      const msg = apiErr?.response?.data?.message ?? 'Error al guardar el producto'
      const code = apiErr?.response?.data?.code

      if (fieldErrors) {
        const knownFields: (keyof FormData)[] = ['name', 'category_id', 'stock_minimo', 'pvp']
        knownFields.forEach((field) => {
          if (fieldErrors[field]) setError(field, { message: fieldErrors[field] })
        })
        if (fieldErrors['stock_minimo']) setError('stock_minimo', { message: fieldErrors['stock_minimo'] })
      }

      if (code === 'INVALID_QUANTITY') {
        setError('stock_minimo', { message: msg })
      }

      setFormError(msg)
    }
  }

  if (isEdit && productLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={isEdit ? 'Editar producto' : 'Nuevo producto'}
        actions={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Section title="Información general">
          <FormField label="Nombre" required error={errors.name?.message}>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Descripción" error={errors.description?.message}>
            <Input {...register('description')} />
          </FormField>
        </Section>

        <Section title="Clasificación">
          <FormField label="Categoría" required error={errors.category_id?.message}>
            <Controller control={control} name="category_id" render={({ field }) => (
              <TreeSelector
                categories={categories ?? []}
                value={field.value as number | null}
                onChange={field.onChange}
              />
            )} />
          </FormField>
        </Section>

        <Section title="Inventario">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Stock mínimo" required error={errors.stock_minimo?.message}>
              <Input type="number" step="0.0001" {...register('stock_minimo')} />
            </FormField>
            {isEdit && (
              <FormField label="Stock actual" hint="Solo lectura — se actualiza via movimientos">
                <Input value={product?.stock_actual ?? 0} disabled className="bg-muted" />
              </FormField>
            )}
          </div>
        </Section>

        <Section title="Precio">
          <FormField label="PVP" required error={errors.pvp?.message}>
            <Input type="number" step="0.01" className="max-w-48" {...register('pvp')} />
          </FormField>
        </Section>

        {categoryId > 0 && (
          <Section title="Atributos personalizados">
            {attrsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : (attrs ?? []).length === 0 ? (
              <EmptyState heading="Esta categoría no tiene atributos definidos" className="py-6" />
            ) : (
              (attrs ?? []).map((attr) => (
                <AttributeField
                  key={attr.id}
                  attr={attr}
                  value={customAttrs[attr.name]}
                  onChange={(v) => setCustomAttrs((prev) => ({ ...prev, [attr.name]: v }))}
                />
              ))
            )}
          </Section>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Actualizar' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </div>
  )
}
