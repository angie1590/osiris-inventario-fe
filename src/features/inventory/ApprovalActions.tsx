import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useApproveDocument, useSetApprovalCode } from "./hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { InventoryDocument } from "@/types/api";

const approveSchema = z.object({
  authorization_code: z.string().length(8, "El código debe tener 8 caracteres"),
});

interface Props {
  doc: InventoryDocument;
}

export function ApprovalActions({ doc }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showSetCodeModal, setShowSetCodeModal] = useState(false);
  const approve = useApproveDocument();
  const setApprovalCode = useSetApprovalCode();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(approveSchema),
  });

  const {
    register: registerCode,
    handleSubmit: handleSubmitCode,
    formState: { errors: codeErrors, isSubmitting: isSubmittingCode },
    reset: resetCode,
  } = useForm<{ approval_code: string }>({
    defaultValues: { approval_code: "" },
  });

  if (doc.status !== "pending") return null;

  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const canApprove = isAdmin || isSupervisor;
  const approvableType =
    doc.doc_type === "BI" || doc.doc_type === "AI" ? doc.doc_type : null;

  if (!canApprove) return null;

  const handleApprove = async (data: { authorization_code: string }) => {
    if (!approvableType) return;
    try {
      await approve.mutateAsync({
        id: doc.id,
        docType: approvableType,
        payload: { authorization_code: data.authorization_code },
      });
      toast({ title: "Documento aprobado" });
      setShowApproveModal(false);
      reset();
    } catch (err: unknown) {
      const responseData = (
        err as {
          response?: { data?: { code?: string; detail?: { code?: string } } };
        }
      )?.response?.data;
      const code = responseData?.code ?? responseData?.detail?.code;
      if (code === "APPROVAL_CODE_INVALID") {
        toast({
          variant: "destructive",
          description: "Código de aprobación inválido",
        });
      } else if (code === "APPROVAL_CODE_NOT_CONFIGURED") {
        toast({
          variant: "warning",
          description: "Primero configura tu código personal de aprobación",
        });
        setShowApproveModal(false);
        setShowSetCodeModal(true);
      } else if (code === "INSUFFICIENT_STOCK") {
        toast({
          variant: "destructive",
          description: "No hay stock suficiente para aprobar este documento.",
        });
      } else if (code === "DOCUMENT_NOT_PENDING") {
        toast({
          variant: "warning",
          description: "El documento ya no está pendiente.",
        });
      } else {
        toast({
          variant: "destructive",
          description: "Error al aprobar el documento",
        });
      }
    }
  };

  const handleSetCode = async (data: { approval_code: string }) => {
    try {
      const normalized = data.approval_code
        .toUpperCase()
        .replace(/[^A-F0-9]/g, "")
        .slice(0, 8);
      await setApprovalCode.mutateAsync({ approval_code: normalized });
      toast({
        title: "Código configurado",
        description: "Ya puedes usar este código para aprobar documentos.",
      });
      setShowSetCodeModal(false);
      resetCode();
    } catch (err: unknown) {
      const responseData = (
        err as {
          response?: { data?: { code?: string; detail?: { code?: string } } };
        }
      )?.response?.data;
      const code = responseData?.code ?? responseData?.detail?.code;
      if (code === "INVALID_APPROVAL_CODE_FORMAT") {
        toast({
          variant: "destructive",
          description:
            "El código debe tener 8 caracteres hexadecimales (A-F, 0-9).",
        });
      } else {
        toast({
          variant: "destructive",
          description: "No se pudo guardar el código de aprobación",
        });
      }
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {canApprove && (
          <Button variant="outline" onClick={() => setShowSetCodeModal(true)}>
            <Shield className="mr-2 h-4 w-4" />
            Configurar código
          </Button>
        )}
        {canApprove && (
          <Button onClick={() => setShowApproveModal(true)}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Aprobar
          </Button>
        )}
      </div>

      {showSetCodeModal && (
        <Dialog
          open
          onOpenChange={() => {
            setShowSetCodeModal(false);
            resetCode();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar código de aprobación</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Define tu código personal (8 caracteres hexadecimales). Se usará
              para aprobar bajas y ajustes.
            </p>
            <form
              onSubmit={handleSubmitCode(handleSetCode)}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium">Código personal</Label>
                <Input
                  {...registerCode("approval_code", {
                    required: "Código requerido",
                    minLength: { value: 8, message: "Debe tener 8 caracteres" },
                    maxLength: { value: 8, message: "Debe tener 8 caracteres" },
                  })}
                  placeholder="Ej. A1B2C3D4"
                  maxLength={8}
                  autoComplete="one-time-code"
                  className="h-11 text-center text-lg font-mono tracking-[0.25em] uppercase"
                  onChange={(e) => {
                    e.target.value = e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/g, "")
                      .slice(0, 8);
                  }}
                />
                {codeErrors.approval_code && (
                  <p className="text-xs text-destructive">
                    {codeErrors.approval_code.message}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowSetCodeModal(false);
                    resetCode();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmittingCode}>
                  Guardar código
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {showApproveModal && canApprove && (
        <Dialog
          open
          onOpenChange={() => {
            setShowApproveModal(false);
            reset();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Aprobar documento</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Ingresa tu código personal de aprobación (admin/supervisor).
            </p>
            <form onSubmit={handleSubmit(handleApprove)} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Código de autorización
                </Label>
                <Input
                  {...register("authorization_code")}
                  placeholder="Ej. A1B2C3D4"
                  maxLength={8}
                  autoComplete="one-time-code"
                  className="h-11 text-center text-lg font-mono tracking-[0.25em] uppercase"
                  onChange={(e) => {
                    e.target.value = e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/g, "")
                      .slice(0, 8);
                  }}
                />
                {errors.authorization_code && (
                  <p className="text-xs text-destructive">
                    {errors.authorization_code.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Si aún no lo definiste, usa “Configurar código”.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowApproveModal(false);
                    reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Aprobar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
