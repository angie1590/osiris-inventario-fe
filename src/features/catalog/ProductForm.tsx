import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Link2, Plus, Star, Trash2, Upload } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CategoryFormModal } from "@/features/catalog/CategoryFormModal";
import {
  isAllowedProductPhotoFile,
  isAllowedProductPhotoUrl,
  PRODUCT_PHOTO_ACCEPT,
  readFileAsDataUrl,
} from "@/features/catalog/productPhoto";
import { useToast } from "@/hooks/use-toast";
import type { CategoryAttribute, Product, Category, ProductImage } from "@/types/api";

const PHOTO_HELP =
  "PNG, JPG, JPEG o HEIC. Puedes agregar varias imágenes por archivo o URL y marcar una como portada.";
const PHOTO_MIN_WIDTH = 800;
const PHOTO_MIN_HEIGHT = 450;
const PHOTO_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

type PhotoWarning = {
  index: number;
  messages: string[];
};

type PhotoValidationResult = {
  blocking: PhotoWarning[];
  warnings: PhotoWarning[];
};

function normalizeCover(images: ProductImage[]): ProductImage[] {
  if (images.length === 0) return [];
  let coverIdx = images.findIndex((item) => item.is_cover);
  if (coverIdx < 0) coverIdx = 0;
  return images.map((item, idx) => ({ ...item, is_cover: idx === coverIdx }));
}

function initialProductPhotos(product?: Product): ProductImage[] {
  if (!product) return [];
  if (product.photos && product.photos.length > 0) {
    return normalizeCover(
      product.photos
        .map((item) => ({
          url: String(item.url ?? "").trim(),
          is_cover: !!item.is_cover,
        }))
        .filter((item) => item.url),
    );
  }
  return product.photo ? [{ url: product.photo, is_cover: true }] : [];
}

function estimateDataUrlBytes(value: string): number {
  if (!value.startsWith("data:")) return 0;
  const comma = value.indexOf(",");
  if (comma < 0) return 0;
  const base64 = value.slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function loadImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    image.src = url;
  });
}

async function validateProductPhotosForSave(
  photos: ProductImage[],
): Promise<PhotoValidationResult> {
  const blocking: PhotoWarning[] = [];
  const warnings: PhotoWarning[] = [];
  for (let index = 0; index < photos.length; index += 1) {
    const item = photos[index];
    const blockingMessages: string[] = [];
    const messages: string[] = [];

    if (item.url.startsWith("data:")) {
      const bytes = estimateDataUrlBytes(item.url);
      if (bytes > PHOTO_MAX_UPLOAD_BYTES) {
        blockingMessages.push("Pesa más de 2 MB.");
      }
    }

    try {
      const { width, height } = await loadImageDimensions(item.url);
      if (width < PHOTO_MIN_WIDTH || height < PHOTO_MIN_HEIGHT) {
        messages.push(
          `Resolución menor a ${PHOTO_MIN_WIDTH}x${PHOTO_MIN_HEIGHT}.`,
        );
      }
    } catch {
      messages.push("No se pudo validar la resolución.");
    }

    if (blockingMessages.length > 0) {
      blocking.push({ index, messages: blockingMessages });
    }
    if (messages.length > 0) {
      warnings.push({ index, messages });
    }
  }
  return { blocking, warnings };
}

