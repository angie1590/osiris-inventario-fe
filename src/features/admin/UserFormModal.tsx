import { useForm, Controller, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField } from '@/components/shared/FormField'
import { useCreateUser, useUpdateUser } from './hooks'
import { useToast } from '@/hooks/use-toast'
import type { User, UserRole } from '@/types/api'

const ROLES: UserRole[] = ['admin', 'operator', 'supervisor']

const createSchema = z.object({
  username: z.string().min(3, 'Mínimo 3 caracteres'),
  full_name: z.string().min(1, 'Requerido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['admin', 'operator', 'supervisor']),
  is_active: z.boolean(),
})

const editSchema = z.object({
  full_name: z.string().min(1, 'Requerido'),
  role: z.enum(['admin', 'operator', 'supervisor']),
  is_active: z.boolean(),
  require_password_change: z.boolean(),
})

interface Props {
  user?: User
  onClose: () => void
}

export function UserFormModal({ user, onClose }: Props) {
  const create = useCreateUser()
  const update = useUpdateUser()
  const { toast } = useToast()
  const isEdit = !!user

  const { register, handleSubmit, control, formState: { errors: rawErrors, isSubmitting } } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: isEdit ? {
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      require_password_change: user.require_password_change,
    } : {
      role: 'operator' as UserRole,
      is_active: true,
    },
  })
  const errors = rawErrors as Record<string, FieldError | undefined>

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: user!.id, payload: data as { full_name?: string; role?: UserRole; is_active?: boolean; require_password_change?: boolean } })
        toast({ title: 'Usuario actualizado' })
      } else {
        await create.mutateAsync(data as { username: string; full_name: string; password: string; role: UserRole; is_active?: boolean })
        toast({ title: 'Usuario creado' })
      }
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
      toast({ variant: 'destructive', description: code === 'USERNAME_EXISTS' ? 'El nombre de usuario ya existe' : 'Error al guardar' })
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogHeader><DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            {!isEdit && (
              <FormField label="Usuario" required error={errors.username?.message}>
                <Input {...register('username')} />
              </FormField>
            )}
            <FormField label="Nombre completo" required error={errors.full_name?.message}>
              <Input {...register('full_name')} />
            </FormField>
            {!isEdit && (
              <FormField label="Contraseña" required error={errors.password?.message}>
                <Input type="password" {...register('password')} />
              </FormField>
            )}
            <FormField label="Rol" required error={errors.role?.message}>
              <Controller control={control} name="role" render={({ field }) => (
                <Select value={field.value as string} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </FormField>
            <div className="flex items-center gap-2">
              <Controller control={control} name="is_active" render={({ field }) => (
                <Checkbox id="is_active" checked={!!field.value} onCheckedChange={field.onChange} />
              )} />
              <Label htmlFor="is_active">Activo</Label>
            </div>
            {isEdit && (
              <div className="flex items-center gap-2">
                <Controller control={control} name="require_password_change" render={({ field }) => (
                  <Checkbox id="require_password_change" checked={!!field.value} onCheckedChange={field.onChange} />
                )} />
                <Label htmlFor="require_password_change">Forzar cambio de contraseña</Label>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" isLoading={isSubmitting}>{isEdit ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
