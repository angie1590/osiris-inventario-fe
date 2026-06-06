import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { ChevronRight, ChevronDown, Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/api'

interface TreeSelectorProps {
  categories: Category[]
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
  allowRootOption?: boolean
  rootLabel?: string
  disabled?: boolean
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

function buildPath(categories: Category[], id: number): string {
  const parts: string[] = []
  let current: Category | undefined = categories.find((c) => c.id === id)
  while (current) {
    parts.unshift(current.name)
    current = current.parent_id ? categories.find((c) => c.id === current!.parent_id) : undefined
  }
  return parts.join(' › ')
}

function matchesSearch(cat: Category, categories: Category[], query: string): boolean {
  if (!query) return true
  const lower = query.toLowerCase()
  if (cat.name.toLowerCase().includes(lower)) return true
  let parent = cat.parent_id ? categories.find((c) => c.id === cat.parent_id) : undefined
  while (parent) {
    if (parent.name.toLowerCase().includes(lower)) return true
    parent = parent.parent_id ? categories.find((c) => c.id === parent!.parent_id) : undefined
  }
  return false
}

function hasVisibleDescendant(cat: Category, categories: Category[], query: string): boolean {
  const children = categories.filter((c) => c.parent_id === cat.id && c.is_active)
  return children.some((c) => matchesSearch(c, categories, query) || hasVisibleDescendant(c, categories, query))
}

interface NodeProps {
  cat: Category
  categories: Category[]
  depth: number
  query: string
  selected: number | null
  onSelect: (id: number) => void
  focusedId: number | null
  setFocusedId: (id: number | null) => void
  flatVisible: React.MutableRefObject<number[]>
}

function TreeNode({ cat, categories, depth, query, selected, onSelect, focusedId, setFocusedId, flatVisible }: NodeProps) {
  const children = categories.filter((c) => c.parent_id === cat.id && c.is_active)
  const visible = matchesSearch(cat, categories, query)
  const childVisible = hasVisibleDescendant(cat, categories, query)

  const [expanded, setExpanded] = React.useState(!query ? false : true)

  React.useEffect(() => {
    if (query) setExpanded(true)
    else setExpanded(false)
  }, [query])

  if (!visible && !childVisible) return null

  if (visible) {
    flatVisible.current.push(cat.id)
  }

  return (
    <div>
      <div
        role="option"
        aria-selected={selected === cat.id}
        data-focused={focusedId === cat.id}
        tabIndex={-1}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-sm select-none',
          'hover:bg-accent focus:outline-none',
          selected === cat.id && 'bg-primary/10 font-medium',
          focusedId === cat.id && 'ring-2 ring-ring ring-inset',
        )}
        style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}
        onClick={() => { if (visible) onSelect(cat.id) }}
        onMouseEnter={() => setFocusedId(cat.id)}
      >
        <button
          type="button"
          className="flex w-4 shrink-0 items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          {children.length > 0
            ? (expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />)
            : null}
        </button>
        <span className={cn('flex-1 truncate', !visible && 'opacity-40')}>{cat.name}</span>
        {selected === cat.id && <Check className="h-3 w-3 shrink-0 text-primary" />}
      </div>
      {expanded && children.map((child) => (
        <TreeNode
          key={child.id}
          cat={child}
          categories={categories}
          depth={depth + 1}
          query={query}
          selected={selected}
          onSelect={onSelect}
          focusedId={focusedId}
          setFocusedId={setFocusedId}
          flatVisible={flatVisible}
        />
      ))}
    </div>
  )
}

export function TreeSelector({
  categories,
  value,
  onChange,
  placeholder = 'Seleccionar categoría',
  allowRootOption = false,
  rootLabel = 'Sin padre (raíz)',
  disabled,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: TreeSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [focusedId, setFocusedId] = React.useState<number | null>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const flatVisible = React.useRef<number[]>([])

  const activeCategories = categories.filter((c) => c.is_active)
  const roots = activeCategories.filter((c) => !c.parent_id)

  const label = value ? buildPath(activeCategories, value) : null

  React.useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
    } else {
      setQuery('')
      setFocusedId(null)
    }
  }, [open])

  const handleSelect = (id: number) => {
    if (id === -1) {
      onChange(null)
      setOpen(false)
      return
    }
    onChange(id)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const ids = flatVisible.current
    if (!ids.length) return
    const idx = focusedId !== null ? ids.indexOf(focusedId) : -1

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedId(ids[Math.min(idx + 1, ids.length - 1)])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedId(ids[Math.max(idx - 1, 0)])
    } else if (e.key === 'Enter' && focusedId !== null) {
      e.preventDefault()
      handleSelect(focusedId)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  flatVisible.current = []
  if (allowRootOption) flatVisible.current.push(-1)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !label && 'text-muted-foreground')}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={cn(
            'w-(--radix-popover-trigger-width) rounded-md border bg-popover p-0 shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
          style={{ zIndex: 350 }}
          align="start"
          sideOffset={4}
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar categoría..."
              className="h-7 border-none shadow-none focus-visible:ring-0 p-0 text-sm"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {allowRootOption && (
              <div
                role="option"
                aria-selected={value === null}
                data-focused={focusedId === -1}
                tabIndex={-1}
                className={cn(
                  'mb-1 flex items-center gap-2 rounded border border-dashed border-border px-2 py-1.5 text-sm select-none',
                  'cursor-pointer hover:bg-accent focus:outline-none',
                  value === null && 'bg-primary/10 font-medium',
                  focusedId === -1 && 'ring-2 ring-ring ring-inset',
                )}
                onClick={() => handleSelect(-1)}
                onMouseEnter={() => setFocusedId(-1)}
              >
                <span className="flex-1 truncate">{rootLabel}</span>
                {value === null && <Check className="h-3 w-3 shrink-0 text-primary" />}
              </div>
            )}

            {roots.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Sin categorías</p>
            ) : (
              roots.map((cat) => (
                <TreeNode
                  key={cat.id}
                  cat={cat}
                  categories={activeCategories}
                  depth={0}
                  query={query}
                  selected={value}
                  onSelect={handleSelect}
                  focusedId={focusedId}
                  setFocusedId={setFocusedId}
                  flatVisible={flatVisible}
                />
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
