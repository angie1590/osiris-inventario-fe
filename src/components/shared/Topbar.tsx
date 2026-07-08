import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Building2,
  Check,
  KeyRound,
  LogOut,
  ShieldAlert,
  User,
  UserCog,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NAV_ITEMS } from "@/components/shared/Sidebar";
import { useToast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  operator: "Operador",
  supervisor: "Supervisor",
};

interface TopbarProps {
  username?: string;
  fullName?: string;
  role?: string;
  hasApprovalCode?: boolean;
  onRefreshUser: () => Promise<void>;
  onLogout: () => void | Promise<void>;
}

export function Topbar({
  username,
  fullName,
  role,
  hasApprovalCode,
  onRefreshUser,
  onLogout,
}: TopbarProps) {
  const { toast } = useToast();
  const location = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [profileName, setProfileName] = useState(fullName ?? "");
  const [approvalCode, setApprovalCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const canConfigurePin = role === "admin" || role === "supervisor";
  const forcePinSetup = canConfigurePin && !hasApprovalCode;

  useEffect(() => {
    setProfileName(fullName ?? "");
  }, [fullName]);

  useEffect(() => {
    if (forcePinSetup) {
      setActiveTab("pin");
      setAccountOpen(true);
    }
  }, [forcePinSetup]);

  const currentSection = useMemo(() => {
    const found = NAV_ITEMS.find(
      (item) => item.to !== "/" && location.pathname.startsWith(item.to),
    );
    if (found) return found.label;
    if (location.pathname === "/") return "Dashboard";
    return "Panel";
  }, [location.pathname]);

  const handleSaveProfile = async () => {
    const trimmed = profileName.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        description: "El nombre completo es requerido.",
      });
      return;
    }
    setSavingProfile(true);
    try {
      await api.patch("/auth/profile", { full_name: trimmed });
      await onRefreshUser();
      toast({ title: "Perfil actualizado" });
    } catch {
      toast({
        variant: "destructive",
        description: "No se pudo actualizar el perfil.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePin = async () => {
    const normalized = approvalCode
      .replace(/\D/g, "")
      .slice(0, 4);
    if (normalized.length !== 4) {
      toast({
        variant: "destructive",
        description: "El PIN debe tener exactamente 4 dígitos.",
      });
      return;
    }
    setSavingPin(true);
    try {
      await api.post("/auth/approval-code", { approval_code: normalized });
      setApprovalCode("");
      await onRefreshUser();
      toast({
        title: "PIN configurado",
        description: "Tu PIN de aprobación quedó guardado.",
      });
      if (!forcePinSetup) {
        setAccountOpen(false);
      }
    } catch (err: unknown) {
      const responseData = (
        err as {
          response?: { data?: { code?: string; detail?: { code?: string } } };
        }
      )?.response?.data;
      const code = responseData?.code ?? responseData?.detail?.code;
      if (code === "INVALID_APPROVAL_CODE_FORMAT") {
        toast({
          variant: "destructive",
          description: "El PIN debe tener exactamente 4 dígitos.",
        });
      } else {
        toast({
          variant: "destructive",
          description: "No se pudo guardar el PIN.",
        });
      }
    } finally {
      setSavingPin(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        variant: "destructive",
        description: "Completa todos los campos de contraseña.",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        description: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        description: "La confirmación de contraseña no coincide.",
      });
      return;
    }

    setSavingPassword(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast({
        title: "Contraseña actualizada",
        description: "Debes iniciar sesión nuevamente.",
      });
      await onLogout();
    } catch (err: unknown) {
      const code = (
        err as { response?: { data?: { detail?: { code?: string } } } }
      )?.response?.data?.detail?.code;
      toast({
        variant: "destructive",
        description:
          code === "INVALID_CURRENT_PASSWORD"
            ? "La contraseña actual es incorrecta."
            : "No se pudo actualizar la contraseña.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <header className="z-topbar sticky top-0 flex h-16 shrink-0 items-center justify-between border-b border-cyan-700/40 bg-[hsl(var(--topbar-bg))] px-5 text-[hsl(var(--topbar-fg))] shadow-token-sm">
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg bg-cyan-400/15 p-1.5">
            <Building2 className="h-4 w-4 text-cyan-200" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              OSIRIS Inventario
            </p>
            <p className="font-semibold text-white">{currentSection}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canConfigurePin && !hasApprovalCode && (
            <Badge className="border border-orange-300/70 bg-orange-100 text-orange-900">
              <ShieldAlert className="mr-1 h-3.5 w-3.5" /> PIN no definido
            </Badge>
          )}
          <button
            type="button"
            className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-left hover:bg-cyan-800/45"
            onClick={() => setAccountOpen(true)}
            title="Abrir menú de cuenta"
          >
            <User className="h-4 w-4 text-cyan-100/90" />
            <span className="text-sm font-medium text-white">
              {fullName || username}
            </span>
            <Badge
              variant="secondary"
              className="border border-cyan-700/50 bg-cyan-900/40 text-cyan-50"
            >
              {ROLE_LABELS[role ?? ""] ?? role}
            </Badge>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            title="Cerrar sesión"
            className="text-cyan-50 hover:bg-cyan-800/60 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <Dialog
        open={accountOpen}
        onOpenChange={(open) => {
          if (forcePinSetup && !open) return;
          setAccountOpen(open);
        }}
      >
        <DialogContent
          className="sm:max-w-lg"
          showCloseButton={!forcePinSetup}
          onEscapeKeyDown={(e) => {
            if (forcePinSetup) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (forcePinSetup) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Cuenta de usuario</DialogTitle>
            <DialogDescription>
              Actualiza tus datos y define tu PIN personal de aprobación.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="profile">
                  <UserCog className="mr-1 h-4 w-4" />
                  Perfil
                </TabsTrigger>
                <TabsTrigger value="pin" disabled={!canConfigurePin}>
                  <KeyRound className="mr-1 h-4 w-4" />
                  PIN
                </TabsTrigger>
                <TabsTrigger value="security">
                  <KeyRound className="mr-1 h-4 w-4" />
                  Seguridad
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4">
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Input value={username ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    maxLength={100}
                    placeholder="Tu nombre completo"
                  />
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  <Check className="mr-2 h-4 w-4" />
                  {savingProfile ? "Guardando..." : "Guardar perfil"}
                </Button>
              </TabsContent>

              <TabsContent value="pin" className="space-y-4">
                {!canConfigurePin ? (
                  <p className="text-sm text-muted-foreground">
                    Tu rol no requiere PIN de aprobación.
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                      {hasApprovalCode
                        ? "Ya tienes un PIN configurado. Puedes reemplazarlo si lo deseas."
                        : "PIN no definido. Debes configurarlo para continuar."}
                    </div>
                    <div className="space-y-2">
                      <Label>PIN de aprobación</Label>
                      <Input
                        value={approvalCode}
                        onChange={(e) =>
                          setApprovalCode(
                            e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 4),
                          )
                        }
                        maxLength={4}
                        placeholder="Ej. 1234"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="h-11 text-center font-mono tracking-[0.25em]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Usa 4 dígitos numéricos.
                      </p>
                    </div>
                    <Button onClick={handleSavePin} disabled={savingPin}>
                      <Check className="mr-2 h-4 w-4" />
                      {savingPin ? "Guardando..." : "Guardar PIN"}
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <div className="space-y-2">
                  <Label>Contraseña actual</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nueva contraseña</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar nueva contraseña</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogBody>
          {!forcePinSetup && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAccountOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
