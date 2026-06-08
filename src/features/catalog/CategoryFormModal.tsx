import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/FormField";
import { TreeSelector } from "@/components/shared/TreeSelector";
import { useCreateCategory, useUpdateCategory } from "./hooks";
import type { Category } from "@/types/api";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  parent_id: z.number().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  category?: Category;
  allCategories: Category[];
  onClose: () => void;
}

export function CategoryFormModal({ category, allCategories, onClose }: Props) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const { toast } = useToast();
  const isEdit = !!category;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      parent_id: category?.parent_id ?? null,
    },
  });

  const parentId = watch("parent_id");

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    try {
      const payload = {
        name: data.name,
        description: data.description,
        parent_id: data.parent_id ?? null,
      };
      if (isEdit) {
        await update.mutateAsync({ id: category!.id, payload });
        toast({
          variant: "success",
          title: "Categoría actualizada",
          description: `"${data.name}" actualizada.`,
        });
      } else {
        await create.mutateAsync(payload);
        toast({
          variant: "success",
          title: "Categoría creada",
          description: `"${data.name}" creada.`,
        });
      }
      onClose();
    } catch (err: unknown) {
      setFormError(
        getApiErrorMessage(
          err,
          "No se pudo guardar la categoría. Intenta nuevamente.",
          {
            PARENT_CATEGORY_NOT_FOUND:
              "La categoría padre seleccionada no existe o está inactiva.",
            CATEGORY_NOT_FOUND: "La categoría ya no existe.",
          },
        ),
      );
    }
  };

  const availableParents = allCategories.filter(
    (c) => c.is_active && c.id !== category?.id,
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FormField label="Nombre" required error={errors.name?.message}>
              <Input {...register("name")} />
            </FormField>
            <FormField label="Descripción (opcional)">
              <Input {...register("description")} />
            </FormField>
            <FormField label="Categoría padre (opcional)">
              <TreeSelector
                categories={availableParents}
                value={parentId ?? null}
                onChange={(id) => setValue("parent_id", id)}
                placeholder="Sin padre (raíz)"
                allowRootOption
                rootLabel="Sin padre / categoría raíz"
              />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
