import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AuditLog, AuditAction, PageResponse } from "@/types/api";

export interface AuditUserOption {
  id: number;
  username: string;
  full_name: string;
}

export interface AuditFilters {
  date_from?: string;
  date_to?: string;
  user_id?: number;
  action?: AuditAction;
  entity_type?: string;
  entity_id?: string;
  cursor?: number;
  page?: number;
  page_size?: number;
}

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50, ...filters };
      Object.keys(params).forEach(
        (k) => params[k] === undefined && delete params[k],
      );
      const res = await api.get<AuditLog[]>("/audit", { params });
      return res.data;
    },
    enabled: !!(filters.date_from && filters.date_to),
  });
}

export function useAuditLogsPage(filters: AuditFilters) {
  return useQuery({
    queryKey: ["audit", "page", filters],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        ...filters,
        page: filters.page ?? 1,
        page_size: filters.page_size ?? 10,
      };
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key],
      );
      const res = await api.get<PageResponse<AuditLog>>("/audit/page", {
        params,
      });
      return res.data;
    },
    enabled: !!(filters.date_from && filters.date_to),
  });
}

export function useAuditUsers(search?: string) {
  return useQuery({
    queryKey: ["audit-users", search],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (search) params.search = search;
      const res = await api.get<AuditUserOption[]>("/audit/users", { params });
      return res.data;
    },
    staleTime: 30_000,
  });
}
