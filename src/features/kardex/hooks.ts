import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { KardexResponse } from '@/types/api'

export function useKardex(productId: number, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['kardex', productId, dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, unknown> = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await api.get<KardexResponse>(`/kardex/${productId}`, { params })
      return res.data
    },
    enabled: !!productId,
  })
}
