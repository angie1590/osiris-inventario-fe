import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types/api'

interface Props {
  roles: UserRole[]
}

export function RoleGuard({ roles }: Props) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />
  return <Outlet />
}
