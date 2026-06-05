import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DocumentLinesEditor, type DocumentLine } from '@/features/inventory/DocumentLinesEditor'
import { useCreateIngreso } from '@/features/inventory/hooks'
import { useToast } from '@/hooks/use-toast'

const schema = z.object({
  reference: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function IngresoNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const create = useCreateIngreso()
  const [lines, setLines] = useState<DocumentLine[]>([])

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    if (lines.length === 0) {
      toast({ variant: 'destructive', description: 'Agrega al menos una línea' })
      return
    }
    const invalidLine = lines.find((l) => !l.product_id || !l.quantity || Number(l.quantity) <= 0)
    if (invalidLine) {
      toast({ variant: 'destructive', description: 'Completa todos los campos de las líneas' })
      return
    }
    try {
      const doc = await create.mutateAsync({
        reference: data.reference || undefined,
        notes: data.notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_cost: l.unit_cost || undefined,
        })),
      })
      toast({ title: `Ingreso ${doc.number} creado` })
      navigate(`/inventory/ingresos/${doc.id}`)
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
      if (code === 'PRODUCT_NOT_FOUND') toast({ variant: 'destructive', description: 'Uno de los productos no fue encontrado' })
      else toast({ variant: 'destructive', description: 'Error al crear el ingreso' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Nuevo Ingreso</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Referencia</Label>
            <Input {...register('reference')} placeholder="Ej: Factura 001" />
          </div>
          <div className="space-y-1">
            <Label>Notas</Label>
            <Input {...register('notes')} placeholder="Observaciones (opcional)" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-medium">Líneas del documento</h2>
          <DocumentLinesEditor lines={lines} onChange={setLines} showUnitCost />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>Guardar ingreso</Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}
