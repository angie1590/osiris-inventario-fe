import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/shared/FormField";
import { Section } from "@/components/shared/Section";
import { TreeSelector } from "@/components/shared/TreeSelector";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  useCreateProduct,
  useUpdateProduct,
  useCategories,
  useCategoryAttributes,
} from "@/features/catalog/hooks";
import {
  useStockMode,
  formatQuantity,
  useInternalCodeEnabled,
  useIsbnRequired,
} from "@/hooks/useStockMode";
import { useCatalogValues } from "@/features/catalog/catalogHooks";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useToast } from "@/hooks/use-toast";
import type { CategoryAttribute, Product } from "@/types/api";

const schema = z.object({
  // Barcode length/required validated in onSubmit (depends on the system param).
  isbn: z.string().optional(),
  codigo_interno: z.string().max(50, "Máximo 50 caracteres").optional(),
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  category_id: z.number({ error: "Requerido" }).min(1, "Requerido"),
  stock_minimo: z.string().optional(),
  pvp: z.string().min(1, "Requerido"),
});
type FormData = z.infer<typeof schema>;

type ApiError = {
  response?: {
    data?: {
      code?: string;
      message?: string;
      errors?: Record<string, string>;
    };
  };
};

function CatalogAttributeField({
  attr,
  value,
  onChange,
  error,
}: {
  attr: CategoryAttribute;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const { data: values } = useCatalogValues(attr.catalog_id);
  const active = (values ?? []).filter((v) => v.is_active).map((v) => v.value);
  return (
    <FormField label={attr.name} required={attr.is_required} error={error}>
      <SearchableSelect
        value={value != null ? String(value) : null}
        onChange={onChange}
        options={active}
        placeholder={`Seleccionar ${attr.name}`}
        emptyText="Catálogo sin valores"
      />
    </FormField>
  );
}

function AttributeField({
  attr,
  value,
  onChange,
  error,
}: {
  attr: CategoryAttribute;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  switch (attr.data_type) {
    case "catalog":
      return (
        <CatalogAttributeField
          attr={attr}
          value={value}
          onChange={onChange}
          error={error}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={!!value}
            onCheckedChange={onChange}
            id={`attr-${attr.id}`}
          />
          <label htmlFor={`attr-${attr.id}`} className="cursor-pointer text-sm">
            {attr.name}
            {attr.is_required && (
              <span className="ml-0.5 text-destructive">*</span>
            )}
          </label>
        </div>
      );
    case "select":
      return (
        <FormField label={attr.name} required={attr.is_required} error={error}>
          <Select value={String(value ?? "")} onValueChange={onChange}>
            <SelectTrigger aria-invalid={!!error}>
              <SelectValue placeholder={`Seleccionar ${attr.name}`} />
            </SelectTrigger>
            <SelectContent>
              {(attr.select_options ?? []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      );
    default:
      return (
        <FormField label={attr.name} required={attr.is_required} error={error}>
          <Input
            type={
              attr.data_type === "integer" || attr.data_type === "decimal"
                ? "number"
                : attr.data_type === "date"
                  ? "date"
                  : "text"
            }
            min={
              (attr.data_type === "integer" || attr.data_type === "decimal") &&
              !attr.allow_negative
                ? 0
                : undefined
            }
            aria-invalid={!!error}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </FormField>
      );
  }
}

interface ProductFormProps {
  product?: Product;
  onSuccess: (saved: Product) => void;
  onCancel: () => void;
  /** 'modal' wraps content/footer in DialogBody/DialogFooter; 'page' uses plain layout. */
  layout: "page" | "modal";
}

export function ProductForm({
  product,
  onSuccess,
  onCancel,
  layout,
}: ProductFormProps) {
  const { toast } = useToast();
  const isEdit = !!product;
  const { data: categories } = useCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct();

  const { integerMode } = useStockMode();
  const internalCodeEnabled = useInternalCodeEnabled();
  const barcodeRequired = useIsbnRequired();
  const [formError, setFormError] = useState<string | null>(null);
  const [customAttrs, setCustomAttrs] = useState<Record<string, unknown>>({});
  // Per-attribute validation errors shown in red on submit.
  const [attrErrors, setAttrErrors] = useState<Record<string, string>>({});
  // Prompt shown when changing a product's category drops attribute values.
  const [orphanPrompt, setOrphanPrompt] = useState<{
    targetCategory: number;
    orphans: string[];
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { stock_minimo: "0" },
  });

  // The category whose attribute values are currently consistent (for revert).
  const confirmedCategoryRef = useRef<number | null>(
    product?.category_id ?? null,
  );
  const customAttrsRef = useRef(customAttrs);
  customAttrsRef.current = customAttrs;

  useEffect(() => {
    if (product) {
      reset({
        isbn: product.isbn,
        codigo_interno: product.codigo_interno ?? "",
        name: product.name,
        description: product.description ?? "",
        category_id: product.category_id,
        stock_minimo: formatQuantity(product.stock_minimo, integerMode),
        pvp: Number(product.pvp).toFixed(2),
      });
      setCustomAttrs({ ...(product.custom_attributes ?? {}) });
      confirmedCategoryRef.current = product.category_id;
    }
  }, [product, reset, integerMode]);

  const categoryId = watch("category_id");
  const { data: attrs, isLoading: attrsLoading } = useCategoryAttributes(
    categoryId ?? 0,
  );

  // On category change: create → just clear; edit → warn before dropping values
  // of attributes that no longer apply, then clean them on confirm.
  useEffect(() => {
    if (!isEdit) {
      setCustomAttrs({});
      return;
    }
    if (orphanPrompt) return;
    if (categoryId == null || categoryId === confirmedCategoryRef.current)
      return;
    if (attrsLoading) return;

    const validNames = new Set((attrs ?? []).map((a) => a.name));
    const current = customAttrsRef.current;
    const orphans = Object.keys(current).filter((k) => {
      const v = current[k];
      const hasValue = v !== undefined && v !== null && v !== "";
      return hasValue && !validNames.has(k);
    });
    if (orphans.length > 0) {
      setOrphanPrompt({ targetCategory: categoryId, orphans });
    } else {
      confirmedCategoryRef.current = categoryId;
    }
  }, [categoryId, attrs, attrsLoading, isEdit, orphanPrompt]);

  const confirmOrphanCleanup = () => {
    if (!orphanPrompt) return;
    setCustomAttrs((prev) => {
      const next = { ...prev };
      orphanPrompt.orphans.forEach((k) => {
        delete next[k];
      });
      return next;
    });
    confirmedCategoryRef.current = orphanPrompt.targetCategory;
  };

  // Used as ConfirmDialog onClose: on cancel reverts the category; on confirm
  // (after cleanup set the ref to the new category) this is a no-op revert.
  const closeOrphanPrompt = () => {
    setValue("category_id", confirmedCategoryRef.current as number);
    setOrphanPrompt(null);
  };

  // Validate required/numeric custom attributes; set red errors. Returns true if ok.
  const validateCustomAttrs = (): boolean => {
    const errs: Record<string, string> = {};
    for (const a of attrs ?? []) {
      const v = customAttrs[a.name];
      const empty = v === undefined || v === null || v === "";
      if (a.is_required && empty && a.data_type !== "boolean") {
        errs[a.name] = "Requerido";
      } else if (
        !empty &&
        (a.data_type === "integer" || a.data_type === "decimal")
      ) {
        const num = Number(v);
        if (Number.isNaN(num)) errs[a.name] = "Debe ser un número";
        else if (!a.allow_negative && num < 0)
          errs[a.name] = "No admite valores negativos";
        else if (a.data_type === "integer" && !Number.isInteger(num))
          errs[a.name] = "Debe ser un entero";
      }
    }
    setAttrErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Runs when RHF's own validation fails — still flag custom attributes in red.
  const onInvalid = () => {
    validateCustomAttrs();
    setFormError("Revisa los campos marcados en rojo.");
  };

  const onSubmit = async (data: FormData) => {
    setFormError(null);

    // Barcode: required is parametrizable; length only enforced when provided.
    const isbnVal = (data.isbn ?? "").trim();
    if (barcodeRequired && !isbnVal) {
      setError("isbn", { message: "Código de barras requerido" });
      return;
    }
    if (isbnVal && (isbnVal.length < 10 || isbnVal.length > 32)) {
      setError("isbn", { message: "Debe tener entre 10 y 32 caracteres" });
      return;
    }

    // Validate custom attributes inline (required + numeric/negative).
    if (!validateCustomAttrs()) {
      setFormError("Revisa los atributos marcados en rojo.");
      return;
    }

    const payload = {
      isbn: data.isbn || undefined,
      ...(internalCodeEnabled
        ? { codigo_interno: data.codigo_interno?.trim() || null }
        : {}),
      name: data.name,
      description: data.description || undefined,
      category_id: data.category_id,
      stock_minimo: Number(data.stock_minimo ?? 0),
      pvp: data.pvp,
      custom_attributes: customAttrs,
    };

    try {
      const saved = isEdit
        ? await update.mutateAsync({ id: product!.id, payload })
        : await create.mutateAsync(payload);
      toast({
        variant: "success",
        title: isEdit ? "Producto actualizado" : "Producto creado",
        description: `"${saved.name}" guardado correctamente.`,
      });
      onSuccess(saved);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const fieldErrors = apiErr?.response?.data?.errors;
      const msg =
        apiErr?.response?.data?.message ?? "Error al guardar el producto";
      const code = apiErr?.response?.data?.code;

      if (fieldErrors) {
        const knownFields: (keyof FormData)[] = [
          "isbn",
          "name",
          "category_id",
          "stock_minimo",
          "pvp",
        ];
        knownFields.forEach((field) => {
          if (fieldErrors[field])
            setError(field, { message: fieldErrors[field] });
        });
      }
      if (code === "INVALID_QUANTITY")
        setError("stock_minimo", { message: msg });

      setFormError(msg);
    }
  };

  const body = (
    <>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Section title="Información general">
        {internalCodeEnabled && (
          <FormField
            label="Código interno"
            error={errors.codigo_interno?.message}
            hint="Código alfanumérico (ej: L010263)."
          >
            <Input {...register("codigo_interno")} placeholder="L010263" />
          </FormField>
        )}
        <FormField
          label="Código de barras"
          required={barcodeRequired}
          error={errors.isbn?.message}
          hint={
            barcodeRequired
              ? undefined
              : "Si no lo envías, el backend generará un código automático."
          }
        >
          <Input
            {...register("isbn")}
            placeholder="7501234567890"
            aria-invalid={!!errors.isbn}
          />
        </FormField>
        <FormField label="Nombre" required error={errors.name?.message}>
          <Input {...register("name")} />
        </FormField>
        <FormField label="Descripción" error={errors.description?.message}>
          <Input {...register("description")} />
        </FormField>
      </Section>

      <Section title="Clasificación">
        <FormField
          label="Categoría"
          required
          error={errors.category_id?.message}
        >
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <TreeSelector
                categories={(categories ?? []).filter((c) => !c.is_default)}
                value={field.value as number | null}
                onChange={field.onChange}
                leafOnly
              />
            )}
          />
        </FormField>
      </Section>

      <Section title="Inventario">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Stock mínimo"
            required
            error={errors.stock_minimo?.message}
          >
            {(() => {
              const reg = register("stock_minimo");
              return (
                <Input
                  type="number"
                  step={integerMode ? "1" : "0.0001"}
                  min="0"
                  {...reg}
                  onChange={(e) => {
                    if (integerMode)
                      e.target.value = e.target.value.replace(/[.,].*$/, "");
                    reg.onChange(e);
                  }}
                />
              );
            })()}
          </FormField>
          {isEdit && (
            <FormField
              label="Stock actual"
              hint="Solo lectura — se actualiza via movimientos"
            >
              <Input
                value={formatQuantity(product?.stock_actual ?? 0, integerMode)}
                disabled
                className="bg-muted"
              />
            </FormField>
          )}
        </div>
      </Section>

      <Section title="Precio">
        <FormField label="PVP" required error={errors.pvp?.message}>
          {(() => {
            const reg = register("pvp");
            return (
              <Input
                type="number"
                step="0.01"
                min="0"
                className="max-w-48"
                {...reg}
                onChange={(e) => {
                  // Money: never allow more than 2 decimals.
                  const parts = e.target.value.split(".");
                  if (parts[1]?.length > 2)
                    e.target.value = `${parts[0]}.${parts[1].slice(0, 2)}`;
                  reg.onChange(e);
                }}
              />
            );
          })()}
        </FormField>
      </Section>

      {categoryId > 0 && (
        <Section title="Atributos personalizados">
          {attrsLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (attrs ?? []).length === 0 ? (
            <EmptyState
              heading="Esta categoría no tiene atributos definidos"
              className="py-6"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(attrs ?? []).map((attr) => (
                <AttributeField
                  key={attr.id}
                  attr={attr}
                  value={customAttrs[attr.name]}
                  error={attrErrors[attr.name]}
                  onChange={(v) => {
                    setCustomAttrs((prev) => ({ ...prev, [attr.name]: v }));
                    setAttrErrors((prev) => {
                      if (!prev[attr.name]) return prev;
                      const next = { ...prev };
                      delete next[attr.name];
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          )}
        </Section>
      )}
    </>
  );

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" isLoading={isSubmitting}>
        {isEdit ? "Actualizar" : "Crear producto"}
      </Button>
    </>
  );

  const orphanDialog = orphanPrompt && (
    <ConfirmDialog
      open
      onClose={closeOrphanPrompt}
      title="Cambiar de categoría"
      description={
        <>
          Al cambiar de categoría, estos atributos ya no aplican y se eliminarán
          sus valores: <strong>{orphanPrompt.orphans.join(", ")}</strong>.
          ¿Continuar?
        </>
      }
      confirmLabel="Continuar y eliminar valores"
      cancelLabel="Cancelar"
      variant="danger"
      onConfirm={confirmOrphanCleanup}
    />
  );

  if (layout === "modal") {
    return (
      <>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="contents">
          <DialogBody className="space-y-5">{body}</DialogBody>
          <DialogFooter>{footer}</DialogFooter>
        </form>
        {orphanDialog}
      </>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5">
        {body}
        <div className="flex justify-end gap-3">{footer}</div>
      </form>
      {orphanDialog}
    </>
  );
}
