import { useState } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "@/components/shared/Sidebar";
import { Topbar } from "@/components/shared/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { useCompanyConfig } from "@/features/admin/hooks";
import { usePendingRecategorization } from "@/features/catalog/hooks";
import { usePendingRemap } from "@/features/catalog/remapHooks";
import { useSessionTimer } from "@/hooks/use-session-timer";
import { getSessionTimeoutMinutes } from "@/lib/api";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, reloadUser } = useAuth();
  const navigate = useNavigate();
  const { data: company } = useCompanyConfig();
  const showBanner = !company || !company.is_complete;
  const canRecategorize = user?.role === "admin" || user?.role === "operator";
  const { data: pendingProducts } = usePendingRecategorization();
  const pendingRecategorization = canRecategorize ? (pendingProducts?.length ?? 0) : 0;
  const { data: pendingRemap } = usePendingRemap();
  const remapCount = canRecategorize ? (pendingRemap?.total ?? 0) : 0;
  const timeoutMinutes = getSessionTimeoutMinutes();
  const pinRequired =
    (user?.role === "admin" || user?.role === "supervisor") &&
    !user?.has_approval_code;

  const { showWarning } = useSessionTimer(() => {
    void handleLogout();
  }, timeoutMinutes);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--content-bg))]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        style={{ zIndex: "var(--z-sticky)" }}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          fullName={user?.full_name}
          username={user?.username}
          role={user?.role}
          hasApprovalCode={user?.has_approval_code}
          onRefreshUser={reloadUser}
          onLogout={handleLogout}
        />

        {pinRequired && (
          <div className="mx-5 mt-4 flex shrink-0 items-center gap-2 rounded-lg border border-orange-400/80 bg-orange-100/95 px-4 py-2.5 text-sm text-orange-900 shadow-token-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              PIN no definido. Debes configurarlo para aprobar bajas y ajustes.
            </span>
          </div>
        )}

        {showBanner && (
          <div className="mx-5 mt-4 flex shrink-0 items-center gap-2 rounded-lg border border-amber-400/80 bg-amber-100/95 px-4 py-2.5 text-sm text-amber-900 shadow-token-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {user?.role === "admin" ? (
              <>
                <span>Configuración de empresa incompleta.</span>
                <Link
                  to="/admin/company"
                  className="font-semibold underline underline-offset-2 hover:no-underline"
                >
                  Configurar ahora
                </Link>
              </>
            ) : (
              <span>
                El administrador debe completar la configuración de empresa
                antes de operar.
              </span>
            )}
          </div>
        )}

        {pendingRecategorization > 0 && canRecategorize && (
          <div className="mx-5 mt-4 flex shrink-0 items-center gap-2 rounded-lg border border-amber-400/80 bg-amber-100/95 px-4 py-2.5 text-sm text-amber-900 shadow-token-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Hay {pendingRecategorization} producto(s) sin recategorizar en categorías "Sin clasificar".
            </span>
            <Link
              to="/recategorize"
              className="font-semibold underline underline-offset-2 hover:no-underline"
            >
              Recategorizar ahora
            </Link>
          </div>
        )}

        {remapCount > 0 && canRecategorize && (
          <div className="mx-5 mt-4 flex shrink-0 items-center gap-2 rounded-lg border border-amber-400/80 bg-amber-100/95 px-4 py-2.5 text-sm text-amber-900 shadow-token-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Hay {remapCount} valor(es) de atributos por remapear tras un cambio de tipo.</span>
            <Link to="/remap" className="font-semibold underline underline-offset-2 hover:no-underline">
              Remapear ahora
            </Link>
          </div>
        )}

        {showWarning && (
          <div className="mx-5 mt-3 flex shrink-0 items-center gap-2 rounded-lg border border-rose-400/80 bg-rose-100/95 px-4 py-2.5 text-sm text-rose-900 shadow-token-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Tu sesión está por expirar por inactividad. Realiza una acción
              para mantenerla activa.
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-5 pb-5 pt-4">
          <div className="mx-auto w-full max-w-345">
            <Outlet />
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
