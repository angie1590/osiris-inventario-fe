import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { Sidebar } from '@/components/shared/Sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/toaster'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  supervisor: 'Supervisor',
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div />
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{user?.full_name || user?.username}</span>
            <Badge variant="secondary" className="text-xs">
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
            </Badge>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  )
}
