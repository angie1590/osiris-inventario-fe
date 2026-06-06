import * as React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
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
}

const SKELETON_ROWS = 5

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
}: DataTableProps<T>) {
  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
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
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState heading={emptyHeading} description={emptyDescription} action={emptyAction} />
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
