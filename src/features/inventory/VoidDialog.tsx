import { useState } from 'react'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/shared/FormField'
import { useVoidDocument } from './hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api-error'
import type { InventoryDocument } from '@/types/api'

interface Props {
  doc: InventoryDocument
  onClose: () => void
  /** Called after a successful void (in addition to onClose). */
  onVoided?: () => void
}

export function VoidDialog({ doc, onClose, onVoided }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const voidDoc = useVoidDocument()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Operators must provide a supervisor/admin PIN; admin & supervisor don't.
  const needsPin = user?.role === 'operator'

  const handleConfirm = async () => {
    setError(null)
    if (needsPin && !pin.trim()) {
      setError('Ingresa el PIN de un supervisor o administrador.')
      return
    }
    try {
      await voidDoc.mutateAsync({ id: doc.id, authorizerPin: needsPin ? pin.trim() : undefined })
      toast({
        variant: 'success',
        title: 'Documento anulado',
        description: `${doc.number} anulado; su efecto se revirtió en stock, Kardex y reportes.`,
      })
      onVoided?.()
      onClose()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo anular el documento.', {
        VOID_PIN_REQUIRED: 'Se requiere el PIN de un supervisor o administrador.',
        VOID_PIN_INVALID: 'PIN de autorización inválido.',
        VOID_ROLE_FORBIDDEN: 'No tienes permiso para anular documentos.',
        DOCUMENT_NOT_APPROVED: 'Solo se pueden anular documentos aprobados.',
        CANNOT_VOID_STOCK_CONSUMED: 'No se puede anular: el stock de este documento ya fue consumido por movimientos posteriores.',
      }))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !voidDoc.isPending) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anular documento {doc.number}</DialogTitle>
          <DialogDescription>
            Se revertirá su efecto en stock, Kardex y reportes. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          )}
          {needsPin ? (
            <FormField label="PIN de supervisor/administrador" required>
              <Input
                type="password"
                inputMode="text"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Código de autorización"
              />
            </FormField>
          ) : (
            <p className="text-sm text-muted-foreground">
              ¿Confirmas la anulación del documento <span className="font-medium text-foreground">{doc.number}</span>?
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={voidDoc.isPending}>Cancelar</Button>
          <Button variant="destructive" isLoading={voidDoc.isPending} onClick={handleConfirm}>Anular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
