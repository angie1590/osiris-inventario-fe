import { useToast } from '@/hooks/use-toast'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'
import { CheckCircle2, Info, TriangleAlert, CircleX } from 'lucide-react'

const VARIANT_ICON = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  destructive: CircleX,
  default: Info,
} as const

export function Toaster() {
  const { toasts } = useToast()
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant, ...props }) => {
        const Icon = VARIANT_ICON[(variant ?? 'default') as keyof typeof VARIANT_ICON]
        return (
        <Toast key={id} {...props}>
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
          </div>
          <ToastClose />
        </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
