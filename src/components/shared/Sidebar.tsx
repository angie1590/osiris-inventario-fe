import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Tags, Package, ArrowDownToLine, ArrowUpFromLine,
  Trash2, SlidersHorizontal, BookOpen, BarChart3, ClipboardList,
  Users, Settings, ChevronLeft, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types/api'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',                           label: 'Dashboard',   icon: LayoutDashboard,    roles: ['admin', 'operator', 'supervisor'] },
  { to: '/categories',                 label: 'Categorías',  icon: Tags,               roles: ['admin', 'operator'] },
  { to: '/products',                   label: 'Productos',   icon: Package,            roles: ['admin', 'operator', 'supervisor'] },
  { to: '/inventory/ingresos',         label: 'Ingresos',    icon: ArrowDownToLine,    roles: ['admin', 'operator'] },
  { to: '/inventory/egresos',          label: 'Egresos',     icon: ArrowUpFromLine,    roles: ['admin', 'operator'] },
  { to: '/inventory/bajas',            label: 'Bajas',       icon: Trash2,             roles: ['admin', 'operator'] },
  { to: '/inventory/ajustes',          label: 'Ajustes',     icon: SlidersHorizontal,  roles: ['admin', 'operator'] },
  { to: '/kardex',                     label: 'Kardex',      icon: BookOpen,           roles: ['admin', 'operator', 'supervisor'] },
  { to: '/reports',                    label: 'Reportes',    icon: BarChart3,          roles: ['admin', 'supervisor'] },
  { to: '/audit',                      label: 'Auditoría',   icon: ClipboardList,      roles: ['admin', 'supervisor'] },
  { to: '/admin/users',                label: 'Usuarios',    icon: Users,              roles: ['admin'] },
  { to: '/admin/params',               label: 'Parámetros',  icon: Settings,           roles: ['admin'] },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth()
  const role = user?.role

  const visibleItems = NAV_ITEMS.filter((item) => role && item.roles.includes(role))

  return (
    <aside className={cn(
      'flex flex-col border-r bg-card transition-all duration-200',
      collapsed ? 'w-14' : 'w-56'
    )}>
      <div className="flex h-14 items-center justify-between px-3 border-b">
        {!collapsed && <span className="font-bold text-primary truncate">Osiris</span>}
        <button
          onClick={onToggle}
          className="ml-auto rounded p-1 hover:bg-muted"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted',
              isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground',
              collapsed && 'justify-center'
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
