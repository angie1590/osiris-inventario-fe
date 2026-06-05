import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUsers, useDeleteUser } from '@/features/admin/hooks'
import { UserFormModal } from '@/features/admin/UserFormModal'
import { useToast } from '@/hooks/use-toast'
import type { User, UserRole } from '@/types/api'

const ROLE_VARIANTS: Record<UserRole, 'default' | 'secondary' | 'destructive'> = {
  admin: 'default',
  operator: 'secondary',
  supervisor: 'secondary',
}

export default function AdminUsersPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string | undefined>()
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<User | undefined>()

  const { data: users, isLoading } = useUsers(search || undefined, role)
  const deleteUser = useDeleteUser()

  const handleDelete = async (u: User) => {
    if (!confirm(`¿Eliminar al usuario "${u.username}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteUser.mutateAsync(u.id)
      toast({ title: 'Usuario eliminado' })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
      toast({ variant: 'destructive', description: code === 'USER_HAS_ACTIVE_SESSION' ? 'El usuario tiene una sesión activa' : 'Error al eliminar' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />Nuevo usuario</Button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por usuario..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={role ?? '__all__'} onValueChange={(v) => setRole(v === '__all__' ? undefined : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los roles</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="operator">operator</SelectItem>
            <SelectItem value="supervisor">supervisor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? <Skeleton className="m-3 h-48" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).length === 0
                ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
                : (users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-sm">{u.username}</TableCell>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell><Badge variant={ROLE_VARIANTS[u.role]}>{u.role}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'default' : 'secondary'}>{u.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('es-EC')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(u)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </div>

      {showCreate && <UserFormModal onClose={() => setShowCreate(false)} />}
      {editUser && <UserFormModal user={editUser} onClose={() => setEditUser(undefined)} />}
    </div>
  )
}
