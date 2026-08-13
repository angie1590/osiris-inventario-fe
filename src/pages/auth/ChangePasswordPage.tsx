import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const schema = z
  .object({
    current_password: z.string().optional(),
    new_password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });
type FormData = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const forced = !!user?.require_password_change;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!forced && !data.current_password) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ingresá tu contraseña actual",
      });
      return;
    }
    try {
      await api.post("/auth/change-password", {
        current_password: forced ? null : data.current_password,
        new_password: data.new_password,
      });
      // Backend revokes all tokens on password change — clear local session and send to login
      await logout();
      toast({
        title: "Contraseña actualizada",
        description: "Ingresá con tu nueva contraseña.",
      });
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      const resp = (
        err as {
          response?: { data?: { code?: string; detail?: { code?: string } } };
        }
      )?.response?.data;
      const code = resp?.code ?? resp?.detail?.code;
      toast({
        variant: "destructive",
        title: "Error",
        description:
          code === "INVALID_CURRENT_PASSWORD"
            ? "La contraseña actual es incorrecta"
            : code === "PASSWORD_NOT_ALLOWED"
              ? "No podés usar la clave genérica usuario123"
              : "Error al cambiar la contraseña",
      });
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>
          Debés cambiar tu contraseña antes de continuar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!forced && (
            <div className="space-y-1">
              <Label>Contraseña actual</Label>
              <Input type="password" {...register("current_password")} />
              {errors.current_password && (
                <p className="text-xs text-destructive">
                  {errors.current_password.message}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label>Nueva contraseña</Label>
            <Input type="password" {...register("new_password")} />
            {errors.new_password && (
              <p className="text-xs text-destructive">
                {errors.new_password.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Confirmar nueva contraseña</Label>
            <Input type="password" {...register("confirm_password")} />
            {errors.confirm_password && (
              <p className="text-xs text-destructive">
                {errors.confirm_password.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
