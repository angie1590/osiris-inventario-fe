import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Link, Pencil, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import {
  useCompanyConfig,
  useCreateCompany,
  useUpdateCompany,
} from "@/features/admin/hooks";
import { useToast } from "@/hooks/use-toast";
import type { BajaReason, EgresoType, IngresoType } from "@/types/api";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_INGRESO_TYPES: IngresoType[] = [
  "purchase",
  "initial_inventory",
  "adjustment_positive",
  "customer_return",
  "production",
  "transfer_received",
  "other",
];
const DEFAULT_EGRESO_TYPES: EgresoType[] = [
  "sale",
  "baja",
  "adjustment_negative",
  "supplier_return",
  "internal_consumption",
  "transfer_sent",
  "other",
];
const DEFAULT_BAJA_REASONS: BajaReason[] = [
  "damage",
  "expiration",
  "loss",
  "theft",
  "donation",
  "gift",
  "destruction",
  "sample",
  "other",
];
const INGRESO_TYPE_LABELS: Record<IngresoType, string> = {
  purchase: "Compra",
  initial_inventory: "Inventario inicial",
  adjustment_positive: "Ajuste positivo",
  customer_return: "Devolución de cliente",
  production: "Producción",
  transfer_received: "Transferencia recibida",
  other: "Otro",
};
const INGRESO_TYPE_DESCRIPTIONS: Record<IngresoType, string> = {
  purchase: "Registra mercancía adquirida a un proveedor.",
  initial_inventory: "Registra las existencias con las que inicia la operación del sistema.",
  adjustment_positive: "Corrige el inventario cuando el stock físico es mayor al registrado.",
  customer_return: "Reingresa productos devueltos por un cliente.",
  production: "Incorpora productos fabricados o ensamblados por la empresa.",
  transfer_received: "Recibe productos provenientes de otra bodega o sucursal.",
  other: "Registra cualquier ingreso que no corresponda a los tipos anteriores.",
};
const EGRESO_TYPE_LABELS: Record<EgresoType, string> = {
  sale: "Venta",
  baja: "Baja",
  adjustment_negative: "Ajuste negativo",
  supplier_return: "Devolución a proveedor",
  internal_consumption: "Consumo interno",
  transfer_sent: "Transferencia enviada",
  other: "Otro",
};
const EGRESO_TYPE_DESCRIPTIONS: Record<EgresoType, string> = {
  sale: "Utilice esta opción para registrar productos vendidos a un cliente.",
  baja: "Utilice esta opción para retirar productos del inventario por baja.",
  adjustment_negative:
    "Utilice esta opción cuando el conteo físico sea menor al registrado en el sistema.",
  supplier_return:
    "Utilice esta opción para devolver productos previamente adquiridos a un proveedor.",
  internal_consumption:
    "Utilice esta opción para registrar productos utilizados por la empresa y que no serán comercializados.",
  transfer_sent:
    "Utilice esta opción para enviar productos a otra bodega o sucursal.",
  other:
    "Utilice esta opción para registrar salidas no contempladas en las demás categorías.",
};
const BAJA_REASON_LABELS: Record<BajaReason, string> = {
  damage: "Daño",
  expiration: "Caducidad",
  loss: "Pérdida",
  theft: "Robo",
  donation: "Donación",
  gift: "Obsequio",
  destruction: "Destrucción",
  sample: "Muestra",
  other: "Otro",
};
const BAJA_REASON_DESCRIPTIONS: Record<BajaReason, string> = {
  damage: "Retiro de productos dañados o inutilizables.",
  expiration: "Retiro de productos vencidos o fuera de vida útil.",
  loss: "Retiro por extravío o pérdida.",
  theft: "Retiro por sustracción o robo.",
  donation: "Retiro por entrega gratuita a terceros.",
  gift: "Retiro por obsequio.",
  destruction: "Retiro por destrucción controlada.",
  sample: "Retiro por uso como muestra.",
  other: "Otro motivo no contemplado.",
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const toUpper = (value: string) => value.toUpperCase();

function mod10CheckDigit(base9: string): number {
  const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let total = 0;
  for (let i = 0; i < 9; i += 1) {
    let val = Number(base9[i]) * coefs[i];
    if (val >= 10) val -= 9;
    total += val;
  }
  const check = 10 - (total % 10);
  return check === 10 ? 0 : check;
}

function isValidEcuadorianRuc(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;

  const province = Number(ruc.slice(0, 2));
  if (province < 1 || province > 24) return false;

  const third = Number(ruc[2]);

  if (third >= 0 && third <= 5) {
    const verifier = mod10CheckDigit(ruc.slice(0, 9));
    if (verifier !== Number(ruc[9])) return false;
    return ruc.slice(10) !== "000";
  }

  if (third === 6) {
    const coefs = [3, 2, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < 8; i += 1) total += Number(ruc[i]) * coefs[i];
    let check = 11 - (total % 11);
    if (check === 11) check = 0;
    if (check === 10) return false;
    if (check !== Number(ruc[8])) return false;
    return ruc.slice(9) !== "0000";
  }

  if (third === 9) {
    const coefs = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < 9; i += 1) total += Number(ruc[i]) * coefs[i];
    let check = 11 - (total % 11);
    if (check === 11) check = 0;
    if (check === 10) return false;
    if (check !== Number(ruc[9])) return false;
    return ruc.slice(10) !== "000";
  }

  return false;
}

