import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { User, CreateUserPayload, UpdateUserPayload, SystemParam } from '@/types/api'

export function useUsers(search?: string, role?: string) {
  return useQuery({
    queryKey: ['users', search, role],
    queryFn: async () => {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (role) params.role = role
      const res = await api.get<User[]>('/users/', { params })
      return res.data
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const res = await api.post<User>('/users/', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateUserPayload }) => {
      const res = await api.patch<User>(`/users/${id}`, payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}`)
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
    mutationFn: async ({ id, value }: { id: number; value: string }) => {
      const res = await api.patch<SystemParam>(`/admin/params/${id}`, { value })
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-params'] }),
  })
}
