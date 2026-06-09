import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type {
  Category, CategoryAttribute, Product,
  CreateCategoryPayload, CreateAttributePayload, UpdateAttributePayload,
  CreateProductPayload, UpdateProductPayload, ProductStatus,
} from '@/types/api'

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCategories(cursor?: number) {
  return useQuery({
    queryKey: ['categories', cursor],
    queryFn: () => api.get<Category[]>('/categories', { params: { cursor, limit: 200 } }).then((r) => r.data),
  })
}

export function useCategory(id: number) {
  return useQuery({
    queryKey: ['category', id],
    queryFn: () => api.get<Category>(`/categories/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCategoryAttributes(id: number) {
  return useQuery({
    queryKey: ['category-attributes', id],
    queryFn: () => api.get<CategoryAttribute[]>(`/categories/${id}/attributes`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) =>
      api.post<Category & { products_moved?: number }>('/categories', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateCategoryPayload> }) =>
      api.patch<Category>(`/categories/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, deleteProducts }: { id: number; deleteProducts?: boolean }) =>
      api.delete(`/categories/${id}`, deleteProducts ? { params: { delete_products: true } } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useCreateAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: number; payload: CreateAttributePayload }) =>
      api.post<CategoryAttribute>(`/categories/${categoryId}/attributes`, payload).then((r) => r.data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['category-attributes', v.categoryId] }),
  })
}

export function useDeleteAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, attrId }: { categoryId: number; attrId: number }) =>
      api.delete(`/categories/${categoryId}/attributes/${attrId}`),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['category-attributes', v.categoryId] }),
  })
}

export function useUpdateAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, attrId, payload }: { categoryId: number; attrId: number; payload: UpdateAttributePayload }) =>
      api.patch<CategoryAttribute & { remap_pending?: number }>(`/categories/${categoryId}/attributes/${attrId}`, payload).then((r) => r.data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['category-attributes', v.categoryId] })
      qc.invalidateQueries({ queryKey: ['attribute-remap'] })
      qc.invalidateQueries({ queryKey: ['catalogs'] })
    },
  })
}

export function useDeactivateAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, attrId }: { categoryId: number; attrId: number }) =>
      api.post<CategoryAttribute>(`/categories/${categoryId}/attributes/${attrId}/deactivate`).then((r) => r.data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['category-attributes', v.categoryId] }),
  })
}

export function useReactivateAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, attrId }: { categoryId: number; attrId: number }) =>
      api.post<CategoryAttribute>(`/categories/${categoryId}/attributes/${attrId}/reactivate`).then((r) => r.data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['category-attributes', v.categoryId] }),
  })
}

// ─── Products ────────────────────────────────────────────────────────────────

interface ProductFilters {
  name?: string
  category_id?: number
  status?: ProductStatus
  bajo_stock?: boolean
  cursor?: number
  limit?: number
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => api.get<Product[]>('/products', { params: { ...filters, limit: filters.limit ?? 50 } }).then((r) => r.data),
  })
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/products/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function usePendingRecategorization() {
  return useQuery({
    queryKey: ['products', 'pending-recategorization'],
    queryFn: () => api.get<Product[]>('/products/pending-recategorization').then((r) => r.data),
    staleTime: 60 * 1000,
  })
}

export function useRecategorize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assignments: { product_id: number; category_id: number }[]) =>
      api.post('/products/recategorize', { assignments }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProductPayload) => api.post<Product>('/products', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateProductPayload }) =>
      api.patch<Product>(`/products/${id}`, payload).then((r) => r.data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product', v.id] })
    },
  })
}

export function useToggleProductStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, categoryId }: { id: number; status: ProductStatus; categoryId?: number }) =>
      api.patch<Product>(`/products/${id}/status`, categoryId != null ? { status, category_id: categoryId } : { status }).then((r) => r.data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product', v.id] })
    },
  })
}
