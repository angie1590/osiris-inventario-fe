import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import api from '@/lib/api'
import type { User, CreateUserPayload, UpdateUserPayload, SystemParam, CompanyConfig, CreateCompanyPayload, UpdateCompanyPayload } from '@/types/api'

export function useUsers(search?: string, role?: string) {
  return useQuery({
    queryKey: ['users', search, role],
    queryFn: async () => {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (role) params.role = role
      const res = await api.get<User[]>('/admin/users', { params })
      return res.data
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const res = await api.post<User>('/admin/users', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateUserPayload }) => {
      const res = await api.patch<User>(`/admin/users/${id}`, payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/users/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useSystemParams() {
  return useQuery({
    queryKey: ['system-params'],
    queryFn: async () => {
      const res = await api.get<SystemParam[]>('/admin/params')
      return res.data
    },
  })
}

export function useUpdateParam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await api.patch<SystemParam>(`/admin/params/${encodeURIComponent(key)}`, { value })
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-params'] }),
  })
}

export function useCompanyConfig() {
  return useQuery({
    queryKey: ['company-config'],
    queryFn: async () => {
      try {
        const res = await api.get<CompanyConfig>('/company')
        return res.data
      } catch (err) {
        // The backend returns 404 when the company is not configured yet —
        // that is a valid "no company" state, not an error.
        if (isAxiosError(err) && err.response?.status === 404) return null
        throw err
      }
    },
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCompanyPayload) => {
      const res = await api.post<CompanyConfig>('/company', payload)
      return res.data
    },
    onSuccess: (saved) => {
      qc.setQueryData(['company-config'], saved)
      qc.invalidateQueries({ queryKey: ['company-config'] })
    },
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateCompanyPayload) => {
      const res = await api.patch<CompanyConfig>('/company', payload)
      return res.data
    },
    onSuccess: (saved) => {
      qc.setQueryData(['company-config'], saved)
      qc.invalidateQueries({ queryKey: ['company-config'] })
    },
  })
}