const schema = z.object({
  razon_social: z.string().trim().min(1, "Requerido").transform(toUpper),
  ruc: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((value) => /^\d{13}$/.test(value), "RUC debe tener 13 dígitos")
    .refine(isValidEcuadorianRuc, "RUC ecuatoriano inválido"),
  email: z
    .string()
    .trim()
    .min(1, "Requerido")
    .email("Correo electrónico inválido")
    .transform(toUpper),
  nombre_comercial: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().toUpperCase()),
  direccion: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().toUpperCase()),
  telefono: z
    .string()
    .optional()
    .transform((v) => onlyDigits(v ?? ""))
    .refine(
      (value) => !value || /^\d+$/.test(value),
      "Teléfono debe contener solo dígitos",
    ),
  enabled_ingreso_types: z
    .array(
      z.enum([
        "purchase",
        "initial_inventory",
        "adjustment_positive",
        "customer_return",
        "production",
        "transfer_received",
        "other",
      ]),
    )
    .min(1, "Selecciona al menos un tipo de ingreso"),
  enabled_egreso_types: z
    .array(
      z.enum([
        "sale",
        "baja",
        "adjustment_negative",
        "supplier_return",
        "internal_consumption",
        "transfer_sent",
        "other",
      ]),
    )
    .min(1, "Selecciona al menos un tipo de egreso"),
  enabled_baja_reasons: z
    .array(
      z.enum([
        "damage",
        "expiration",
        "loss",
        "theft",
        "donation",
        "gift",
        "destruction",
        "sample",
        "other",
      ]),
    )
    .min(1, "Selecciona al menos un motivo de baja"),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

type ApiError = {
  response?: {
    data?: {
      code?: string;
      message?: string;
      errors?: Record<string, string>;
    };
  };
};

function ViewField({ label, value }: { label: string; value?: string | null }) {
  const normalized = typeof value === "string" ? value.toUpperCase() : value;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{normalized || "—"}</p>
    </div>
  );
}

