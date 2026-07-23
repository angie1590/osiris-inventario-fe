import { useEffect, useState } from "react";
import { ArrowLeft, Save, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CountLinesEditor,
  type CountDraftLine,
} from "@/features/inventory/CountLinesEditor";
import { DocumentDetailModal } from "@/features/inventory/DocumentDetailModal";
import {
  useApplyConteo,
  useDocument,
  useConteo,
  useUpdateConteo,
} from "@/features/inventory/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { formatQuantity, useStockMode } from "@/hooks/useStockMode";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import api from "@/lib/api";
import type {
  AdjustmentIncrementCostMode,
  AdjustmentIncrementCostPreview,
  CountStatus,
  DocumentType,
  InventoryCount,
} from "@/types/api";

type PendingCostLine = {
  product_id: number;
  product_name: string;
  difference_quantity: number;
  mode: Exclude<AdjustmentIncrementCostMode, "auto">;
  suggested_cost_display: string | null;
  unit_cost_input: string;
};

function normalizeLines(lines: CountDraftLine[]) {
  return lines.filter(
    (line) => line.product_id && String(line.physical_quantity ?? "").trim(),
  );
}

const STATUS_LABELS: Record<CountStatus, string> = {
  draft: "Borrador",
  applied: "Aplicado",
  cancelled: "Cancelado",
};

const STATUS_VARIANTS: Record<
  CountStatus,
  "default" | "secondary" | "destructive"
> = {
  draft: "secondary",
  applied: "default",
  cancelled: "destructive",
};

