import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import {
  CountLinesEditor,
  type CountDraftLine,
} from "@/features/inventory/CountLinesEditor";
import { useCreateConteo } from "@/features/inventory/hooks";
import { useFitsScreen } from "@/hooks/use-fits-screen";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

function normalizeLines(lines: CountDraftLine[]) {
  return lines.filter(
    (line) => line.product_id && String(line.physical_quantity ?? "").trim(),
  );
}

export default function ConteoNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateConteo();
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<CountDraftLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const fitsScreen = useFitsScreen();

  const onSubmit = async () => {
    setFormError(null);
    const normalizedLines = normalizeLines(lines);
    if (normalizedLines.length !== lines.length) {
      setLines(normalizedLines);
    }
    if (!description.trim()) {
      setFormError("Ingresa una descripción");
      return;
    }
    if (normalizedLines.length === 0) {
      setFormError("Agrega al menos una línea");
      return;
    }
    const invalid = normalizedLines.find(
      (line) =>
        !line.product_id ||
        !line.physical_quantity ||
        Number(line.physical_quantity) <= 0,
    );
    if (invalid) {
      setFormError("Completa producto y cantidad física en todas las líneas");
      return;
    }
    try {
      const count = await create.mutateAsync({
        description: description.trim(),
        lines: normalizedLines.map((line) => ({
          product_id: line.product_id,
          physical_quantity: line.physical_quantity,
        })),
      });
      toast({
        variant: "success",
        title: "Conteo guardado",
        description: `Conteo ${count.number} creado.`,
      });
      navigate(`/inventory/conteos/${count.id}`);
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err, "No se pudo guardar el conteo"));
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", fitsScreen && "h-full")}>
      <PageHeader
        className="mb-0 shrink-0"
        title="Nuevo conteo"
        description="La fecha de registro y la secuencia se asignan automáticamente."
        actions={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />
      {formError && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <Section title="Cabecera" className="shrink-0">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción del conteo"
        />
      </Section>
      <Section
        title="Productos"
        className={cn(fitsScreen && "flex min-h-0 flex-1 flex-col")}
      >
        <CountLinesEditor
          fillHeight={fitsScreen}
          lines={lines}
          onChange={setLines}
        />
      </Section>
      <div className="flex shrink-0 gap-2">
        <Button onClick={onSubmit} isLoading={create.isPending}>
          Guardar conteo
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
