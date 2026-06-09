import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface Props {
  value: string | null
  onChange: (value: string) => void
  options: SearchableSelectOption[] | string[]
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

/** Flat, searchable, scrollable single-select combobox (works inside dialogs). */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  emptyText = 'Sin valores',
  disabled,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const searchRef = React.useRef<HTMLInputElement>(null)

  const normalized: SearchableSelectOption[] = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  const selected = normalized.find((o) => o.value === value)
  const filtered = query
    ? normalized.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : normalized

  React.useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40)
    else setQuery('')
  }, [open])

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="w-(--radix-popover-trigger-width) rounded-md border bg-popover p-0 shadow-md"
          style={{ zIndex: 350 }}
          align="start"
          sideOffset={4}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-7 border-none p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <div
            className="max-h-64 overflow-y-auto overscroll-contain p-1"
            role="listbox"
            onWheelCapture={(e) => {
              // Inside a Radix Dialog react-remove-scroll blocks native wheel on
              // this portaled content; drive it manually there.
              if (!document.body.hasAttribute('data-scroll-locked')) return
              const el = e.currentTarget
              const atTop = el.scrollTop === 0 && e.deltaY < 0
              const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight && e.deltaY > 0
              if (!atTop && !atBottom) {
                el.scrollTop += e.deltaY
                e.stopPropagation()
              }
            }}
          >
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm select-none hover:bg-accent',
                    o.value === value && 'bg-primary/10 font-medium',
                  )}
                  onClick={() => { onChange(o.value); setOpen(false) }}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.value === value && <Check className="h-3 w-3 shrink-0 text-primary" />}
                </div>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
