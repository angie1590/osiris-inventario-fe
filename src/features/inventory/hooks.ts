import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type {
  InventoryDocument,
  CreateIngresoPayload,
  CreateEgresoPayload,
  CreateBajaPayload,
  CreateAjustePayload,
  AuthCodeResponse,
  ApprovePayload,
} from '@/types/api'

export interface DocumentFilters {
  date_from?: string
  date_to?: string
  product_id?: number
  status?: string
  cursor?: number
}

async function fetchDocuments(docType: string, filters: DocumentFilters): Promise<InventoryDocument[]> {
  const params: Record<string, unknown> = { doc_type: docType, limit: 50, ...filters }
  Object.keys(params).forEach((k) => params[k] === undefined && delete params[k])
  const res = await api.get<InventoryDocument[]>('/inventory/', { params })
  return res.data
}

export function useIngresos(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: ['inventory', 'IN', filters],
    queryFn: () => fetchDocuments('IN', filters),
  })
}

export function useEgresos(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: ['inventory', 'EG', filters],
    queryFn: () => fetchDocuments('EG', filters),
  })
}

export function useBajas(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: ['inventory', 'BI', filters],
    queryFn: () => fetchDocuments('BI', filters),
  })
}

export function useAjustes(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: ['inventory', 'AI', filters],
    queryFn: () => fetchDocuments('AI', filters),
  })
}

export function useDocument(id: number) {
  return useQuery({
    queryKey: ['inventory', 'document', id],
    queryFn: async () => {
      const res = await api.get<InventoryDocument>(`/inventory/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateIngreso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateIngresoPayload) => {
      const res = await api.post<InventoryDocument>('/inventory/ingresos', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'IN'] }),
  })
}

export function useCreateEgreso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateEgresoPayload) => {
      const res = await api.post<InventoryDocument>('/inventory/egresos', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'EG'] }),
  })
}

export function useCreateBaja() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateBajaPayload) => {
      const res = await api.post<InventoryDocument>('/inventory/bajas', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'BI'] }),
  })
}

export function useCreateAjuste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAjustePayload) => {
      const res = await api.post<InventoryDocument>('/inventory/ajustes', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'AI'] }),
  })
}

export function useGenerateAuthCode(documentId: number) {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<AuthCodeResponse>(`/inventory/${documentId}/authorization-code`)
      return res.data
    },
  })
}

export function useApproveDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ApprovePayload }) => {
      const res = await api.post<InventoryDocument>(`/inventory/${id}/approve`, payload)
      return res.data
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['inventory', 'document', id] })
      qc.invalidateQueries({ queryKey: ['inventory', 'BI'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'AI'] })
    },
  })
}

export function useCancelDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post<InventoryDocument>(`/inventory/${id}/cancel`)
      return res.data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['inventory', 'document', id] })
      qc.invalidateQueries({ queryKey: ['inventory', 'BI'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'AI'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'IN'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'EG'] })
    },
  })
}
