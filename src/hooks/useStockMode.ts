import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface AppSettings {
  stock_quantity_mode: 'integer' | 'decimal'
  internal_code_enabled?: boolean
  isbn_required?: boolean
}

function useSettings() {
  return useQuery<AppSettings>({
    queryKey: ['reports', 'settings'],
    queryFn: async () => (await api.get('/reports/settings')).data,
    staleTime: 5 * 60 * 1000,
  })
}

/** Reads the configured stock quantity mode (integer vs decimal). */
export function useStockMode() {
  const { data } = useSettings()
  const mode = data?.stock_quantity_mode ?? 'integer'
  return { mode, integerMode: mode === 'integer' }
}

/** Whether the optional product internal code is enabled in system params. */
export function useInternalCodeEnabled() {
  const { data } = useSettings()
  return data?.internal_code_enabled ?? true
}

/** Whether ISBN is mandatory on products (system param). */
export function useIsbnRequired() {
  const { data } = useSettings()
  return data?.isbn_required ?? false
}

/** Format a quantity respecting the stock mode: integers show no decimals,
 * decimals show the natural value (trailing zeros trimmed). */
export function formatQuantity(value: number | string, integerMode: boolean): string {
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  return integerMode ? String(Math.trunc(n)) : String(n)
}
