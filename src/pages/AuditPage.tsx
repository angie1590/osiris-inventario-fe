import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Download, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { DetailModal } from "@/components/shared/DetailModal";
import {
  DateRangeFilter,
  type DateRange,
  currentMonthRange,
} from "@/features/reports/DateRangeFilter";
import {
  useAuditLogs,
  useAuditUsers,
  type AuditFilters,
} from "@/features/audit/hooks";
import { useCategories } from "@/features/catalog/hooks";
import { buildCategoryPath } from "@/features/catalog/categoryPath";
import { downloadBlob } from "@/lib/download";
import { differenceInDays, parseISO } from "date-fns";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AuditAction, AuditLog } from "@/types/api";

const ACTIONS: AuditAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "CANCEL",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "SESSION_EXPIRED",
  "PASSWORD_CHANGED",
];

const ACTION_VARIANTS: Partial<
  Record<AuditAction, "default" | "secondary" | "destructive">
> = {
  CREATE: "default",
  DELETE: "destructive",
  CANCEL: "destructive",
  APPROVE: "default",
  LOGIN: "secondary",
  LOGOUT: "secondary",
};

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
  APPROVE: "Aprobación",
  REJECT: "Rechazo",
  CANCEL: "Anulación",
  LOGIN: "Inicio de sesión",
  LOGIN_FAILED: "Inicio de sesión fallido",
  LOGOUT: "Cierre de sesión",
  SESSION_EXPIRED: "Sesión expirada",
  PASSWORD_CHANGED: "Cambio de contraseña",
};

const ENTITY_TYPE_OPTIONS = [
  { value: "user", label: "Usuarios (user)" },
  { value: "product", label: "Productos (product)" },
  { value: "category", label: "Categorías (category)" },
  { value: "inventory", label: "Inventario (inventory)" },
  { value: "kardex", label: "Kardex (kardex)" },
  {
    value: "company_config",
    label: "Configuración de empresa (company_config)",
  },
  { value: "system_param", label: "Parámetros de sistema (system_param)" },
  { value: "audit_log", label: "Auditoría (audit_log)" },
];

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;

  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lower.indexOf(needle, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <span
        key={`${idx}-${needle}`}
        className="rounded bg-cyan-100 px-0.5 text-cyan-900"
      >
        {text.slice(idx, idx + needle.length)}
      </span>,
    );
    cursor = idx + needle.length;
  }

  return parts;
}

function localizeDescription(description: string | null): string {
  if (!description) return "—";

  if (description === "Successful login") return "Inicio de sesión exitoso";
  if (description === "User logged out") return "Cierre de sesión";
  if (description === "Password changed") return "Contraseña actualizada";

  const failed = description.match(/^Failed login attempt for '(.+)'$/);
  if (failed) return `Intento fallido de inicio de sesión para '${failed[1]}'`;

  const updated = description.match(/^User '(.+)' updated$/);
  if (updated) return `Usuario '${updated[1]}' actualizado`;

  const created = description.match(/^User '(.+)' created$/);
  if (created) return `Usuario '${created[1]}' creado`;

  const deactivated = description.match(/^User '(.+)' deactivated$/);
  if (deactivated) return `Usuario '${deactivated[1]}' desactivado`;

  return description;
}

function localizeEntityType(entityType: string | null): string {
  if (!entityType) return "—";
  return (
    ENTITY_TYPE_OPTIONS.find((option) => option.value === entityType)?.label ??
    entityType
  );
}

const FIELD_LABELS: Record<string, string> = {
  isbn: "Código de barras",
  codigo_interno: "Código interno",
  name: "Nombre",
  description: "Descripción",
  pvp: "PVP",
  stock_minimo: "Stock mínimo",
  category_id: "Categoría",
  category_name: "Categoría",
  photo: "Foto",
  photos: "Fotos",
  custom_attributes: "Atributos personalizados",
  full_name: "Nombre completo",
  role: "Rol",
  is_active: "Estado activo",
  must_change_password: "Debe cambiar contraseña",
  username: "Usuario",
  username_attempt: "Usuario intentado",
  reason: "Motivo",
};

const FIELD_VALUE_LABELS: Record<string, Record<string, string>> = {
  reason: {
    invalid_credentials: "Credenciales inválidas",
    account_inactive: "Cuenta inactiva",
  },
};

const PHOTO_FIELDS = new Set(["photo", "photos", "logo"]);
const MAX_AUDIT_VALUE_LENGTH = 220;

