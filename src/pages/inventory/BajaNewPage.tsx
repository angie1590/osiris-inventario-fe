import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import {
  DocumentLinesEditor,
  type DocumentLine,
} from "@/features/inventory/DocumentLinesEditor";
import { useCreateBaja } from "@/features/inventory/hooks";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

const schema = z.object({
  reference: z.string().trim().min(1, "La referencia es obligatoria"),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function BajaNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateBaja();
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    if (lines.length === 0) {
      setFormError("Agrega al menos una línea al documento");
      return;
    }
    const invalid = lines.find(
      (l) => !l.product_id || !l.quantity || Number(l.quantity) <= 0,
    );
    if (invalid) {
      setFormError("Completa todos los campos de las líneas");
      return;
    }

    const insufficient = lines.find(
      (l) =>
        typeof l.product_stock === "number" &&
        Number(l.quantity) > l.product_stock,
    );
    if (insufficient) {
      setFormError(
        `Stock insuficiente para ${insufficient.product_name || `#${insufficient.product_id}`}: disponible ${insufficient.product_stock}, solicitado ${insufficient.quantity}`,
      );
      return;
    }

    try {
      const doc = await create.mutateAsync({
        reference: data.reference,
        notes: data.notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
        })),
      });
      toast({
        variant: "success",
        title: "Baja creada",
        description: `Baja ${doc.number} creada, pendiente de aprobación.`,
      });
      navigate(`/inventory/bajas/${doc.id}`);
    } catch (err: unknown) {
      setFormError(
        getApiErrorMessage(err, "Error al crear la baja", {
          DOCUMENT_REQUIRES_LINES: "Agrega al menos una línea al documento",
          INSUFFICIENT_STOCK: "Stock insuficiente en uno de los productos",
          PRODUCT_NOT_FOUND: "Uno de los productos no fue encontrado",
        }),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva Baja de Inventario"
        actions={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />
      <form
        onSubmit={handleSubmit(onSubmit, () =>
          setFormError("Revisa los campos obligatorios del formulario."),
        )}
        className="space-y-6"
      >
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Section title="Cabecera">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Referencia"
              required
              error={errors.reference?.message}
            >
              <Input
                {...register("reference")}
                placeholder="Motivo / referencia de la baja"
              />
            </FormField>
            <FormField label="Notas">
              <Input {...register("notes")} placeholder="Motivo de la baja" />
            </FormField>
          </div>
        </Section>
        <Section title="Líneas del documento">
          <DocumentLinesEditor
            lines={lines}
            onChange={setLines}
            enforceStockLimit
          />
        </Section>
        <div className="flex gap-2">
          <Button type="submit" isLoading={isSubmitting}>
            Crear baja
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
