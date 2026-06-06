import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/toaster'

export default function AuthLayout() {
  const { user, isLoading } = useAuth()
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
  if (user && !user.require_password_change) return <Navigate to="/" replace />
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Outlet />
      <Toaster />
    </div>
  )
}
