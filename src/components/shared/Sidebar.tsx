import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Tags,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  ClipboardList,
  Users,
  Settings,
  Building2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Truck,
  Contact,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/api";

type Section = "principal" | "catalogo" | "movimientos" | "analisis" | "admin";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  section: Section;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "operator", "supervisor"],
    section: "principal",
  },
  {
    to: "/products",
    label: "Productos",
    icon: Package,
    roles: ["admin", "operator", "supervisor"],
    section: "catalogo",
  },
  {
    to: "/categories",
    label: "Categorías",
    icon: Tags,
    roles: ["admin", "supervisor"],
    section: "catalogo",
  },
  {
    to: "/catalogs",
    label: "Catálogos",
    icon: ListChecks,
    roles: ["admin", "supervisor"],
    section: "catalogo",
  },
  {
    to: "/suppliers",
    label: "Proveedores",
    icon: Truck,
    roles: ["admin", "operator", "supervisor"],
    section: "catalogo",
  },
  {
    to: "/customers",
    label: "Clientes",
    icon: Contact,
    roles: ["admin", "operator", "supervisor"],
    section: "catalogo",
  },
  {
    to: "/inventory/ingresos",
    label: "Ingresos",
    icon: ArrowDownToLine,
    roles: ["admin", "supervisor"],
    section: "movimientos",
  },
  {
    to: "/inventory/egresos",
    label: "Egresos",
    icon: ArrowUpFromLine,
    roles: ["admin", "operator", "supervisor"],
    section: "movimientos",
  },
  {
    to: "/inventory/conteos",
    label: "Conteo",
    icon: ClipboardCheck,
    roles: ["admin", "operator", "supervisor"],
    section: "movimientos",
  },
  {
    to: "/kardex",
    label: "Kardex",
    icon: BookOpen,
    roles: ["admin", "supervisor"],
    section: "analisis",
  },
  {
    to: "/reports",
    label: "Reportes",
    icon: BarChart3,
    roles: ["admin", "supervisor"],
    section: "analisis",
  },
  {
    to: "/audit",
    label: "Auditoría",
    icon: ClipboardList,
    roles: ["admin", "supervisor"],
    section: "analisis",
  },
  {
    to: "/admin/users",
    label: "Usuarios",
    icon: Users,
    roles: ["admin", "supervisor"],
    section: "admin",
  },
  {
    to: "/admin/params",
    label: "Parámetros",
    icon: Settings,
    roles: ["admin"],
    section: "admin",
  },
  {
    to: "/admin/company",
    label: "Empresa",
    icon: Building2,
    roles: ["admin", "supervisor"],
    section: "admin",
  },
];

const SECTION_LABELS: Record<Section, string> = {
  principal: "Principal",
  catalogo: "Catálogo",
  movimientos: "Movimientos",
  analisis: "Análisis",
  admin: "Administración",
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
  mobileOpen?: boolean;
  onNavigate?: () => void;
  style?: React.CSSProperties;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobile = false,
  mobileOpen = false,
  onNavigate,
  style,
}: SidebarProps) {
  const { user } = useAuth();
  const role = user?.role;

  const visibleItems = NAV_ITEMS.filter(
    (item) => role && item.roles.includes(role),
  );
  const sections: Section[] = [
    "principal",
    "catalogo",
    "movimientos",
    "analisis",
    "admin",
  ];

  return (
    <aside
      style={style}
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col border-r border-cyan-900/30 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] shadow-token-md transition-all duration-200",
        mobile
          ? "fixed inset-y-0 left-0 z-drawer w-64"
          : collapsed
            ? "w-16"
            : "w-64",
        mobile && (mobileOpen ? "translate-x-0" : "-translate-x-full"),
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-cyan-700/35 px-3">
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--sidebar-muted))]">
              OSIRIS
            </p>
            <p className="truncate text-sm font-semibold text-white">
              Inventario
            </p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto rounded-md p-1 text-[hsl(var(--sidebar-muted))] hover:bg-cyan-800/60 hover:text-white"
          aria-label={
            mobile
              ? "Cerrar menú"
              : collapsed
                ? "Expandir sidebar"
                : "Colapsar sidebar"
          }
        >
          {mobile ? (
            <X className="h-4 w-4" />
          ) : collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
        {sections.map((section) => {
          const sectionItems = visibleItems.filter(
            (item) => item.section === section,
          );
          if (sectionItems.length === 0) return null;

          return (
            <div key={section} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--sidebar-muted))]">
                  {SECTION_LABELS[section]}
                </p>
              )}
              <div className="space-y-1">
                {sectionItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "relative mx-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                        isActive
                          ? "bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-active-fg))] shadow-token-sm before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-r before:bg-cyan-200"
                          : "text-[hsl(var(--sidebar-fg))] hover:bg-cyan-800/45 hover:text-white",
                        !mobile && collapsed && "justify-center px-2.5",
                      )
                    }
                    title={!mobile && collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {(mobile || !collapsed) && (
                      <span className="truncate font-medium">{item.label}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