export default function AdminCompanyPage() {
  const { toast } = useToast();
  const { data: company, isLoading } = useCompanyConfig();
  const create = useCreateCompany();
  const update = useUpdateCompany();

  const [editing, setEditing] = useState(false);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoTab, setLogoTab] = useState<"file" | "url">("file");
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!company;
  const showForm = !company || editing;
  const persistedIngresoTypes = company?.enabled_ingreso_types ?? [];
  const persistedEgresoTypes = company?.enabled_egreso_types ?? [];
  const persistedBajaReasons = company?.enabled_baja_reasons ?? [];
  const editableIngresoTypes = persistedIngresoTypes;
  const editableEgresoTypes = persistedEgresoTypes;
  const editableBajaReasons = persistedBajaReasons;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
    setValue,
    watch,
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    values: company
      ? {
          razon_social: company.razon_social,
          ruc: company.ruc,
          email: company.email,
          nombre_comercial: company.nombre_comercial ?? "",
          direccion: company.direccion ?? "",
          telefono: company.telefono ?? "",
          enabled_ingreso_types: editableIngresoTypes,
          enabled_egreso_types: editableEgresoTypes,
          enabled_baja_reasons: editableBajaReasons,
        }
      : undefined,
    defaultValues: {
      enabled_ingreso_types: DEFAULT_INGRESO_TYPES,
      enabled_egreso_types: DEFAULT_EGRESO_TYPES,
      enabled_baja_reasons: DEFAULT_BAJA_REASONS,
    },
  });

  const currentLogoSrc = logoPreview ?? company?.logo ?? null;

  function startEditing() {
    setFormError(null);
    setLogo(undefined);
    setLogoPreview(null);
    setLogoUrl("");
    setLogoTab("file");
    setEditing(true);
  }

  function cancelEditing() {
    setFormError(null);
    setLogo(undefined);
    setLogoPreview(null);
    setLogoUrl("");
    if (company) {
      reset({
        razon_social: company.razon_social,
        ruc: company.ruc,
        email: company.email,
        nombre_comercial: company.nombre_comercial ?? "",
        direccion: company.direccion ?? "",
        telefono: company.telefono ?? "",
        enabled_ingreso_types: editableIngresoTypes,
        enabled_egreso_types: editableEgresoTypes,
        enabled_baja_reasons: editableBajaReasons,
      });
    }
    setEditing(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES) {
      setFormError("El logo debe pesar máximo 2 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setLogo(result);
      setLogoPreview(result);
    };
    reader.readAsDataURL(file);
  }

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    const logoValue = logoTab === "url" ? logoUrl || undefined : logo;
    const payload = {
      razon_social: data.razon_social,
      ruc: data.ruc,
      email: data.email,
      nombre_comercial: data.nombre_comercial || undefined,
      direccion: data.direccion || undefined,
      telefono: data.telefono || undefined,
      enabled_ingreso_types: data.enabled_ingreso_types,
      enabled_egreso_types: data.enabled_egreso_types,
      enabled_baja_reasons: data.enabled_baja_reasons,
      ...(logoValue !== undefined && { logo: logoValue }),
    };

    try {
      if (isEdit) {
        await update.mutateAsync(payload);
        toast({ title: "Configuración actualizada" });
      } else {
        await create.mutateAsync(payload);
        toast({ title: "Configuración guardada" });
      }
      setLogo(undefined);
      setLogoPreview(null);
      setLogoUrl("");
      setEditing(false);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const fieldErrors = apiErr?.response?.data?.errors;
      const msg =
        apiErr?.response?.data?.message ?? "Error al guardar la configuración";

      if (fieldErrors) {
        const knownFields: (keyof FormInput)[] = [
          "razon_social",
          "ruc",
          "email",
          "nombre_comercial",
          "direccion",
          "telefono",
          "enabled_ingreso_types",
          "enabled_egreso_types",
          "enabled_baja_reasons",
        ];
        knownFields.forEach((field) => {
          if (fieldErrors[field]) {
            setError(field, { message: fieldErrors[field] });
          }
        });
      }

      setFormError(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!showForm && company) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Configuración de Empresa"
          actions={
            <Button onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          }
        />

        <Section title="Datos de la empresa">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ViewField label="Razón Social" value={company.razon_social} />
            </div>
            <ViewField
              label="Nombre Comercial"
              value={company.nombre_comercial}
            />
            <ViewField label="RUC" value={company.ruc} />
            <ViewField label="Email" value={company.email} />
            <ViewField label="Teléfono" value={company.telefono} />
            <div className="sm:col-span-2">
              <ViewField label="Dirección" value={company.direccion} />
            </div>
            <div className="sm:col-span-2 space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tipos de ingreso habilitados
              </p>
              <p className="text-sm">
                {persistedIngresoTypes.length
                  ? persistedIngresoTypes
                      .map((type) => INGRESO_TYPE_LABELS[type])
                      .join(", ")
                  : "—"}
              </p>
            </div>
            <div className="sm:col-span-2 space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tipos de egreso habilitados
              </p>
              <p className="text-sm">
                {persistedEgresoTypes.length
                  ? persistedEgresoTypes
                      .map((type) => EGRESO_TYPE_LABELS[type])
                      .join(", ")
                  : "—"}
              </p>
            </div>
            <div className="sm:col-span-2 space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Motivos de baja habilitados
              </p>
              <p className="text-sm">
                {persistedBajaReasons.length
                  ? persistedBajaReasons
                      .map((reason) => BAJA_REASON_LABELS[reason])
                      .join(", ")
                  : "—"}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Logo">
          {company.logo ? (
            <img
              src={company.logo}
              alt="Logo de la empresa"
              className="h-20 max-w-64 rounded border object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Sin logo configurado
            </div>
          )}
        </Section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Configuración de Empresa" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Section title="Datos de la empresa">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Razón Social"
              required
              error={errors.razon_social?.message}
              className="col-span-2"
            >
              <Input
                id="razon_social"
                {...register("razon_social", {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
            </FormField>

            <FormField
              label="Nombre Comercial"
              error={errors.nombre_comercial?.message}
            >
              <Input
                id="nombre_comercial"
                {...register("nombre_comercial", {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
            </FormField>

            <FormField label="RUC" required error={errors.ruc?.message}>
              <Input
                id="ruc"
                inputMode="numeric"
                maxLength={13}
                {...register("ruc", {
                  onChange: (e) => {
                    e.target.value = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 13);
                  },
                })}
              />
            </FormField>

            <FormField label="Email" required error={errors.email?.message}>
              <Input
                id="email"
                type="text"
                {...register("email", {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
            </FormField>

            <FormField label="Teléfono" error={errors.telefono?.message}>
              <Input
                id="telefono"
                inputMode="numeric"
                maxLength={15}
                {...register("telefono", {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, "");
                  },
                })}
              />
            </FormField>

            <FormField
              label="Dirección"
              error={errors.direccion?.message}
              className="col-span-2"
            >
              <Input
                id="direccion"
                {...register("direccion", {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
            </FormField>

            <div className="col-span-2 space-y-2">
              <p className="text-sm font-semibold">Tipos de ingreso habilitados</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(INGRESO_TYPE_LABELS) as IngresoType[]).map(
                  (type) => (
                    <label
                      key={type}
                      className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                    >
                      <Checkbox
                        checked={
                          !!watch("enabled_ingreso_types")?.includes(type)
                        }
                        onCheckedChange={(checked) => {
                          const current = watch("enabled_ingreso_types") ?? [];
                          const next = checked
                            ? Array.from(new Set([...current, type]))
                            : current.filter((item) => item !== type);
                          setValue("enabled_ingreso_types", next, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }}
                      />
                      <div className="space-y-1">
                        <p className="font-medium">{INGRESO_TYPE_LABELS[type]}</p>
                        <p className="text-xs text-muted-foreground">
                          {INGRESO_TYPE_DESCRIPTIONS[type]}
                        </p>
                      </div>
                    </label>
                  ),
                )}
              </div>
              {errors.enabled_ingreso_types?.message && (
                <p className="text-sm text-destructive">
                  {errors.enabled_ingreso_types.message}
                </p>
              )}
            </div>

            <div className="col-span-2 space-y-2">
              <p className="text-sm font-semibold">Tipos de egreso habilitados</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(EGRESO_TYPE_LABELS) as EgresoType[]).map((type) => (
                  <label
                    key={type}
                    className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={!!watch("enabled_egreso_types")?.includes(type)}
                      onCheckedChange={(checked) => {
                        const current = watch("enabled_egreso_types") ?? [];
                        const next = checked
                          ? Array.from(new Set([...current, type]))
                          : current.filter((item) => item !== type);
                        setValue("enabled_egreso_types", next, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                    />
                    <div className="space-y-1">
                      <p className="font-medium">{EGRESO_TYPE_LABELS[type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {EGRESO_TYPE_DESCRIPTIONS[type]}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.enabled_egreso_types?.message && (
                <p className="text-sm text-destructive">
                  {errors.enabled_egreso_types.message}
                </p>
              )}
            </div>

            <div className="col-span-2 space-y-2">
              <p className="text-sm font-semibold">Motivos de baja habilitados</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(BAJA_REASON_LABELS) as BajaReason[]).map((type) => (
                  <label
                    key={type}
                    className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={!!watch("enabled_baja_reasons")?.includes(type)}
                      onCheckedChange={(checked) => {
                        const current = watch("enabled_baja_reasons") ?? [];
                        const next = checked
                          ? Array.from(new Set([...current, type]))
                          : current.filter((item) => item !== type);
                        setValue("enabled_baja_reasons", next, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                    />
                    <div className="space-y-1">
                      <p className="font-medium">{BAJA_REASON_LABELS[type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {BAJA_REASON_DESCRIPTIONS[type]}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.enabled_baja_reasons?.message && (
                <p className="text-sm text-destructive">
                  {errors.enabled_baja_reasons.message}
                </p>
              )}
            </div>
          </div>
        </Section>

        <Section title="Logo">
          {currentLogoSrc && (
            <div className="flex items-center gap-3">
              <img
                src={currentLogoSrc}
                alt="Logo actual"
                className="h-16 max-w-48 rounded border object-contain"
              />
              <span className="text-xs text-muted-foreground">Logo actual</span>
            </div>
          )}

          <Tabs
            value={logoTab}
            onValueChange={(v) => setLogoTab(v as "file" | "url")}
          >
            <TabsList>
              <TabsTrigger value="file">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Subir archivo
              </TabsTrigger>
              <TabsTrigger value="url">
                <Link className="mr-1.5 h-3.5 w-3.5" />
                URL directa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-2 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
              />
              <p className="text-xs text-muted-foreground">
                Máximo 2 MB. Se convertirá a base64.
              </p>
            </TabsContent>

            <TabsContent value="url" className="pt-2">
              <Input
                placeholder="https://ejemplo.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </TabsContent>
          </Tabs>
        </Section>

        <div className="flex justify-end gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={cancelEditing}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? "Actualizar" : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
