import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="flex h-screen items-center justify-center">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.require_password_change) return <Navigate to="/change-password" replace />
  return <Outlet />
}
