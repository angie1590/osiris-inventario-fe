import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  AdjustmentIncrementCostPreview,
  InventoryDocument,
  InventoryCount,
  DocumentType,
  CreateIngresoPayload,
  CreateEgresoPayload,
  CreateBajaPayload,
  CreateAjustePayload,
  CreateInventoryCountPayload,
  AuthCodeResponse,
  ApprovePayload,
  InventorySupplier,
  CreateSupplierPayload,
  UpdateSupplierPayload,
  InventoryDocumentAttachment,
  SetApprovalCodePayload,
  UpdateInventoryCountPayload,
  ApplyInventoryCountPayload,
} from "@/types/api";

export interface DocumentFilters {
  date_from?: string;
  date_to?: string;
  product_id?: number;
  type?: string;
  purchase_document_number?: string;
  status?: string;
  cursor?: number;
}

interface QueryOptions {
  enabled?: boolean;
}

const DOC_ENDPOINTS: Record<DocumentType, string> = {
  IN: "ingresos",
  EG: "egresos",
  BI: "bajas",
  AI: "ajustes",
};

async function fetchDocuments(
  docType: DocumentType,
  filters: DocumentFilters,
): Promise<InventoryDocument[]> {
  const params: Record<string, unknown> = {
    limit: 50,
    date_from: filters.date_from,
    date_to: filters.date_to,
    cursor: filters.cursor,
  };

  if (docType === "IN" || docType === "EG") {
    params.product_id = filters.product_id;
    params.type = filters.type;
  }

  if (docType === "EG") {
    params.purchase_document_number = filters.purchase_document_number;
  }

  if (docType === "BI" || docType === "AI") {
    params.status = filters.status;
  }

  Object.keys(params).forEach(
    (k) => params[k] === undefined && delete params[k],
  );
  const res = await api.get<InventoryDocument[]>(
    `/inventory/${DOC_ENDPOINTS[docType]}`,
    { params },
  );
  return res.data;
}

export function useIngresos(
  filters: DocumentFilters = {},
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: ["inventory", "IN", filters],
    queryFn: () => fetchDocuments("IN", filters),
    enabled: options.enabled ?? true,
  });
}

export function useEgresos(
  filters: DocumentFilters = {},
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: ["inventory", "EG", filters],
    queryFn: () => fetchDocuments("EG", filters),
    enabled: options.enabled ?? true,
  });
}

export function useBajas(
  filters: DocumentFilters = {},
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: ["inventory", "BI", filters],
    queryFn: () => fetchDocuments("BI", filters),
    enabled: options.enabled ?? true,
  });
}

export function useAjustes(
  filters: DocumentFilters = {},
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: ["inventory", "AI", filters],
    queryFn: () => fetchDocuments("AI", filters),
    enabled: options.enabled ?? true,
  });
}

export function useConteos(
  filters: DocumentFilters = {},
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: ["inventory", "counts", filters],
    queryFn: async () => {
      const res = await api.get<InventoryCount[]>("/inventory/conteos", {
        params: {
          limit: 50,
          date_from: filters.date_from,
          date_to: filters.date_to,
          status: filters.status,
          cursor: filters.cursor,
        },
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });
}

export function useConteo(id: number) {
  return useQuery({
    queryKey: ["inventory", "count", id],
    queryFn: async () => {
      const res = await api.get<InventoryCount>(`/inventory/conteos/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useDocument(id: number, docType: DocumentType) {
  return useQuery({
    queryKey: ["inventory", "document", docType, id],
    queryFn: async () => {
      const res = await api.get<InventoryDocument>(
        `/inventory/${DOC_ENDPOINTS[docType]}/${id}`,
      );
      return res.data;
    },
    enabled: !!id && !!docType,
  });
}

export function useCreateIngreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateIngresoPayload) => {
      const res = await api.post<InventoryDocument>(
        "/inventory/ingresos",
        payload,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "IN"] }),
  });
}

export function useAdjustmentIncrementCostPreview(productIds: number[]) {
  const normalizedIds = Array.from(
    new Set(productIds.filter((id) => id > 0)),
  ).sort((a, b) => a - b);
  return useQuery({
    queryKey: ["inventory", "adjustment-positive-cost-preview", normalizedIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      normalizedIds.forEach((id) => params.append("product_ids", String(id)));
      const res = await api.get<AdjustmentIncrementCostPreview[]>(
        "/inventory/ajustes/cost-preview",
        { params },
      );
      return res.data;
    },
    enabled: normalizedIds.length > 0,
  });
}

export function useSuppliers(activeOnly = true) {
  return useQuery({
    queryKey: ["inventory", "suppliers", activeOnly],
    queryFn: async () => {
      const res = await api.get<InventorySupplier[]>("/inventory/suppliers", {
        params: { active_only: activeOnly },
      });
      return res.data;
    },
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSupplierPayload) => {
      const res = await api.post<InventorySupplier>(
        "/inventory/suppliers",
        payload,
      );
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["inventory", "suppliers"] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateSupplierPayload;
    }) => {
      const res = await api.patch<InventorySupplier>(
        `/inventory/suppliers/${id}`,
        payload,
      );
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["inventory", "suppliers"] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/inventory/suppliers/${id}`);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["inventory", "suppliers"] }),
  });
}

