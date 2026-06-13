import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  username: z.string().min(1, "Requerido"),
  password: z.string().min(1, "Requerido"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoginError(null);
    try {
      const resp = await login(data.username, data.password);
      navigate(resp.require_password_change ? "/change-password" : "/");
    } catch (err: unknown) {
      const apiErr = err as {
        response?: { status?: number; data?: { code?: string } };
        request?: unknown;
      };
      const code = apiErr?.response?.data?.code;
      const status = apiErr?.response?.status;

      if (code === "ACCOUNT_INACTIVE") {
        setLoginError("Usuario inactivo. Contacta al administrador.");
      } else if (code === "INVALID_CREDENTIALS" || status === 401) {
        setLoginError("Usuario o contraseña incorrectos");
      } else if (!apiErr?.response) {
        // No hubo respuesta del servidor: API caída o proxy/red mal configurados.
        setLoginError(
          "No se pudo conectar con el servidor. Verifica que la API esté corriendo (http://localhost:8000).",
        );
      } else {
        setLoginError(
          `Error del servidor (${status ?? "desconocido"}). Intenta nuevamente en unos segundos.`,
        );
      }
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center text-2xl">
          Osiris Inventario
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          onChange={() => setLoginError(null)}
        >
          {loginError && (
            <Alert variant="destructive">
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              {...register("username")}
              autoComplete="username"
            />
            {errors.username && (
              <p className="text-xs text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              autoComplete="current-password"
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
