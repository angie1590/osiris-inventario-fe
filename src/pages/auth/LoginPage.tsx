import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

const schema = z.object({
  username: z.string().min(1, 'Requerido'),
  password: z.string().min(1, 'Requerido'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const resp = await login(data.username, data.password)
      // After login, AuthContext fetches /me and sets user
      // require_password_change redirect is handled by ProtectedRoute
      void resp
      navigate('/')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: { code?: string } } } })?.response?.status
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code

      if (status === 403 || code === 'USER_INACTIVE') {
        toast({ variant: 'destructive', title: 'Cuenta desactivada', description: 'Tu cuenta está desactivada. Contactá al administrador.' })
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Usuario o contraseña incorrectos' })
      }
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Osiris Inventario</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="username">Usuario</Label>
            <Input id="username" {...register('username')} autoComplete="username" />
            {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" {...register('password')} autoComplete="current-password" />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
