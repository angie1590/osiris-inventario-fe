import { useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useRevertSaleExchange } from "./hooks";
import { formatCurrency } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import type { InventoryDocument } from "@/types/api";

interface Props {
  doc: InventoryDocument;
  documentId?: number;
  onClose: () => void;
  onReverted: () => void;
}

export function RevertSaleExchangeDialog({ doc, documentId, onClose, onReverted }: Props) {
  const { user } = useAuth();
  const revert = useRevertSaleExchange();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const needsPin = user?.role === "operator";
  const refunded = Number(doc.amount_received || 0);

  const onConfirm = async () => {
    const authorizerPin = pin.replace(/\D/g, "").slice(0, 4);
    if (needsPin && authorizerPin.length !== 4) {
      setError("Ingresa un PIN de 4 dígitos de un supervisor o administrador.");
      return;
    }
    try {
      await revert.mutateAsync({ id: documentId ?? doc.id, authorizerPin: needsPin ? authorizerPin : undefined });
      onReverted();
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "No se pudo revertir el cambio.", {
        VOID_PIN_REQUIRED: "Se requiere el PIN de un supervisor o administrador.",
        VOID_PIN_INVALID: "PIN de autorización inválido.",
        EXCHANGE_REVERSAL_NOT_APPROVED: "Los documentos del cambio ya no se pueden revertir.",
        CANNOT_VOID_STOCK_CONSUMED: "No se puede revertir: el stock ya fue consumido por movimientos posteriores.",
      }));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !revert.isPending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Revertir cambio {doc.number}</DialogTitle>
          <DialogDescription>
            Se anularán la nueva venta y su devolución. {documentId ? "Se reembolsará el saldo cobrado del cambio." : `Se reembolsará ${formatCurrency(refunded)}.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {needsPin && <Input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN de 4 dígitos" maxLength={4} />}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={revert.isPending}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void onConfirm()} isLoading={revert.isPending}>Revertir y reembolsar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}