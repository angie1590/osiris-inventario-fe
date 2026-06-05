import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DocumentLinesEditor, type DocumentLine } from '@/features/inventory/DocumentLinesEditor'
import { useCreateAjuste } from '@/features/inventory/hooks'
import { useToast } from '@/hooks/use-toast'
import type { AdjustType } from '@/types/api'

const schema = z.object({
  adjust_type: z.enum(['increment', 'decrement']),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function AjusteNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const create = useCreateAjuste()
  const [lines, setLines] = useState<DocumentLine[]>([])

  const { register, handleSubmit, control, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { adjust_type: 'increment' },
  })

  const onSubmit = async (data: FormData) => {
    if (lines.length === 0) {
      toast({ variant: 'destructive', description: 'Agrega al menos una línea' })
      return
    }
    const invalid = lines.find((l) => !l.product_id || !l.quantity || Number(l.quantity) <= 0)
    if (invalid) {
      toast({ variant: 'destructive', description: 'Completa todos los campos de las líneas' })
      return
    }
    try {
      const doc = await create.mutateAsync({
        adjust_type: data.adjust_type as AdjustType,
        notes: data.notes || undefined,
        lines: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      })
      toast({ title: `Ajuste ${doc.number} creado (pendiente de aprobación)` })
      navigate(`/inventory/ajustes/${doc.id}`)
    } catch {
      toast({ variant: 'destructive', description: 'Error al crear el ajuste' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Nuevo Ajuste de Inventario</h1>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Tipo de ajuste</Label>
            <Controller control={control} name="adjust_type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="increment">Incremento</SelectItem>
                  <SelectItem value="decrement">Decremento</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label>Notas</Label>
            <Input {...register('notes')} placeholder="Motivo del ajuste" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-medium">Líneas del documento</h2>
          <DocumentLinesEditor lines={lines} onChange={setLines} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>Crear ajuste</Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}