type AttrChange = {
  key: string;
  before: unknown;
  after: unknown;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getCustomAttributeChanges(
  before: unknown,
  after: unknown,
): AttrChange[] {
  const beforeObj = toRecord(before);
  const afterObj = toRecord(after);
  const keys = Array.from(
    new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]),
  );
  return keys
    .filter(
      (key) => JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key]),
    )
    .map((key) => ({ key, before: beforeObj[key], after: afterObj[key] }));
}

function truncateAuditValue(value: string): string {
  if (value.length <= MAX_AUDIT_VALUE_LENGTH) return value;
  return `${value.slice(0, MAX_AUDIT_VALUE_LENGTH)}...`;
}

function toDisplayValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (PHOTO_FIELDS.has(key) && typeof value === "string") {
    if (value.startsWith("data:image/")) {
      return `Imagen embebida base64 (${value.length} caracteres)`;
    }
    return truncateAuditValue(value);
  }
  if (PHOTO_FIELDS.has(key) && Array.isArray(value)) {
    return `${value.length} imagen(es)`;
  }
  if (typeof value === "string") {
    return truncateAuditValue(FIELD_VALUE_LABELS[key]?.[value] ?? value);
  }
  if (typeof value === "object") {
    const serialized = JSON.stringify(value);
    return truncateAuditValue(serialized);
  }
  return String(value);
}