const schema = z.object({
  // Barcode length/required validated in onSubmit (depends on the system param).
  isbn: z.string().optional(),
  codigo_interno: z.string().max(50, "Máximo 50 caracteres").optional(),
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  category_id: z
    .number({ error: "Categoría requerida" })
    .min(1, "Categoría requerida"),
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

type ProductPayload = {
  isbn?: string;
  codigo_interno?: string | null;
  photos: ProductImage[];
  name: string;
  description?: string;
  category_id: number;
  stock_minimo: number;
  pvp: string;
  custom_attributes: Record<string, unknown>;
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
            step={
              attr.data_type === "decimal"
                ? "0.01"
                : attr.data_type === "integer"
                  ? "1"
                  : undefined
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
  // Checkbox to use internal code as barcode
  const [useInternalCodeAsIsbn, setUseInternalCodeAsIsbn] = useState(false);
  // Modal to create new category
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [photos, setPhotos] = useState<ProductImage[]>(
    initialProductPhotos(product),
  );
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoTab, setPhotoTab] = useState<"file" | "url">(
    "file",
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoWarnings, setPhotoWarnings] = useState<PhotoWarning[]>([]);
  const [showPhotoWarningDialog, setShowPhotoWarningDialog] =
    useState<boolean>(false);
  const [pendingPayload, setPendingPayload] = useState<ProductPayload | null>(
    null,
  );
  const photoInputRef = useRef<HTMLInputElement>(null);

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
      setPhotos(initialProductPhotos(product));
      setPhotoUrl("");
      setPhotoTab("file");
      setPhotoError(null);
    } else {
      setPhotos([]);
      setPhotoUrl("");
      setPhotoTab("file");
      setPhotoError(null);
    }
  }, [product, reset, integerMode]);

  const categoryId = watch("category_id");
  const internalCodeValue = watch("codigo_interno");
  const { data: attrs, isLoading: attrsLoading } = useCategoryAttributes(
    categoryId ?? 0,
  );

  useEffect(() => {
    if (!useInternalCodeAsIsbn) return;
    setValue("isbn", internalCodeValue ?? "", { shouldValidate: true });
  }, [internalCodeValue, setValue, useInternalCodeAsIsbn]);

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

  const savePayload = async (payload: ProductPayload) => {
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

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    setPhotoError(null);

    // Validate category is selected
    if (!data.category_id || data.category_id < 1) {
      setError("category_id", { message: "Categoría requerida" });
      setFormError("Selecciona una categoría para continuar.");
      return;
    }

    // Barcode: required is parametrizable; length only enforced when provided.
    // If using internal code as barcode, copy the value
    let isbnVal = (data.isbn ?? "").trim();
    if (useInternalCodeAsIsbn) {
      isbnVal = (data.codigo_interno ?? "").trim();
    }
    if (barcodeRequired && !isbnVal) {
      setError("isbn", { message: "Código de barras requerido" });
      return;
    }
    if (isbnVal && (isbnVal.length < 10 || isbnVal.length > 32)) {
      setError("isbn", { message: "Debe tener entre 10 y 32 caracteres" });
      return;
    }

    const normalizedPhotos = normalizeCover(
      photos.map((item) => ({
        url: item.url.trim(),
        is_cover: !!item.is_cover,
      })).filter((item) => item.url),
    );

    const validation = await validateProductPhotosForSave(
      normalizedPhotos,
    );

    if (validation.blocking.length > 0) {
      setPhotoWarnings([...validation.blocking, ...validation.warnings]);
      setPhotoError(
        "Hay imágenes que exceden 2 MB. Debes reemplazarlas para poder guardar.",
      );
      setShowPhotoWarningDialog(false);
      setPendingPayload(null);
      return;
    }

    if (validation.warnings.length > 0) {
      setPhotoWarnings(validation.warnings);
      setPhotoError(
        "Hay imágenes con advertencias de resolución. Revisa o continúa bajo tu responsabilidad.",
      );
      setShowPhotoWarningDialog(true);
      setPendingPayload({
        isbn: isbnVal || undefined,
        ...(internalCodeEnabled
          ? { codigo_interno: data.codigo_interno?.trim() || null }
          : {}),
        photos: normalizedPhotos,
        name: data.name,
        description: data.description || undefined,
        category_id: data.category_id,
        stock_minimo: Number(data.stock_minimo ?? 0),
        pvp: data.pvp,
        custom_attributes: customAttrs,
      });
      return;
    }

    setPhotoWarnings([]);

    // Validate custom attributes inline (required + numeric/negative).
    if (!validateCustomAttrs()) {
      setFormError("Revisa los atributos marcados en rojo.");
      return;
    }

    const payload = {
      isbn: isbnVal || undefined,
      ...(internalCodeEnabled
        ? { codigo_interno: data.codigo_interno?.trim() || null }
        : {}),
      photos: normalizedPhotos,
      name: data.name,
      description: data.description || undefined,
      category_id: data.category_id,
      stock_minimo: Number(data.stock_minimo ?? 0),
      pvp: data.pvp,
      custom_attributes: customAttrs,
    };

    await savePayload(payload);
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
            disabled={useInternalCodeAsIsbn}
          />
        </FormField>
        {internalCodeEnabled && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="use-internal-as-isbn"
              checked={useInternalCodeAsIsbn}
              onCheckedChange={(checked) => setUseInternalCodeAsIsbn(!!checked)}
            />
            <label
              htmlFor="use-internal-as-isbn"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Usar código interno como código de barras
            </label>
          </div>
        )}
        <FormField label="Nombre" required error={errors.name?.message}>
          <Input {...register("name")} />
        </FormField>
        <FormField label="Descripción" error={errors.description?.message}>
          <Input {...register("description")} />
        </FormField>
        <FormField
          label="Foto"
          error={photoError ?? undefined}
          hint={PHOTO_HELP}
        >
          <div className="space-y-3">
            {photos.length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {photos.map((item, idx) => (
                  <div key={`${item.url}-${idx}`} className="flex items-start gap-3 rounded-md border p-3">
                    <img
                      src={item.url}
                      alt={`Foto ${idx + 1}`}
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                    <div className="flex flex-1 flex-col gap-2">
                      <span className="line-clamp-2 break-all text-xs text-muted-foreground">{item.url.startsWith("data:") ? "Imagen cargada" : item.url}</span>
                      {photoWarnings
                        .find((w) => w.index === idx)
                        ?.messages.map((msg) => (
                          <span
                            key={`${idx}-${msg}`}
                            className={`rounded px-2 py-1 text-xs ${msg.includes("2 MB") ? "bg-destructive/10 text-destructive" : "bg-amber-50 text-amber-800"}`}
                          >
                            {msg.includes("2 MB") ? "Error:" : "Advertencia:"} {msg}
                          </span>
                        ))}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={item.is_cover ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setPhotos((prev) =>
                              prev.map((p, i) => ({ ...p, is_cover: i === idx })),
                            );
                            setPhotoWarnings([]);
                          }}
                        >
                          <Star className="mr-1.5 h-3.5 w-3.5" />
                          {item.is_cover ? "Portada" : "Usar portada"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPhotos((prev) =>
                              normalizeCover(prev.filter((_, i) => i !== idx)),
                            );
                            setPhotoWarnings([]);
                            setPhotoError(null);
                          }}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Quitar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Tabs
              value={photoTab}
              onValueChange={(value) => {
                setPhotoTab(value as "file" | "url");
                setPhotoError(null);
              }}
            >
              <TabsList>
                <TabsTrigger value="file">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Subir archivo
                </TabsTrigger>
                <TabsTrigger value="url">
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  URL directa
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-2 pt-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept={PRODUCT_PHOTO_ACCEPT}
                  multiple
                  onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length === 0) return;
                    const invalid = files.find((file) => !isAllowedProductPhotoFile(file));
                    if (invalid) {
                      setPhotoError("Los archivos deben ser PNG, JPG, JPEG o HEIC.");
                      e.target.value = "";
                      return;
                    }
                    try {
                      const uploaded = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
                      setPhotos((prev) =>
                        normalizeCover([
                          ...prev,
                          ...uploaded.map((url) => ({ url, is_cover: false })),
                        ]),
                      );
                      setPhotoWarnings([]);
                      setPhotoError(null);
                      e.target.value = "";
                    } catch {
                      setPhotoError("No se pudieron leer una o más imágenes seleccionadas.");
                    }
                  }}
                  className="cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
                />
              </TabsContent>

              <TabsContent value="url" className="space-y-2 pt-2">
                <Input
                  placeholder="https://ejemplo.com/producto.jpg"
                  value={photoUrl}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPhotoUrl(value);
                    setPhotoError(null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const normalizedUrl = photoUrl.trim();
                    if (!normalizedUrl) return;
                    if (!isAllowedProductPhotoUrl(normalizedUrl)) {
                      setPhotoError("La URL debe ser válida y usar http o https.");
                      return;
                    }
                    setPhotos((prev) =>
                      normalizeCover([
                        ...prev,
                        { url: normalizedUrl, is_cover: false },
                      ]),
                    );
                    setPhotoWarnings([]);
                    setPhotoUrl("");
                    setPhotoError(null);
                  }}
                >
                  Agregar URL
                </Button>
              </TabsContent>
            </Tabs>

            {photos.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImagePlus className="h-4 w-4" />
                Sin imágenes cargadas
              </div>
            )}
          </div>
        </FormField>
      </Section>

      <Section title="Clasificación">
        <FormField
          label="Categoría"
          required
          error={errors.category_id?.message}
        >
          <div className="flex gap-2 items-end">
            <div className="flex-1">
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
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 mb-1"
              onClick={() => setShowCategoryForm(true)}
              title="Crear nueva categoría"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
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

  const photoWarningDialog = showPhotoWarningDialog && (
    <ConfirmDialog
      open
      onClose={() => {
        setShowPhotoWarningDialog(false);
        setFormError("Revisa las imágenes marcadas antes de guardar.");
      }}
      title="Advertencia de resolución"
      description={
        <>
          Se detectaron imágenes con resolución por debajo de lo recomendado.
          Puedes continuar y guardar de todas formas o revisar las imágenes marcadas.
        </>
      }
      confirmLabel="Continuar y guardar"
      cancelLabel="Revisar imágenes"
      onConfirm={async () => {
        if (!pendingPayload) return;
        setShowPhotoWarningDialog(false);
        await savePayload(pendingPayload);
        setPendingPayload(null);
      }}
      variant="default"
    />
  );

  const handleCategoryCreated = (category: Category) => {
    setShowCategoryForm(false);
    setValue("category_id", category.id);
    toast({
      variant: "success",
      title: "Categoría creada",
      description: `"${category.name}" creada correctamente.`,
    });
  };

  if (layout === "modal") {
    return (
      <>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="contents">
          <DialogBody className="space-y-5">{body}</DialogBody>
          <DialogFooter>{footer}</DialogFooter>
        </form>
        {orphanDialog}
        {photoWarningDialog}
        {showCategoryForm && (
          <CategoryFormModal
            allCategories={categories ?? []}
            onClose={() => setShowCategoryForm(false)}
            onSuccess={handleCategoryCreated}
          />
        )}
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
      {photoWarningDialog}
      {showCategoryForm && (
        <CategoryFormModal
          allCategories={categories ?? []}
          onClose={() => setShowCategoryForm(false)}
          onSuccess={handleCategoryCreated}
        />
      )}
    </>
  );
}
