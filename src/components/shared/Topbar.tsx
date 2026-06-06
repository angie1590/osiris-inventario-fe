import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut, User, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NAV_ITEMS } from '@/components/shared/Sidebar'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  supervisor: 'Supervisor',
}

interface TopbarProps {
  username?: string
  fullName?: string
  role?: string
  onLogout: () => void | Promise<void>
}

export function Topbar({ username, fullName, role, onLogout }: TopbarProps) {
  const location = useLocation()
  const currentSection = useMemo(() => {
    const found = NAV_ITEMS.find((item) => item.to !== '/' && location.pathname.startsWith(item.to))
    if (found) return found.label
    if (location.pathname === '/') return 'Dashboard'
    return 'Panel'
  }, [location.pathname])

  return (
    <header className="z-topbar sticky top-0 flex h-16 shrink-0 items-center justify-between border-b border-cyan-700/40 bg-[hsl(var(--topbar-bg))] px-5 text-[hsl(var(--topbar-fg))] shadow-token-sm">
      <div className="flex items-center gap-3 text-sm">
        <div className="rounded-lg bg-cyan-400/15 p-1.5">
          <Building2 className="h-4 w-4 text-cyan-200" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">OSIRIS Inventario</p>
          <p className="font-semibold text-white">{currentSection}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <User className="h-4 w-4 text-cyan-100/90" />
        <span className="text-sm font-medium text-white">{fullName || username}</span>
        <Badge variant="secondary" className="border border-cyan-700/50 bg-cyan-900/40 text-cyan-50">
          {ROLE_LABELS[role ?? ''] ?? role}
        </Badge>
        <Button variant="ghost" size="icon" onClick={onLogout} title="Cerrar sesión" className="text-cyan-50 hover:bg-cyan-800/60 hover:text-white">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
