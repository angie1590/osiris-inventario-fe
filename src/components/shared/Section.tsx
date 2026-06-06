import * as React from 'react'
import { cn } from '@/lib/utils'

interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
}

export function Section({ title, description, className, children, ...props }: SectionProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-4', className)} {...props}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
