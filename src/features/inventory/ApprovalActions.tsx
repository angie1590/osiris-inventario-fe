import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useGenerateAuthCode, useApproveDocument } from './hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import type { InventoryDocument } from '@/types/api'

const approveSchema = z.object({
  authorization_code: z.string().min(1, 'Código requerido'),
})

interface Props {
  doc: InventoryDocument
}

export function ApprovalActions({ doc }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const generateCode = useGenerateAuthCode(doc.id)
  const approve = useApproveDocument()

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
    resolver: zodResolver(approveSchema),
  })

  if (doc.status !== 'pending') return null

  const isAdmin = user?.role === 'admin'

  const handleGenerateCode = async () => {
    try {
      const res = await generateCode.mutateAsync()
      setGeneratedCode(res.authorization_code)
      setShowOtpModal(true)
    } catch {
      toast({ variant: 'destructive', description: 'Error al generar el código de autorización' })
    }
  }

  const handleApprove = async (data: { authorization_code: string }) => {
    try {
      await approve.mutateAsync({ id: doc.id, payload: { authorization_code: data.authorization_code } })
      toast({ title: 'Documento aprobado' })
      setShowApproveModal(false)
      reset()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
      if (code === 'AUTHORIZATION_CODE_INVALID')
        toast({ variant: 'destructive', description: 'Código de autorización inválido o expirado' })
      else
        toast({ variant: 'destructive', description: 'Error al aprobar el documento' })
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {isAdmin && (
          <Button variant="outline" onClick={handleGenerateCode} disabled={generateCode.isPending}>
            <KeyRound className="mr-2 h-4 w-4" />Generar código OTP
          </Button>
        )}
        <Button onClick={() => setShowApproveModal(true)}>
          <CheckCircle className="mr-2 h-4 w-4" />Aprobar
        </Button>
      </div>

      {showOtpModal && generatedCode && (
        <Dialog open onOpenChange={() => setShowOtpModal(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Código de Autorización</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground">Comparte este código con el autorizador:</p>
              <div className="select-all rounded-lg bg-muted px-8 py-4 text-4xl font-mono font-bold tracking-widest">
                {generatedCode}
              </div>
              <p className="text-xs text-muted-foreground">El código expira en pocos minutos</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowOtpModal(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showApproveModal && (
        <Dialog open onOpenChange={() => { setShowApproveModal(false); reset() }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Aprobar documento</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(handleApprove)} className="space-y-4">
              <div className="space-y-1">
                <Label>Código de autorización</Label>
                <Input {...register('authorization_code')} placeholder="Ingresa el código OTP" className="text-center text-lg font-mono" />
                {errors.authorization_code && (
                  <p className="text-xs text-destructive">{errors.authorization_code.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowApproveModal(false); reset() }}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>Aprobar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
