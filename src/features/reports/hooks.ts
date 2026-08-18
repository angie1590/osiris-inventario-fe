import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  ConsolidadoReport,
  VentasReport,
  StockValorizadoReport,
  Product,
  DailyClosingReport,
} from "@/types/api";

export interface ReportFilters {
  date_from?: string;
  date_to?: string;
  product_id?: number;
  user_id?: number;
  category_id?: number;
  bajo_stock?: boolean;
}

export function useDailyClosing(date?: string) {
  return useQuery({
    queryKey: ["reports", "cierre-dia", date],
    queryFn: async () => {
      const res = await api.get<DailyClosingReport>("/reports/cierre-dia", {
        params: { date },
      });
      return res.data;
    },
    enabled: Boolean(date),
  });
}

interface QueryOptions {
  enabled?: boolean;
}

function buildParams(filters: ReportFilters) {
  const params: Record<string, unknown> = { ...filters };
  Object.keys(params).forEach(
    (k) => params[k] === undefined && delete params[k],
  );
  if (params.bajo_stock === false) delete params.bajo_stock;
  return params;
}

export function useConsolidado(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "consolidado", filters],
    queryFn: async () => {
      const res = await api.get<ConsolidadoReport>("/reports/consolidado", {
        params: buildParams(filters),
      });
      return res.data;
    },
    enabled: !!(filters.date_from && filters.date_to),
  });
}

export function useVentas(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "ventas", filters],
    queryFn: async () => {
      const res = await api.get<VentasReport>("/reports/ventas", {
        params: buildParams(filters),
      });
      return res.data;
    },
    enabled: !!(filters.date_from && filters.date_to),
  });
}

export function useStockReport(
  filters: ReportFilters,
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: ["reports", "stock", filters],
    queryFn: async () => {
      const res = await api.get<Product[]>("/reports/stock", {
        params: buildParams(filters),
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });
}

export function useStockValorizado(
  filters: ReportFilters,
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: ["reports", "stock-valorizado", filters],
    queryFn: async () => {
      const res = await api.get<StockValorizadoReport>(
        "/reports/stock-valorizado",
        { params: buildParams(filters) },
      );
      return res.data;
    },
    enabled: options.enabled ?? true,
  });
}
