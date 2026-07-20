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
  const [activeIndex, setActiveIndex] = React.useState(0)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const optionRefs = React.useRef<Array<HTMLDivElement | null>>([])

  const normalized: SearchableSelectOption[] = React.useMemo(
    () =>
      options.map((o) =>
        typeof o === 'string' ? { value: o, label: o } : o,
      ),
    [options],
  )
  const selected = normalized.find((o) => o.value === value)
  const filtered = React.useMemo(
    () =>
      query
        ? normalized.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
        : normalized,
    [normalized, query],
  )

  React.useEffect(() => {
    if (!open) return
    setActiveIndex((current) => {
      if (filtered.length === 0) return 0
      const selectedIndex = filtered.findIndex((o) => o.value === value)
      if (selectedIndex >= 0) return selectedIndex
      if (current < 0) return 0
      if (current >= filtered.length) return filtered.length - 1
      return current
    })
  }, [open, value, query, filtered.length])

  React.useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40)
    else setQuery('')
  }, [open])

  React.useEffect(() => {
    const active = optionRefs.current[activeIndex]
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const moveActive = (direction: 1 | -1) => {
    if (filtered.length === 0) return
    setActiveIndex((current) => {
      const next = (current + direction + filtered.length) % filtered.length
      return next
    })
  }

  const openFromTrigger = (direction?: 1 | -1) => {
    if (open) {
      if (direction) moveActive(direction)
      return
    }
    setOpen(true)
    if (!direction || filtered.length === 0) return
    const selectedIndex = filtered.findIndex((o) => o.value === value)
    const base = selectedIndex >= 0 ? selectedIndex : direction === 1 ? -1 : 0
    setActiveIndex((base + direction + filtered.length) % filtered.length)
  }

  const commitActive = () => {
    const option = filtered[activeIndex]
    if (!option) return
    onChange(option.value)
    setOpen(false)
  }

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
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              openFromTrigger(1)
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              openFromTrigger(-1)
            }
          }}
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
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            searchRef.current?.focus()
          }}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(0)
              }}
              placeholder="Buscar…"
              className="h-7 border-none p-0 text-sm shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  moveActive(1)
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  moveActive(-1)
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitActive()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setOpen(false)
                }
              }}
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
                  ref={(node) => {
                    optionRefs.current[filtered.indexOf(o)] = node
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm select-none hover:bg-accent',
                    filtered[activeIndex]?.value === o.value && 'bg-accent',
                    o.value === value && 'font-medium',
                  )}
                  onMouseEnter={() => setActiveIndex(filtered.indexOf(o))}
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
