import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, Link } from 'lucide-react'
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

export default function AdminCompanyPage() {
  const { toast } = useToast()
  const { data: company, isLoading } = useCompanyConfig()
  const create = useCreateCompany()
  const update = useUpdateCompany()

  const [logo, setLogo] = useState<string | undefined>(undefined)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [logoTab, setLogoTab] = useState<'file' | 'url'>('file')
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!company

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > LOGO_MAX_BYTES) {
      setFormError('El logo debe pesar maximo 2 MB.')
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
        const saved = await update.mutateAsync(payload)
        reset({
          razon_social: saved.razon_social,
          ruc: saved.ruc,
          email: saved.email,
          nombre_comercial: saved.nombre_comercial ?? '',
          direccion: saved.direccion ?? '',
          telefono: saved.telefono ?? '',
        })
        setLogoPreview(saved.logo ?? null)
        setLogo(undefined)
        toast({ title: 'Configuración actualizada' })
      } else {
        const saved = await create.mutateAsync(payload)
        reset({
          razon_social: saved.razon_social,
          ruc: saved.ruc,
          email: saved.email,
          nombre_comercial: saved.nombre_comercial ?? '',
          direccion: saved.direccion ?? '',
          telefono: saved.telefono ?? '',
        })
        setLogoPreview(saved.logo ?? null)
        setLogo(undefined)
        setLogoUrl('')
        toast({ title: 'Configuración guardada' })
      }
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
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
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
              <img src={currentLogoSrc} alt="Logo actual" className="h-16 max-w-48 object-contain rounded border" />
              <span className="text-xs text-muted-foreground">Logo actual</span>
            </div>
          )}

          <Tabs value={logoTab} onValueChange={(v) => setLogoTab(v as 'file' | 'url')}>
            <TabsList>
              <TabsTrigger value="file"><Upload className="h-3.5 w-3.5 mr-1.5" />Subir archivo</TabsTrigger>
              <TabsTrigger value="url"><Link className="h-3.5 w-3.5 mr-1.5" />URL directa</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-2 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-sm text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
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

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Actualizar' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