export default function ConteoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const countId = Number(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { integerMode } = useStockMode();
  const { data: count, isLoading, isError, refetch } = useConteo(countId);
  const update = useUpdateConteo();
  const apply = useApplyConteo();
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<CountDraftLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [costModalError, setCostModalError] = useState<string | null>(null);
  const [pendingCostLines, setPendingCostLines] = useState<PendingCostLine[]>(
    [],
  );
  const [pendingApplyCountId, setPendingApplyCountId] = useState<number | null>(
    null,
  );
  const [selectedGeneratedDoc, setSelectedGeneratedDoc] = useState<{
    id: number;
    docType: DocumentType;
  } | null>(null);
  const { data: selectedGeneratedDocData } = useDocument(
    selectedGeneratedDoc?.id ?? 0,
    selectedGeneratedDoc?.docType ?? "IN",
  );

  useEffect(() => {
    if (!count) return;
    setDescription(count.description);
    setLines(
      count.lines.map((line) => ({
        product_id: line.product_id,
        product_name: line.product_name,
        physical_quantity: formatQuantity(line.physical_quantity, integerMode),
      })),
    );
  }, [count, integerMode]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !count) return <p>No se pudo cargar el conteo.</p>;

  const editable =
    count.status === "draft" &&
    (user?.role === "admin" || user?.role === "operator");

  const save = async () => {
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
      await update.mutateAsync({
        id: count.id,
        payload: {
          description: description.trim(),
          lines: normalizedLines.map((line) => ({
            product_id: line.product_id,
            physical_quantity: line.physical_quantity,
          })),
        },
      });
      toast({
        variant: "success",
        title: "Conteo actualizado",
        description: "Se consolidaron las líneas repetidas al guardar.",
      });
      refetch();
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err, "No se pudo actualizar el conteo"));
    }
  };

  const applyCount = async () => {
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
      const updatedCount = await update.mutateAsync({
        id: count.id,
        payload: {
          description: description.trim(),
          lines: normalizedLines.map((line) => ({
            product_id: line.product_id,
            physical_quantity: line.physical_quantity,
          })),
        },
      });
      const requiresCostModal = await prepareCostModal(updatedCount);
      if (requiresCostModal) {
        return;
      }
      await apply.mutateAsync({ id: count.id });
      toast({
        variant: "success",
        title: "Conteo aplicado",
        description: "Las diferencias se reflejaron en inventario.",
      });
      refetch();
    } catch (err: unknown) {
      const code =
        (err as { response?: { data?: { code?: string } } })?.response?.data
          ?.code ?? "";
      if (code === "UNIT_COST_REQUIRED") {
        try {
          const fresh = await api.get<InventoryCount>(
            `/inventory/conteos/${count.id}`,
          );
          const opened = await prepareCostModal(fresh.data);
          if (opened) {
            setFormError(null);
            return;
          }
        } catch {
          // Keep generic error flow below.
        }
      }
      setFormError(
        getApiErrorMessage(err, "No se pudo aplicar el conteo", {
          UNIT_COST_REQUIRED:
            "Falta ingresar un costo unitario para uno o más productos del ajuste positivo.",
        }),
      );
    }
  };

  const prepareCostModal = async (updatedCount: InventoryCount) => {
    const positiveLines = updatedCount.lines.filter(
      (line) => Number(line.difference_quantity) > 0,
    );
    if (positiveLines.length === 0) return false;

    const productIds = Array.from(
      new Set(
        positiveLines.map((line) => line.product_id).filter((id) => id > 0),
      ),
    );
    if (productIds.length === 0) return false;

    const params = new URLSearchParams();
    productIds.forEach((id) => params.append("product_ids", String(id)));
    const res = await api.get<AdjustmentIncrementCostPreview[]>(
      "/inventory/ajustes/cost-preview",
      { params },
    );
    const previewMap = new Map(
      res.data.map((preview) => [preview.product_id, preview]),
    );

    const rows = positiveLines
      .map((line) => {
        const preview = previewMap.get(line.product_id);
        if (!preview || preview.mode === "auto") return null;
        const suggested =
          preview.unit_cost == null ? null : Number(preview.unit_cost);
        const roundedSuggested =
          suggested == null || Number.isNaN(suggested)
            ? null
            : suggested.toFixed(2);
        return {
          product_id: line.product_id,
          product_name: line.product_name,
          difference_quantity: Number(line.difference_quantity),
          mode: preview.mode,
          suggested_cost_display: roundedSuggested,
          unit_cost_input:
            preview.mode === "suggested" && roundedSuggested != null
              ? roundedSuggested
              : "",
        };
      })
      .filter((line): line is PendingCostLine => line !== null);

    if (rows.length === 0) return false;

    setPendingApplyCountId(updatedCount.id);
    setPendingCostLines(rows);
    setCostModalError(null);
    setCostModalOpen(true);
    return true;
  };

  const confirmApplyWithCosts = async () => {
    if (!pendingApplyCountId) return;
    const invalid = pendingCostLines.find(
      (line) => Number(line.unit_cost_input) <= 0,
    );
    if (invalid) {
      setCostModalError(
        "Ingresa un costo unitario mayor a 0 en todas las líneas.",
      );
      return;
    }

    try {
      await apply.mutateAsync({
        id: pendingApplyCountId,
        payload: {
          line_costs: pendingCostLines.map((line) => ({
            product_id: line.product_id,
            unit_cost: line.unit_cost_input,
          })),
        },
      });
      setCostModalOpen(false);
      setPendingCostLines([]);
      setPendingApplyCountId(null);
      toast({
        variant: "success",
        title: "Conteo aplicado",
        description: "Las diferencias se reflejaron en inventario.",
      });
      refetch();
    } catch (err: unknown) {
      setCostModalError(
        getApiErrorMessage(err, "No se pudo aplicar el conteo", {
          UNIT_COST_REQUIRED:
            "Falta ingresar un costo unitario para uno o más productos del ajuste positivo.",
        }),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={count.number}
        description={`Registrado el ${new Date(count.created_at).toLocaleString("es-EC")}`}
        actions={
          <>
            <Badge variant={STATUS_VARIANTS[count.status]}>
              {STATUS_LABELS[count.status]}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Section title="Cabecera">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            readOnly={!editable}
          />
          <Input value={count.number} readOnly />
        </div>
      </Section>

      <Section title="Captura física">
        <CountLinesEditor
          lines={lines}
          onChange={setLines}
          readOnly={!editable}
        />
      </Section>

      <Section title="Resultado consolidado guardado">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Sistema</TableHead>
                <TableHead className="text-center">Físico</TableHead>
                <TableHead className="text-center">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {count.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div>
                      <p>{line.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        CB: {line.product_isbn || "—"} | Int:{" "}
                        {line.product_codigo_interno || "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {formatQuantity(line.system_quantity, integerMode)}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatQuantity(line.physical_quantity, integerMode)}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatQuantity(line.difference_quantity, integerMode)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      {(count.positive_adjustment_document_id ||
        count.negative_adjustment_document_id) && (
        <Section title="Documentos generados">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Ingreso (ajuste positivo)
              </p>
              {count.positive_adjustment_document_id &&
              count.positive_adjustment_document_number ? (
                <button
                  type="button"
                  className="text-sm text-primary underline underline-offset-2"
                  onClick={() =>
                    setSelectedGeneratedDoc({
                      id: count.positive_adjustment_document_id as number,
                      docType: "IN",
                    })
                  }
                >
                  {count.positive_adjustment_document_number}
                </button>
              ) : (
                <Input readOnly value="—" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Egreso (ajuste negativo)
              </p>
              {count.negative_adjustment_document_id &&
              count.negative_adjustment_document_number ? (
                <button
                  type="button"
                  className="text-sm text-primary underline underline-offset-2"
                  onClick={() =>
                    setSelectedGeneratedDoc({
                      id: count.negative_adjustment_document_id as number,
                      docType: "EG",
                    })
                  }
                >
                  {count.negative_adjustment_document_number}
                </button>
              ) : (
                <Input readOnly value="—" />
              )}
            </div>
          </div>
        </Section>
      )}

      <div className="flex gap-2">
        {editable && (
          <Button onClick={save} isLoading={update.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Guardar cambios
          </Button>
        )}
        {editable && (
          <Button
            variant="outline"
            onClick={applyCount}
            isLoading={apply.isPending || update.isPending}
          >
            <Send className="mr-2 h-4 w-4" />
            Aplicar conteo
          </Button>
        )}
      </div>

      {selectedGeneratedDoc && selectedGeneratedDocData && (
        <DocumentDetailModal
          doc={selectedGeneratedDocData}
          onClose={() => setSelectedGeneratedDoc(null)}
          showCost
        />
      )}

      <Dialog
        open={costModalOpen}
        onOpenChange={(open) => {
          setCostModalOpen(open);
          if (!open) {
            setCostModalError(null);
            setPendingCostLines([]);
            setPendingApplyCountId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completa costos del ajuste positivo</DialogTitle>
            <DialogDescription>
              Ingresa costos unitarios para productos que no tienen costo
              automático en Kardex.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {costModalError && (
              <Alert variant="destructive">
                <AlertDescription>{costModalError}</AlertDescription>
              </Alert>
            )}
            <div className="mt-3 space-y-3">
              {pendingCostLines.map((line, index) => (
                <div key={line.product_id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{line.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Diferencia positiva:{" "}
                    {formatQuantity(line.difference_quantity, integerMode)}
                  </p>
                  {line.mode === "suggested" &&
                    line.suggested_cost_display != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Costo sugerido: {line.suggested_cost_display}
                      </p>
                    )}
                  <Input
                    className="mt-2"
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={line.unit_cost_input}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPendingCostLines((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                unit_cost_input: value,
                              }
                            : item,
                        ),
                      );
                    }}
                    placeholder="Costo unitario"
                  />
                </div>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCostModalOpen(false);
                setCostModalError(null);
                setPendingCostLines([]);
                setPendingApplyCountId(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={confirmApplyWithCosts} isLoading={apply.isPending}>
              Aplicar conteo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