function AuditChanges({
  log,
  categoryById,
}: {
  log: AuditLog;
  categoryById: (id: unknown) => string;
}) {
  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const before = log.previous_values ?? {};
  const after = log.new_values ?? {};
  const allKeys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  );
  const keys = allKeys.filter((key) => key !== "category_name");
  const customAttrChanges = getCustomAttributeChanges(
    before.custom_attributes,
    after.custom_attributes,
  );

  if (keys.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin metadatos adicionales para este registro.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-130 text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">Atributo</th>
            <th className="px-2 py-1.5 text-left font-semibold">Anterior</th>
            <th className="px-2 py-1.5 text-left font-semibold">Nuevo</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={`${log.id}-${key}`} className="border-t">
              <td className="px-2 py-1.5 font-medium">
                {FIELD_LABELS[key] ?? key}
              </td>
              <td className="max-w-[360px] break-all px-2 py-1.5 text-muted-foreground">
                {key === "category_id"
                  ? categoryById(before[key])
                  : key === "custom_attributes"
                    ? customAttrChanges.length > 0
                      ? `${customAttrChanges.length} atributo(s) modificado(s)`
                      : "Sin cambios"
                    : toDisplayValue(key, before[key])}
              </td>
              <td className="max-w-[360px] break-all px-2 py-1.5">
                {key === "category_id" ? (
                  categoryById(after[key])
                ) : key === "custom_attributes" ? (
                  customAttrChanges.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span>{customAttrChanges.length} cambio(s)</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setAttrModalOpen(true)}
                      >
                        Ver cambios
                      </Button>
                    </div>
                  ) : (
                    "Sin cambios"
                  )
                ) : (
                  toDisplayValue(key, after[key])
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {attrModalOpen && (
        <DetailModal
          open
          onClose={() => setAttrModalOpen(false)}
          title="Cambios en atributos personalizados"
          subtitle={`${customAttrChanges.length} atributo(s) modificado(s)`}
          size="lg"
          sections={[
            {
              content: (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-130 text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold">
                          Atributo
                        </th>
                        <th className="px-2 py-1.5 text-left font-semibold">
                          Anterior
                        </th>
                        <th className="px-2 py-1.5 text-left font-semibold">
                          Nuevo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customAttrChanges.map((change) => (
                        <tr
                          key={`${log.id}-attr-${change.key}`}
                          className="border-t"
                        >
                          <td className="px-2 py-1.5 font-medium">
                            {change.key}
                          </td>
                          <td className="max-w-[360px] break-all px-2 py-1.5 text-muted-foreground">
                            {toDisplayValue("attr_before", change.before)}
                          </td>
                          <td className="max-w-[360px] break-all px-2 py-1.5">
                            {toDisplayValue("attr_after", change.after)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

export default function AuditPage() {
  const { toast } = useToast();
  const [range, setRange] = useState<DateRange>(currentMonthRange());
  const [action, setAction] = useState<AuditAction | undefined>();
  const [userOpen, setUserOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userId, setUserId] = useState<number | undefined>();
  const [selectedUserLabel, setSelectedUserLabel] =
    useState<string>("Todos los usuarios");
  const [entityTypeOpen, setEntityTypeOpen] = useState(false);
  const [entityTypeQuery, setEntityTypeQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [cursor, setCursor] = useState<number | undefined>();
  const [viewLog, setViewLog] = useState<AuditLog | undefined>();
  const { data: users, isLoading: usersLoading } = useAuditUsers(
    userQuery || undefined,
  );
  const { data: categories } = useCategories();
  const categoryById = (id: unknown): string => {
    const n = typeof id === "string" ? Number(id) : id;
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return buildCategoryPath(categories ?? [], n);
  };
  const currentUserLabel = userId
    ? users?.find((u) => u.id === userId)
      ? `${users.find((u) => u.id === userId)!.full_name} (${users.find((u) => u.id === userId)!.username})`
      : selectedUserLabel
    : "Todos los usuarios";

  const filters: AuditFilters = {
    date_from: range.date_from,
    date_to: range.date_to,
    user_id: userId,
    action,
    entity_type: entityType || undefined,
    cursor,
  };

  const selectedEntityTypeLabel = entityType
    ? (ENTITY_TYPE_OPTIONS.find((option) => option.value === entityType)
        ?.label ?? `Otro (${entityType})`)
    : "Todas las entidades";
  const filteredEntityTypes = ENTITY_TYPE_OPTIONS.filter((option) => {
    const q = entityTypeQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      option.label.toLowerCase().includes(q) ||
      option.value.toLowerCase().includes(q)
    );
  });

  const { data: logs, isLoading, isError, refetch } = useAuditLogs(filters);

  const columns: Column<AuditLog>[] = [
    {
      key: "timestamp",
      header: "Fecha/hora",
      sortable: true,
      sortAccessor: (l) => new Date(l.timestamp),
      cell: (l) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(l.timestamp).toLocaleString("es-EC")}
        </span>
      ),
    },
    {
      key: "username",
      header: "Usuario",
      sortable: true,
      sortAccessor: (l) => l.username ?? "",
      cell: (l) => <span className="text-sm">{l.username ?? "—"}</span>,
    },
    {
      key: "action",
      header: "Acción",
      sortable: true,
      sortAccessor: (l) => ACTION_LABELS[l.action] ?? l.action,
      cell: (l) => (
        <Badge
          variant={ACTION_VARIANTS[l.action] ?? "secondary"}
          className="text-xs"
        >
          {ACTION_LABELS[l.action] ?? l.action}
        </Badge>
      ),
    },
    {
      key: "entity_type",
      header: "Entidad",
      sortable: true,
      sortAccessor: (l) => l.entity_type ?? "",
      cell: (l) => (
        <span className="text-sm">{localizeEntityType(l.entity_type)}</span>
      ),
    },
    {
      key: "ip_address",
      header: "IP",
      sortable: true,
      sortAccessor: (l) => l.ip_address ?? "",
      cell: (l) => (
        <span className="text-xs text-muted-foreground">
          {l.ip_address ?? "—"}
        </span>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      sortable: true,
      sortAccessor: (l) => localizeDescription(l.description),
      cell: (l) => (
        <span
          className="block max-w-80 text-xs wrap-break-word"
          title={localizeDescription(l.description)}
        >
          {localizeDescription(l.description)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (l) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setViewLog(l)}
          title="Ver detalle"
          aria-label="Ver detalle"
        >
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  const handleExport = async () => {
    const days = differenceInDays(
      parseISO(range.date_to),
      parseISO(range.date_from),
    );
    if (days > 90) {
      toast({
        variant: "destructive",
        description: "El rango de exportación no puede superar 90 días",
      });
      return;
    }
    try {
      const res = await api.get("/audit/export", {
        params: {
          date_from: range.date_from,
          date_to: range.date_to,
          action,
          entity_type: entityType || undefined,
        },
        responseType: "blob",
      });
      downloadBlob(res, `auditoria_${range.date_from}_${range.date_to}.xlsx`);
    } catch {
      toast({ variant: "destructive", description: "Error al exportar" });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Auditoría"
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel (máx. 90 días)
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <DateRangeFilter
          onApply={(r) => {
            setRange(r);
            setCursor(undefined);
          }}
          defaultValues={range}
        />
        <div className="space-y-1">
          <Label className="text-xs">Acción</Label>
          <Select
            value={action ?? "__all__"}
            onValueChange={(v) =>
              setAction(v === "__all__" ? undefined : (v as AuditAction))
            }
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABELS[a] ?? a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Usuario</Label>
          <PopoverPrimitive.Root open={userOpen} onOpenChange={setUserOpen}>
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={userOpen}
                className={cn(
                  "flex h-8 w-56 items-center justify-between whitespace-nowrap rounded-lg border border-input bg-white px-3 text-sm shadow-token-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="truncate">{currentUserLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                className={cn(
                  "w-(--radix-popover-trigger-width) rounded-md border bg-popover p-0 shadow-md",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out",
                  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                )}
                style={{ zIndex: 350 }}
                align="start"
                sideOffset={4}
              >
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Buscar usuario..."
                    className="h-7 border-none p-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1" role="listbox">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                      "cursor-pointer hover:bg-accent",
                      !userId && "bg-primary/10 font-medium",
                    )}
                    onClick={() => {
                      setUserId(undefined);
                      setSelectedUserLabel("Todos los usuarios");
                      setUserOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate text-left">
                      Todos los usuarios
                    </span>
                    {!userId && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                  {usersLoading ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      Cargando...
                    </p>
                  ) : (users ?? []).length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      Sin resultados
                    </p>
                  ) : (
                    (users ?? []).map((u) => {
                      const label = `${u.full_name} (${u.username})`;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                            "cursor-pointer hover:bg-accent",
                            userId === u.id && "bg-primary/10 font-medium",
                          )}
                          onClick={() => {
                            setUserId(u.id);
                            setSelectedUserLabel(label);
                            setUserOpen(false);
                          }}
                        >
                          <span className="flex-1 truncate text-left">
                            {highlightMatch(label, userQuery)}
                          </span>
                          {userId === u.id && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo entidad</Label>
          <PopoverPrimitive.Root
            open={entityTypeOpen}
            onOpenChange={setEntityTypeOpen}
          >
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={entityTypeOpen}
                className={cn(
                  "flex h-8 w-64 items-center justify-between whitespace-nowrap rounded-lg border border-input bg-white px-3 text-sm shadow-token-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="truncate">{selectedEntityTypeLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                className={cn(
                  "w-(--radix-popover-trigger-width) rounded-md border bg-popover p-0 shadow-md",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out",
                  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                )}
                style={{ zIndex: 350 }}
                align="start"
                sideOffset={4}
              >
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={entityTypeQuery}
                    onChange={(e) => setEntityTypeQuery(e.target.value)}
                    placeholder="Buscar tipo de entidad..."
                    className="h-7 border-none p-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1" role="listbox">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                      "cursor-pointer hover:bg-accent",
                      !entityType && "bg-primary/10 font-medium",
                    )}
                    onClick={() => {
                      setEntityType("");
                      setEntityTypeOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate text-left">
                      Todas las entidades
                    </span>
                    {!entityType && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                  {filteredEntityTypes.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      Sin resultados
                    </p>
                  ) : (
                    filteredEntityTypes.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                          "cursor-pointer hover:bg-accent",
                          entityType === option.value &&
                            "bg-primary/10 font-medium",
                        )}
                        onClick={() => {
                          setEntityType(option.value);
                          setEntityTypeOpen(false);
                        }}
                      >
                        <span className="flex-1 truncate text-left">
                          {highlightMatch(option.label, entityTypeQuery)}
                        </span>
                        {entityType === option.value && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs ?? []}
        rowKey={(l) => l.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        defaultSort={{ key: "timestamp", dir: "desc" }}
        emptyHeading="Sin resultados"
        emptyDescription="Ajusta los filtros para encontrar registros de auditoría."
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!cursor}
          onClick={() => setCursor(undefined)}
        >
          Primera página
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!logs || logs.length < 50}
          onClick={() => setCursor(logs?.[logs.length - 1]?.id)}
        >
          Siguiente →
        </Button>
      </div>

      {viewLog && (
        <DetailModal
          open
          onClose={() => setViewLog(undefined)}
          title="Detalle de auditoría"
          subtitle={new Date(viewLog.timestamp).toLocaleString("es-EC")}
          size="lg"
          sections={[
            {
              fields: [
                { label: "Usuario", value: viewLog.username ?? "—" },
                {
                  label: "Acción",
                  value: (
                    <Badge
                      variant={ACTION_VARIANTS[viewLog.action] ?? "secondary"}
                    >
                      {viewLog.action}
                    </Badge>
                  ),
                },
                {
                  label: "Entidad",
                  value: localizeEntityType(viewLog.entity_type),
                },
                { label: "ID entidad", value: viewLog.entity_id ?? "—" },
                { label: "IP", value: viewLog.ip_address ?? "—" },
                {
                  label: "Fecha",
                  value: new Date(viewLog.timestamp).toLocaleString("es-EC"),
                },
                {
                  label: "Descripción",
                  value: localizeDescription(viewLog.description),
                  full: true,
                },
              ],
            },
            {
              title: "Detalle de cambios",
              content: (
                <AuditChanges log={viewLog} categoryById={categoryById} />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
