import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/shared/FormField'
import { DocumentLinesEditor, type DocumentLine } from '@/features/inventory/DocumentLinesEditor'
import { useCreateEgreso } from '@/features/inventory/hooks'
import { useToast } from '@/hooks/use-toast'

const schema = z.object({
  reference: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function EgresoNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const create = useCreateEgreso()
  const [lines, setLines] = useState<DocumentLine[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setFormError(null)
    if (lines.length === 0) {
      setFormError('Agrega al menos una línea al documento')
      return
    }
    const invalidLine = lines.find((l) => !l.product_id || !l.quantity || Number(l.quantity) <= 0)
    if (invalidLine) {
      setFormError('Completa todos los campos de las líneas')
      return
    }
    try {
      const doc = await create.mutateAsync({
        reference: data.reference || undefined,
        notes: data.notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price || undefined,
        })),
      })
      toast({ title: `Egreso ${doc.number} creado` })
      navigate(`/inventory/egresos/${doc.id}`)
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { code?: string; message?: string } } }
      const code = apiErr?.response?.data?.code
      const msg = apiErr?.response?.data?.message
      if (code === 'INSUFFICIENT_STOCK') setFormError('Stock insuficiente en uno de los productos')
      else if (code === 'PRODUCT_NOT_FOUND') setFormError('Uno de los productos no fue encontrado')
      else setFormError(msg ?? 'Error al crear el egreso')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Nuevo Egreso</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {formError && (
          <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>
        )}
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <FormField label="Referencia">
            <Input {...register('reference')} placeholder="Ej: Orden de despacho 001" />
          </FormField>
          <FormField label="Notas">
            <Input {...register('notes')} placeholder="Observaciones (opcional)" />
          </FormField>
        </div>

        <div className="space-y-2">
          <h2 className="font-medium">Líneas del documento</h2>
          <DocumentLinesEditor lines={lines} onChange={setLines} showUnitPrice />
        </div>

        <div className="flex gap-2">
          <Button type="submit" isLoading={isSubmitting}>Guardar egreso</Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}
