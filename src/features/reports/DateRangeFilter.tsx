import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  date_from: z.string().min(1, 'Requerido'),
  date_to: z.string().min(1, 'Requerido'),
}).refine((d) => d.date_from <= d.date_to, {
  message: 'La fecha inicial debe ser anterior a la final',
  path: ['date_to'],
})

export type DateRange = { date_from: string; date_to: string }

interface Props {
  onApply: (range: DateRange) => void
  defaultValues?: DateRange
}

export function DateRangeFilter({ onApply, defaultValues }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<DateRange>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onApply)} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Fecha desde</Label>
        <Input type="date" className="h-8 w-40" {...register('date_from')} />
        {errors.date_from && <p className="text-xs text-destructive">{errors.date_from.message}</p>}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Fecha hasta</Label>
        <Input type="date" className="h-8 w-40" {...register('date_to')} />
        {errors.date_to && <p className="text-xs text-destructive">{errors.date_to.message}</p>}
      </div>
      <Button type="submit" size="sm">Aplicar</Button>
    </form>
  )
}
