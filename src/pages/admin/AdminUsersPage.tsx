import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { SearchInput } from "@/components/shared/SearchInput";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { DetailModal } from "@/components/shared/DetailModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useUsers, useDeleteUser } from "@/features/admin/hooks";
import { UserFormModal } from "@/features/admin/UserFormModal";
import { useToast } from "@/hooks/use-toast";
import type { User, UserRole } from "@/types/api";

const ROLE_VARIANTS: Record<UserRole, "default" | "secondary" | "destructive"> =
  {
    admin: "default",
    operator: "secondary",
    supervisor: "secondary",
  };

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("es-EC");
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "secondary"}>
      {active ? "Activo" : "Inactivo"}
    </Badge>
  );
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | undefined>();
  const [viewUser, setViewUser] = useState<User | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<User | undefined>();

  const {
    data: users,
    isLoading,
    isError,
    refetch,
  } = useUsers(search || undefined, role);
  const deleteUser = useDeleteUser();

  const handleDelete = async (u: User) => {
    try {
      await deleteUser.mutateAsync(u.id);
      toast({
        variant: "success",
        title: "Eliminación exitosa",
        description: `Usuario ${u.username} eliminado.`,
      });
    } catch (err: unknown) {
      const code = (
        err as { response?: { data?: { detail?: { code?: string } } } }
      )?.response?.data?.detail?.code;
      toast({
        variant: code === "USER_HAS_ACTIVE_SESSION" ? "warning" : "destructive",
        title:
          code === "USER_HAS_ACTIVE_SESSION"
            ? "Acción restringida"
            : "Error al eliminar usuario",
        description:
          code === "USER_HAS_ACTIVE_SESSION"
            ? "El usuario tiene una sesión activa."
            : `No se pudo eliminar al usuario ${u.username}.`,
      });
      throw err;
    }
  };

  const columns: Column<User>[] = [
    {
      key: "username",
      header: "Usuario",
      sortable: true,
      sortAccessor: (u) => u.username,
      cell: (u) => <span className="font-mono text-sm">{u.username}</span>,
    },
    {
      key: "full_name",
      header: "Nombre",
      sortable: true,
      sortAccessor: (u) => u.full_name,
      cell: (u) => u.full_name,
    },
    {
      key: "role",
      header: "Rol",
      sortable: true,
      sortAccessor: (u) => u.role,
      cell: (u) => <Badge variant={ROLE_VARIANTS[u.role]}>{u.role}</Badge>,
    },
    {
      key: "is_active",
      header: "Estado",
      sortable: true,
      sortAccessor: (u) => (u.is_active ? 1 : 0),
      cell: (u) => <StatusBadge active={u.is_active} />,
    },
    {
      key: "created_at",
      header: "Creado",
      sortable: true,
      sortAccessor: (u) => new Date(u.created_at),
      cell: (u) => (
        <span className="text-sm text-muted-foreground">
          {fmtDate(u.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (u) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setViewUser(u)}>
            Ver
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(u)}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usuarios"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por usuario..."
        />
        <Select
          value={role ?? "__all__"}
          onValueChange={(v) => setRole(v === "__all__" ? undefined : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los roles</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="operator">operator</SelectItem>
            <SelectItem value="supervisor">supervisor</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={users ?? []}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyHeading="No hay usuarios registrados"
        emptyDescription="Crea el primer usuario con el botón “Nuevo usuario”."
      />

      {showCreate && <UserFormModal onClose={() => setShowCreate(false)} />}
      {editUser && (
        <UserFormModal user={editUser} onClose={() => setEditUser(undefined)} />
      )}

      {viewUser && (
        <DetailModal
          open
          onClose={() => setViewUser(undefined)}
          title={viewUser.full_name}
          subtitle={`@${viewUser.username}`}
          size="sm"
          sections={[
            {
              fields: [
                {
                  label: "Usuario",
                  value: <span className="font-mono">{viewUser.username}</span>,
                },
                { label: "Nombre completo", value: viewUser.full_name },
                {
                  label: "Rol",
                  value: (
                    <Badge variant={ROLE_VARIANTS[viewUser.role]}>
                      {viewUser.role}
                    </Badge>
                  ),
                },
                {
                  label: "Estado",
                  value: <StatusBadge active={viewUser.is_active} />,
                },
                {
                  label: "Debe cambiar contraseña",
                  value: viewUser.require_password_change ? "Sí" : "No",
                },
                { label: "Creado", value: fmtDate(viewUser.created_at) },
                {
                  label: "Última modificación",
                  value: fmtDate(viewUser.updated_at),
                },
              ],
            },
          ]}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(undefined)}
          title="Eliminar usuario"
          description={
            <>
              ¿Eliminar al usuario <strong>{deleteTarget.username}</strong>?
              Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
