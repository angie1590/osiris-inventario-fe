import { InboxIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  heading: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon, heading, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <div className="text-muted-foreground">{icon ?? <InboxIcon className="h-10 w-10" />}</div>
      <p className="text-sm font-medium text-foreground">{heading}</p>
      {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
