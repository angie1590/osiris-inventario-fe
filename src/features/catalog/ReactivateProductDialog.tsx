import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/shared/FormField'
import { TreeSelector } from '@/components/shared/TreeSelector'
import { useCategories, useToggleProductStatus } from './hooks'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api-error'
import type { Product } from '@/types/api'

/**
 * Shown when reactivating a product whose original category was deleted. Forces
 * the user to pick an active category so the product never points to a dangling
 * (inactive) category.
 */
export function ReactivateProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data: categories } = useCategories()
  const toggle = useToggleProductStatus()
  const { toast } = useToast()
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setFormError(null)
    if (categoryId == null) {
      setFormError('Selecciona una categoría activa para reactivar el producto.')
      return
    }
    setSubmitting(true)
    try {
      await toggle.mutateAsync({ id: product.id, status: 'active', categoryId })
      toast({ variant: 'success', title: 'Producto reactivado', description: `"${product.name}" reactivado.` })
      onClose()
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err, 'No se pudo reactivar el producto. Intenta nuevamente.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !submitting) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reactivar producto</DialogTitle></DialogHeader>
        <DialogBody className="space-y-3">
          {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
          <p className="text-sm text-muted-foreground">
            La categoría de <strong>{product.name}</strong> fue eliminada. Selecciona una categoría activa para reactivarlo.
          </p>
          <FormField label="Categoría" required>
            <TreeSelector
              categories={(categories ?? []).filter((c) => !c.is_default)}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Selecciona una categoría"
              leafOnly
            />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} isLoading={submitting}>Reactivar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
