import { useEffect } from 'react'
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

function toISODate(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function currentMonthRange(): DateRange {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { date_from: toISODate(from), date_to: toISODate(to) }
}

function todayRange(): DateRange {
  const t = toISODate(new Date())
  return { date_from: t, date_to: t }
}
function thisWeekRange(): DateRange {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { date_from: toISODate(monday), date_to: toISODate(sunday) }
}
function last30DaysRange(): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 29)
  return { date_from: toISODate(from), date_to: toISODate(to) }
}

const PRESETS: Array<{ label: string; range: () => DateRange }> = [
  { label: 'Hoy', range: todayRange },
  { label: 'Esta semana', range: thisWeekRange },
  { label: 'Este mes', range: currentMonthRange },
  { label: 'Últimos 30 días', range: last30DaysRange },
]

interface Props {
  onApply: (range: DateRange) => void
  defaultValues?: DateRange
  autoApply?: boolean
}

export function DateRangeFilter({ onApply, defaultValues, autoApply }: Props) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<DateRange>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? currentMonthRange(),
  })

  useEffect(() => {
    if (autoApply !== false) {
      const range = defaultValues ?? currentMonthRange()
      onApply(range)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyPreset = (range: DateRange) => {
    reset(range)
    onApply(range)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button key={p.label} type="button" variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => applyPreset(p.range())}>
            {p.label}
          </Button>
        ))}
      </div>
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
    </div>
  )
}
