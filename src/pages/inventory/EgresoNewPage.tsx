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
  applyDiscount,
} from "@/features/inventory/DocumentLinesEditor";
import { useCreateEgreso } from "@/features/inventory/hooks";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

const schema = z.object({
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function EgresoNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateEgreso();
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    if (lines.length === 0) {
      setFormError("Agrega al menos una línea al documento");
      return;
    }
    const invalidLine = lines.find(
      (l) => !l.product_id || !l.quantity || Number(l.quantity) <= 0,
    );
    if (invalidLine) {
      setFormError("Completa todos los campos de las líneas");
      return;
    }
    try {
      const doc = await create.mutateAsync({
        reference: data.reference || undefined,
        notes: data.notes || undefined,
        lines: lines.map((l) => {
          const pvp = l.product_pvp ?? Number(l.unit_price ?? 0);
          const finalPrice =
            l.discount_value && pvp > 0
              ? applyDiscount(
                  pvp,
                  l.discount_type ?? "percent",
                  l.discount_value,
                )
              : pvp;
          return {
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: finalPrice > 0 ? String(finalPrice) : undefined,
          };
        }),
      });
      toast({
        variant: "success",
        title: "Egreso creado",
        description: `Egreso ${doc.number} creado correctamente.`,
      });
      navigate(`/inventory/egresos/${doc.id}`);
    } catch (err: unknown) {
      setFormError(
        getApiErrorMessage(err, "Error al crear el egreso", {
          INSUFFICIENT_STOCK: "Stock insuficiente en uno de los productos",
          PRODUCT_NOT_FOUND: "Uno de los productos no fue encontrado",
          DOCUMENT_REQUIRES_LINES: "Agrega al menos una línea al documento",
        }),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo Egreso"
        actions={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Section title="Cabecera">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Referencia">
              <Input
                {...register("reference")}
                placeholder="Ej: Orden de despacho 001"
              />
            </FormField>
            <FormField label="Notas">
              <Input
                {...register("notes")}
                placeholder="Observaciones (opcional)"
              />
            </FormField>
          </div>
        </Section>

        <Section title="Ítems">
          <DocumentLinesEditor
            lines={lines}
            onChange={setLines}
            showDiscount
            prioritizeInStock
            enforceStockLimit
            autoFillUnitPriceFromProduct
          />
        </Section>

        <div className="flex gap-2">
          <Button type="submit" isLoading={isSubmitting}>
            Guardar egreso
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
