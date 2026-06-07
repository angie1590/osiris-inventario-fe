import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Standard container for list filter bars. Replaces the
 * `flex flex-wrap gap-3 rounded-lg border bg-card p-3` block duplicated
 * across list pages.
 */
export function FilterBar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3', className)} {...props}>
      {children}
    </div>
  )
}
