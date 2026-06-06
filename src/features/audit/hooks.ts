import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AuditLog, AuditAction } from '@/types/api'

export interface AuditFilters {
  date_from?: string
  date_to?: string
  user_id?: number
  action?: AuditAction
  entity_type?: string
  entity_id?: string
  cursor?: number
}

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: ['audit', filters],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50, ...filters }
      Object.keys(params).forEach((k) => params[k] === undefined && delete params[k])
      const res = await api.get<AuditLog[]>('/audit', { params })
      return res.data
    },
    enabled: !!(filters.date_from && filters.date_to),
  })
}