export function useIngresoAttachments(documentId: number) {
  return useQuery({
    queryKey: ["inventory", "ingreso", documentId, "attachments"],
    queryFn: async () => {
      const res = await api.get<InventoryDocumentAttachment[]>(
        `/inventory/ingresos/${documentId}/attachments`,
      );
      return res.data;
    },
    enabled: !!documentId,
  });
}

export function useUploadIngresoAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      file,
    }: {
      documentId: number;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<InventoryDocumentAttachment>(
        `/inventory/ingresos/${documentId}/attachments`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["inventory", "ingreso", vars.documentId, "attachments"],
      });
      qc.invalidateQueries({
        queryKey: ["inventory", "document", "IN", vars.documentId],
      });
    },
  });
}

export function useCreateEgreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEgresoPayload) => {
      const res = await api.post<InventoryDocument>(
        "/inventory/egresos",
        payload,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "EG"] }),
  });
}

export function useCreateBaja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateBajaPayload) => {
      const res = await api.post<InventoryDocument>(
        "/inventory/bajas",
        payload,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "BI"] }),
  });
}

export function useCreateAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAjustePayload) => {
      const res = await api.post<InventoryDocument>(
        "/inventory/ajustes",
        payload,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "AI"] }),
  });
}

export function useCreateConteo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateInventoryCountPayload) => {
      const res = await api.post<InventoryCount>("/inventory/conteos", payload);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["inventory", "counts"] }),
  });
}

export function useUpdateConteo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateInventoryCountPayload;
    }) => {
      const res = await api.patch<InventoryCount>(
        `/inventory/conteos/${id}`,
        payload,
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["inventory", "counts"] });
      qc.invalidateQueries({ queryKey: ["inventory", "count", vars.id] });
    },
  });
}

export function useApplyConteo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload?: ApplyInventoryCountPayload;
    }) => {
      const res = await api.post<InventoryCount>(
        `/inventory/conteos/${id}/apply`,
        payload ?? {},
      );
      return res.data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["inventory", "counts"] });
      qc.invalidateQueries({ queryKey: ["inventory", "count", vars.id] });
      if (data.positive_adjustment_document_id) {
        qc.invalidateQueries({ queryKey: ["inventory", "IN"] });
      }
      if (data.negative_adjustment_document_id) {
        qc.invalidateQueries({ queryKey: ["inventory", "EG"] });
      }
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useGenerateAuthCode() {
  return useMutation({
    mutationFn: async ({
      id,
      docType,
    }: {
      id: number;
      docType: Extract<DocumentType, "BI" | "AI">;
    }) => {
      const res = await api.post<AuthCodeResponse>(
        `/inventory/${DOC_ENDPOINTS[docType]}/${id}/authorization-code`,
      );
      return res.data;
    },
  });
}

export function useApproveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      docType,
      payload,
    }: {
      id: number;
      docType: Extract<DocumentType, "BI" | "AI">;
      payload: ApprovePayload;
    }) => {
      const res = await api.post<InventoryDocument>(
        `/inventory/${DOC_ENDPOINTS[docType]}/${id}/approve`,
        payload,
      );
      return res.data;
    },
    onSuccess: (_data, { id, docType }) => {
      qc.invalidateQueries({
        queryKey: ["inventory", "document", docType, id],
      });
      qc.invalidateQueries({ queryKey: ["inventory", "document", id] });
      qc.invalidateQueries({ queryKey: ["inventory", "BI"] });
      qc.invalidateQueries({ queryKey: ["inventory", "AI"] });
    },
  });
}

export function useCancelDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      docType,
    }: {
      id: number;
      docType: Extract<DocumentType, "BI" | "AI">;
    }) => {
      const res = await api.post<InventoryDocument>(
        `/inventory/${DOC_ENDPOINTS[docType]}/${id}/cancel`,
      );
      return res.data;
    },
    onSuccess: (_data, { id, docType }) => {
      qc.invalidateQueries({
        queryKey: ["inventory", "document", docType, id],
      });
      qc.invalidateQueries({ queryKey: ["inventory", "document", id] });
      qc.invalidateQueries({ queryKey: ["inventory", "BI"] });
      qc.invalidateQueries({ queryKey: ["inventory", "AI"] });
      qc.invalidateQueries({ queryKey: ["inventory", "IN"] });
      qc.invalidateQueries({ queryKey: ["inventory", "EG"] });
    },
  });
}

export function useSetApprovalCode() {
  return useMutation({
    mutationFn: async (payload: SetApprovalCodePayload) => {
      const res = await api.post<{ message: string }>(
        "/auth/approval-code",
        payload,
      );
      return res.data;
    },
  });
}

export function useVoidDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      authorizerPin,
    }: {
      id: number;
      authorizerPin?: string;
    }) => {
      const res = await api.post<InventoryDocument>(
        `/inventory/documents/${id}/void`,
        { authorizer_pin: authorizerPin || null },
      );
      return res.data;
    },
    onSuccess: () => {
      // Reversal affects every list, the document, kardex and reports.
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["kardex"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
