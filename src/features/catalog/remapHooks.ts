import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AttributeDataType } from '@/types/api'

export interface RemapItem {
  id: number
  product_id: number
  product_name: string
  old_value: string | null
}

export interface RemapGroup {
  attribute_id: number
  attribute_name: string
  target_type: AttributeDataType
  is_required: boolean
  catalog_id: number | null
  allowed_values: string[] | null
  items: RemapItem[]
}

export interface RemapPending {
  total: number
  groups: RemapGroup[]
}

export function usePendingRemap() {
  return useQuery<RemapPending>({
    queryKey: ['attribute-remap', 'pending'],
    queryFn: () => api.get<RemapPending>('/attribute-remap/pending').then((r) => r.data),
    staleTime: 60 * 1000,
  })
}

export function useResolveRemap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assignments: { id: number; value: unknown }[]) =>
      api.post('/attribute-remap/resolve', { assignments }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attribute-remap'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
