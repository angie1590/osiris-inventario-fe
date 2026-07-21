import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'
export interface SortState {
  key: string
  dir: SortDir
}

export interface Column<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
  /** Mark the column sortable; renders an interactive, accessible header. */
  sortable?: boolean
  /** Value used to sort this column (client-side sorting). */
  sortAccessor?: (row: T) => string | number | Date | null | undefined
  /** Text alignment for header + cells. */
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string | number
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  emptyHeading?: string
  emptyDescription?: string
  emptyAction?: { label: string; onClick: () => void }
  className?: string
  /** Initial/base sort. Third click on a header returns here (or to unsorted). */
  defaultSort?: SortState
  /**
   * Controlled sort. Provide together with `onSortChange` for server-side
   * sorting — DataTable then renders indicators but does NOT reorder `data`.
   */
  sort?: SortState | null
  onSortChange?: (sort: SortState | null) => void
  pageSize?: number
}

const SKELETON_ROWS = 5

const ALIGN_CLASS: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'es-EC', { numeric: true, sensitivity: 'base' })
}

function SortableColumnHeader({
  label,
  state,
  align,
  onToggle,
}: {
  label: React.ReactNode
  state: SortDir | null
  align?: Column<unknown>['align']
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'group inline-flex w-full items-center gap-1.5 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
        align === 'right' && 'flex-row-reverse',
        align === 'center' && 'justify-center',
      )}
    >
      <span>{label}</span>
      {state === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5 text-primary" />
      ) : state === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5 text-primary" />
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 group-hover:opacity-70" />
      )}
    </button>
  )
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading,
  isError,
  onRetry,
  emptyHeading = 'No hay registros',
  emptyDescription,
  emptyAction,
  className,
  defaultSort,
  sort,
  onSortChange,
  pageSize = 10,
}: DataTableProps<T>) {
  const isControlled = onSortChange != null
  const [internalSort, setInternalSort] = React.useState<SortState | null>(defaultSort ?? null)
  const [page, setPage] = React.useState(1)
  const effectiveSort = isControlled ? sort ?? null : internalSort

  const handleToggle = (key: string) => {
    const current = effectiveSort?.key === key ? effectiveSort.dir : null
    let next: SortState | null
    if (current == null) next = { key, dir: 'asc' }
    else if (current === 'asc') next = { key, dir: 'desc' }
    else next = defaultSort ?? null
    if (isControlled) onSortChange!(next)
    else setInternalSort(next)
  }

  const sortedData = React.useMemo(() => {
    if (isControlled || !effectiveSort) return data
    const col = columns.find((c) => c.key === effectiveSort.key)
    if (!col?.sortAccessor) return data
    const accessor = col.sortAccessor
    return [...data].sort((ra, rb) => {
      const cmp = compareValues(accessor(ra), accessor(rb))
      return effectiveSort.dir === 'asc' ? cmp : -cmp
    })
  }, [data, columns, effectiveSort, isControlled])

  const totalRows = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  React.useEffect(() => {
    setPage(1)
  }, [totalRows, effectiveSort?.key, effectiveSort?.dir, pageSize])

  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const end = start + pageSize
  const pagedData = sortedData.slice(start, end)

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => {
              const sortState = effectiveSort?.key === col.key ? effectiveSort.dir : null
              const ariaSort = col.sortable
                ? sortState === 'asc'
                  ? 'ascending'
                  : sortState === 'desc'
                    ? 'descending'
                    : 'none'
                : undefined
              return (
                <TableHead
                  key={col.key}
                  aria-sort={ariaSort}
                  className={cn(col.align && ALIGN_CLASS[col.align], col.sortable && 'cursor-pointer', col.className)}
                >
                  {col.sortable ? (
                    <SortableColumnHeader
                      label={col.header}
                      state={sortState}
                      align={col.align}
                      onToggle={() => handleToggle(col.key)}
                    />
                  ) : (
                    col.header
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <ErrorState onRetry={onRetry} />
              </TableCell>
            </TableRow>
          ) : sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState heading={emptyHeading} description={emptyDescription} action={emptyAction} />
              </TableCell>
            </TableRow>
          ) : (
            pagedData.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={cn(col.align && ALIGN_CLASS[col.align], col.className)}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {!isLoading && !isError && sortedData.length > 0 && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Mostrando {start + 1}-{Math.min(end, totalRows)} de {totalRows}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </Button>
            <span className="min-w-16 text-center text-muted-foreground">
              {currentPage}/{totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
