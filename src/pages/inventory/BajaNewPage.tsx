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
import { useCreateBaja } from '@/features/inventory/hooks'
import { useToast } from '@/hooks/use-toast'

const schema = z.object({ notes: z.string().optional() })
type FormData = z.infer<typeof schema>

export default function BajaNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const create = useCreateBaja()
  const [lines, setLines] = useState<DocumentLine[]>([])

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
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
        notes: data.notes || undefined,
        lines: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      })
      toast({ title: `Baja ${doc.number} creada (pendiente de aprobación)` })
      navigate(`/inventory/bajas/${doc.id}`)
    } catch {
      toast({ variant: 'destructive', description: 'Error al crear la baja' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Nueva Baja de Inventario</h1>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <Label>Notas</Label>
            <Input {...register('notes')} placeholder="Motivo de la baja" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-medium">Líneas del documento</h2>
          <DocumentLinesEditor lines={lines} onChange={setLines} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>Crear baja</Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}
