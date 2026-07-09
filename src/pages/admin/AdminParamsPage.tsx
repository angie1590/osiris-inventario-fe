import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSystemParams, useUpdateParam } from "@/features/admin/hooks";
import { useToast } from "@/hooks/use-toast";

const FIXED_PARAM_OPTIONS: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  report_include_logo: [
    { value: "true", label: "Sí (true)" },
    { value: "false", label: "No (false)" },
  ],
  stock_quantity_mode: [
    { value: "integer", label: "Entero (integer)" },
    { value: "decimal", label: "Decimal (decimal)" },
  ],
  kardex_method: [
    { value: "PEPS", label: "PEPS" },
    { value: "WEIGHTED_AVERAGE", label: "WEIGHTED_AVERAGE" },
  ],
};

const NUMERIC_PARAM_KEYS = new Set([
  "session_timeout_minutes",
  "max_export_date_range_days",
  "auth_code_expire_minutes",
  "doc_number_padding",
]);

const PARAM_HINTS: Record<string, string> = {
  kardex_method:
    "Se bloquea automáticamente cuando existen movimientos en el año fiscal vigente.",
};

const PARAM_BADGES: Record<string, string> = {
  kardex_method: "Bloqueable por movimientos",
};

function getDisplayParamValue(key: string, value: string): string {
  const options = FIXED_PARAM_OPTIONS[key];
  if (!options) return value;
  return options.find((option) => option.value === value)?.label ?? value;
}

function getApiErrorCode(err: unknown): string | undefined {
  const responseData = (err as { response?: { data?: unknown } })?.response
    ?.data as { code?: string; detail?: { code?: string } } | undefined;
  return responseData?.code ?? responseData?.detail?.code;
}

function getApiErrorMessage(err: unknown): string | undefined {
  const responseData = (err as { response?: { data?: unknown } })?.response
    ?.data as { message?: string; detail?: { message?: string } } | undefined;
  return responseData?.message ?? responseData?.detail?.message;
}

export default function AdminParamsPage() {
  const { toast } = useToast();
  const { data: params, isLoading } = useSystemParams();
  const updateParam = useUpdateParam();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isKardexMethodLocked, setIsKardexMethodLocked] = useState(false);

  const startEdit = (key: string, currentValue: string) => {
    setEditKey(key);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditKey(null);
    setEditValue("");
  };

  const saveEdit = async (key: string) => {
    const normalizedValue = editValue.trim();

    if (!normalizedValue) {
      toast({
        variant: "destructive",
        title: "Valor requerido",
        description: `El parámetro ${key} no puede quedar en blanco.`,
      });
      return;
    }

    if (NUMERIC_PARAM_KEYS.has(key) && !/^\d+$/.test(normalizedValue)) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: `El parámetro ${key} solo permite números enteros.`,
      });
      return;
    }

    try {
      await updateParam.mutateAsync({ key, value: normalizedValue });
      toast({
        variant: "success",
        title: "Actualización exitosa",
        description: `Parámetro ${key} actualizado.`,
      });
      setEditKey(null);
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      const apiMessage = getApiErrorMessage(err);
      if (code === "KARDEX_METHOD_LOCKED") {
        setIsKardexMethodLocked(true);
        setEditKey(null);
      }
      toast({
        variant: code === "KARDEX_METHOD_LOCKED" ? "warning" : "destructive",
        title:
          code === "KARDEX_METHOD_LOCKED"
            ? "Acción restringida"
            : "Error al actualizar parámetro",
        description:
          code === "KARDEX_METHOD_LOCKED"
            ? "No se puede cambiar el método Kardex mientras haya movimientos del año fiscal vigente."
            : (apiMessage ??
              `No se pudo actualizar el parámetro ${key}. Intenta nuevamente.`),
      });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Parámetros del sistema</h1>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <Skeleton className="m-3 h-48" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clave</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Última actualización</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(params ?? []).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    Sin parámetros
                  </TableCell>
                </TableRow>
              ) : (
                (params ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.key}</TableCell>
                    <TableCell>
                      {editKey === p.key ? (
                        <div className="space-y-1">
                          {PARAM_BADGES[p.key] ? (
                            <Badge
                              variant="outline"
                              className="h-5 border-amber-300 bg-amber-50 text-amber-700"
                            >
                              {PARAM_BADGES[p.key]}
                            </Badge>
                          ) : null}
                          {p.key === "kardex_method" && isKardexMethodLocked ? (
                            <Badge
                              variant="outline"
                              className="h-5 border-red-300 bg-red-50 text-red-700"
                            >
                              Bloqueado este año
                            </Badge>
                          ) : null}
                          {FIXED_PARAM_OPTIONS[p.key] ? (
                            <Select
                              value={editValue}
                              onValueChange={setEditValue}
                              disabled={
                                p.key === "kardex_method" &&
                                isKardexMethodLocked
                              }
                            >
                              <SelectTrigger className="h-7 w-44">
                                <SelectValue placeholder="Selecciona un valor" />
                              </SelectTrigger>
                              <SelectContent>
                                {FIXED_PARAM_OPTIONS[p.key].map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className="h-7 w-36"
                              value={editValue}
                              inputMode={
                                NUMERIC_PARAM_KEYS.has(p.key)
                                  ? "numeric"
                                  : undefined
                              }
                              onChange={(e) => {
                                const next = e.target.value;
                                if (NUMERIC_PARAM_KEYS.has(p.key)) {
                                  setEditValue(next.replace(/\D+/g, ""));
                                  return;
                                }
                                setEditValue(next);
                              }}
                              autoFocus
                            />
                          )}
                          {PARAM_HINTS[p.key] ? (
                            <p className="text-xs text-amber-700">
                              {PARAM_HINTS[p.key]}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{getDisplayParamValue(p.key, p.value)}</span>
                            {PARAM_BADGES[p.key] ? (
                              <Badge
                                variant="outline"
                                className="h-5 border-amber-300 bg-amber-50 text-amber-700"
                              >
                                {PARAM_BADGES[p.key]}
                              </Badge>
                            ) : null}
                            {p.key === "kardex_method" &&
                            isKardexMethodLocked ? (
                              <Badge
                                variant="outline"
                                className="h-5 border-red-300 bg-red-50 text-red-700"
                              >
                                Bloqueado este año
                              </Badge>
                            ) : null}
                          </div>
                          {PARAM_HINTS[p.key] ? (
                            <p className="text-xs text-amber-700">
                              {PARAM_HINTS[p.key]}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-64">
                      {p.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString("es-EC")}
                    </TableCell>
                    <TableCell>
                      {editKey === p.key ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => saveEdit(p.key)}
                            disabled={
                              updateParam.isPending ||
                              (p.key === "kardex_method" &&
                                isKardexMethodLocked)
                            }
                            title="Guardar"
                            aria-label="Guardar"
                          >
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                            title="Cancelar"
                            aria-label="Cancelar"
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(p.key, p.value)}
                          disabled={
                            p.key === "kardex_method" && isKardexMethodLocked
                          }
                          title={
                            p.key === "kardex_method" && isKardexMethodLocked
                              ? "Bloqueado: existen movimientos en el año fiscal vigente"
                              : "Editar parámetro"
                          }
                          aria-label="Editar parámetro"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
