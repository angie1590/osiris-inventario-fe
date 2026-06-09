import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Catalog, CatalogValue } from '@/types/api'

export function useCatalogs() {
  return useQuery({
    queryKey: ['catalogs'],
    queryFn: () => api.get<Catalog[]>('/catalogs').then((r) => r.data),
  })
}

export function useCatalogValues(catalogId: number | null | undefined, includeInactive = true) {
  return useQuery({
    queryKey: ['catalog-values', catalogId, includeInactive],
    queryFn: () =>
      api
        .get<CatalogValue[]>(`/catalogs/${catalogId}/values`, { params: { include_inactive: includeInactive } })
        .then((r) => r.data),
    enabled: catalogId != null,
  })
}

export function useCreateCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      api.post<Catalog>('/catalogs', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogs'] }),
  })
}

export function useUpdateCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name?: string; description?: string } }) =>
      api.patch<Catalog>(`/catalogs/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogs'] }),
  })
}

export function useDeleteCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/catalogs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogs'] }),
  })
}

export function useAddCatalogValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ catalogId, value }: { catalogId: number; value: string }) =>
      api.post<CatalogValue>(`/catalogs/${catalogId}/values`, { value }).then((r) => r.data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['catalog-values', v.catalogId] })
      qc.invalidateQueries({ queryKey: ['catalogs'] })
    },
  })
}

export function useUpdateCatalogValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ catalogId, valueId, value }: { catalogId: number; valueId: number; value: string }) =>
      api.patch<CatalogValue>(`/catalogs/${catalogId}/values/${valueId}`, { value }).then((r) => r.data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['catalog-values', v.catalogId] }),
  })
}

export function useToggleCatalogValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ catalogId, valueId, active }: { catalogId: number; valueId: number; active: boolean }) =>
      api
        .post<CatalogValue>(`/catalogs/${catalogId}/values/${valueId}/${active ? 'reactivate' : 'deactivate'}`)
        .then((r) => r.data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['catalog-values', v.catalogId] })
      qc.invalidateQueries({ queryKey: ['catalogs'] })
    },
  })
}
