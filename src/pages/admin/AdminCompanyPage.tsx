import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, Link, Pencil, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/shared/FormField'
import { PageHeader } from '@/components/shared/PageHeader'
import { Section } from '@/components/shared/Section'
import { useCompanyConfig, useCreateCompany, useUpdateCompany } from '@/features/admin/hooks'
import { useToast } from '@/hooks/use-toast'

const LOGO_MAX_BYTES = 2 * 1024 * 1024

const schema = z.object({
  razon_social: z.string().min(1, 'Requerido'),
  ruc: z.string().min(1, 'Requerido'),
  email: z.string().min(1, 'Requerido').email('Email inválido'),
  nombre_comercial: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type ApiError = {
  response?: {
    data?: {
      code?: string
      message?: string
      errors?: Record<string, string>
    }
  }
}

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || '—'}</p>
    </div>
  )
}

export default function AdminCompanyPage() {
  const { toast } = useToast()
  const { data: company, isLoading } = useCompanyConfig()
  const create = useCreateCompany()
  const update = useUpdateCompany()

  const [editing, setEditing] = useState(false)
  const [logo, setLogo] = useState<string | undefined>(undefined)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [logoTab, setLogoTab] = useState<'file' | 'url'>('file')
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!company
  // Show the form for first-time setup (no company yet) or when explicitly editing.
  const showForm = !company || editing

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: company
      ? {
          razon_social: company.razon_social,
          ruc: company.ruc,
          email: company.email,
          nombre_comercial: company.nombre_comercial ?? '',
          direccion: company.direccion ?? '',
          telefono: company.telefono ?? '',
        }
      : undefined,
  })

  const currentLogoSrc = logoPreview ?? company?.logo ?? null

  function startEditing() {
    setFormError(null)
    setLogo(undefined)
    setLogoPreview(null)
    setLogoUrl('')
    setLogoTab('file')
    setEditing(true)
  }

  function cancelEditing() {
    setFormError(null)
    setLogo(undefined)
    setLogoPreview(null)
    setLogoUrl('')
    if (company) {
      reset({
        razon_social: company.razon_social,
        ruc: company.ruc,
        email: company.email,
        nombre_comercial: company.nombre_comercial ?? '',
        direccion: company.direccion ?? '',
        telefono: company.telefono ?? '',
      })
    }
    setEditing(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > LOGO_MAX_BYTES) {
      setFormError('El logo debe pesar máximo 2 MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setLogo(result)
      setLogoPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const onSubmit = async (data: FormData) => {
    setFormError(null)
    const logoValue = logoTab === 'url' ? (logoUrl || undefined) : logo
    const payload = {
      razon_social: data.razon_social,
      ruc: data.ruc,
      email: data.email,
      nombre_comercial: data.nombre_comercial || undefined,
      direccion: data.direccion || undefined,
      telefono: data.telefono || undefined,
      ...(logoValue !== undefined && { logo: logoValue }),
    }

    try {
      if (isEdit) {
        await update.mutateAsync(payload)
        toast({ title: 'Configuración actualizada' })
      } else {
        await create.mutateAsync(payload)
        toast({ title: 'Configuración guardada' })
      }
      setLogo(undefined)
      setLogoPreview(null)
      setLogoUrl('')
      setEditing(false)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      const fieldErrors = apiErr?.response?.data?.errors
      const msg = apiErr?.response?.data?.message ?? 'Error al guardar la configuración'

      if (fieldErrors) {
        const knownFields: (keyof FormData)[] = ['razon_social', 'ruc', 'email', 'nombre_comercial', 'direccion', 'telefono']
        knownFields.forEach((field) => {
          if (fieldErrors[field]) {
            setError(field, { message: fieldErrors[field] })
          }
        })
      }

      setFormError(msg)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  // ── View mode: company configured and not editing ─────────────────────────
  if (!showForm && company) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Configuración de Empresa"
          actions={
            <Button onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />Editar
            </Button>
          }
        />

        <Section title="Datos de la empresa">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ViewField label="Razón Social" value={company.razon_social} />
            </div>
            <ViewField label="Nombre Comercial" value={company.nombre_comercial} />
            <ViewField label="RUC" value={company.ruc} />
            <ViewField label="Email" value={company.email} />
            <ViewField label="Teléfono" value={company.telefono} />
            <div className="sm:col-span-2">
              <ViewField label="Dirección" value={company.direccion} />
            </div>
          </div>
        </Section>

        <Section title="Logo">
          {company.logo ? (
            <img src={company.logo} alt="Logo de la empresa" className="h-20 max-w-64 rounded border object-contain" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Sin logo configurado
            </div>
          )}
        </Section>
      </div>
    )
  }

  // ── Form mode: first-time setup or editing ────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Configuración de Empresa" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Section title="Datos de la empresa">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Razón Social" required error={errors.razon_social?.message} className="col-span-2">
              <Input id="razon_social" {...register('razon_social')} />
            </FormField>

            <FormField label="Nombre Comercial" error={errors.nombre_comercial?.message}>
              <Input id="nombre_comercial" {...register('nombre_comercial')} />
            </FormField>

            <FormField label="RUC" required error={errors.ruc?.message}>
              <Input id="ruc" {...register('ruc')} />
            </FormField>

            <FormField label="Email" required error={errors.email?.message}>
              <Input id="email" type="email" {...register('email')} />
            </FormField>

            <FormField label="Teléfono" error={errors.telefono?.message}>
              <Input id="telefono" {...register('telefono')} />
            </FormField>

            <FormField label="Dirección" error={errors.direccion?.message} className="col-span-2">
              <Input id="direccion" {...register('direccion')} />
            </FormField>
          </div>
        </Section>

        <Section title="Logo">
          {currentLogoSrc && (
            <div className="flex items-center gap-3">
              <img src={currentLogoSrc} alt="Logo actual" className="h-16 max-w-48 rounded border object-contain" />
              <span className="text-xs text-muted-foreground">Logo actual</span>
            </div>
          )}

          <Tabs value={logoTab} onValueChange={(v) => setLogoTab(v as 'file' | 'url')}>
            <TabsList>
              <TabsTrigger value="file"><Upload className="mr-1.5 h-3.5 w-3.5" />Subir archivo</TabsTrigger>
              <TabsTrigger value="url"><Link className="mr-1.5 h-3.5 w-3.5" />URL directa</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-2 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
              />
              <p className="text-xs text-muted-foreground">Máximo 2 MB. Se convertirá a base64.</p>
            </TabsContent>

            <TabsContent value="url" className="pt-2">
              <Input
                placeholder="https://ejemplo.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </TabsContent>
          </Tabs>
        </Section>

        <div className="flex justify-end gap-2">
          {isEdit && (
            <Button type="button" variant="outline" onClick={cancelEditing} disabled={isSubmitting}>
              Cancelar
            </Button>
          )}
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Actualizar' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
