// Enums matching backend
export type UserRole = "admin" | "operator" | "supervisor";
export type ProductStatus = "active" | "inactive";
export type AttributeDataType =
  | "text"
  | "integer"
  | "decimal"
  | "date"
  | "boolean"
  | "select"
  | "catalog";

export interface Catalog {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  value_count: number;
  created_at: string;
  updated_at: string;
}

export interface CatalogValue {
  id: number;
  catalog_id: number;
  value: string;
  is_active: boolean;
}
export type DocumentType = "IN" | "EG" | "BI" | "AI";
export type DocumentStatus = "pending" | "approved" | "cancelled" | "voided";
export type AdjustType = "increment" | "decrement";
export type KardexEntryType = "IN" | "OUT" | "ADJUST";
export type SupplierIdentificationType = "ruc" | "cedula" | "passport";
export const PURCHASE_DOCUMENT_TYPES = [
  "invoice",
  "sales_note",
  "liquidation_purchase",
  "receipt",
  "other",
  "inventory_act",
  "adjustment_act",
  "credit_note",
  "production_act",
  "transfer_note",
  "delivery_note",
  "disposal_act",
  "donation_act",
  "internal_consumption_act",
  "supplier_return",
  "transfer_act",
  "none",
] as const;
export type PurchaseDocumentType = (typeof PURCHASE_DOCUMENT_TYPES)[number];
export type IngresoType =
  | "purchase"
  | "initial_inventory"
  | "adjustment_positive"
  | "customer_return"
  | "production"
  | "transfer_received"
  | "other";
export type EgresoType =
  | "sale"
  | "baja"
  | "adjustment_negative"
  | "supplier_return"
  | "internal_consumption"
  | "transfer_sent"
  | "other";
export type BajaReason =
  | "damage"
  | "expiration"
  | "loss"
  | "theft"
  | "donation"
  | "gift"
  | "destruction"
  | "sample"
  | "other";
export type AdjustmentReason =
  | "physical_count"
  | "record_error"
  | "administrative_correction"
  | "other";
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "CANCEL"
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_EXPIRED"
  | "PASSWORD_CHANGED";

// Auth
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  require_password_change: boolean;
  session_timeout_minutes: number;
}

export interface CurrentUser {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  require_password_change: boolean;
  has_approval_code?: boolean;
  created_at: string;
}

// Users
export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  require_password_change: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  username: string;
  full_name: string;
  password: string;
  role: UserRole;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  require_password_change?: boolean;
}

// Categories
export interface CategoryAttribute {
  id: number;
  category_id: number;
  name: string;
  data_type: AttributeDataType;
  is_required: boolean;
  is_active: boolean;
  select_options: string[] | null;
  catalog_id?: number | null;
  allow_negative?: boolean;
  inherited?: boolean;
  created_at: string;
}

export interface UpdateAttributePayload {
  name?: string;
  data_type?: AttributeDataType;
  is_required?: boolean;
  select_options?: string[];
  catalog_id?: number | null;
  allow_negative?: boolean;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
  attributes?: CategoryAttribute[];
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  parent_id?: number | null;
}

export interface CreateAttributePayload {
  name: string;
  data_type: AttributeDataType;
  is_required?: boolean;
  select_options?: string[];
  catalog_id?: number | null;
  allow_negative?: boolean;
}

// Products
export interface ProductImage {
  url: string;
  is_cover: boolean;
}

export interface Product {
  id: number;
  isbn: string;
  codigo_interno: string | null;
  name: string;
  description: string | null;
  photo: string | null;
  photos: ProductImage[] | null;
  category_id: number;
  stock_minimo: number;
  stock_actual: number;
  pvp: number;
  status: ProductStatus;
  custom_attributes: Record<string, unknown>;
  bajo_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  isbn?: string;
  codigo_interno?: string | null;
  name: string;
  description?: string;
  photo?: string | null;
  photos?: ProductImage[];
  category_id: number;
  stock_minimo?: number;
  pvp: string | number;
  custom_attributes?: Record<string, unknown>;
}

export interface UpdateProductPayload {
  isbn?: string;
  codigo_interno?: string | null;
  name?: string;
  description?: string;
  photo?: string | null;
  photos?: ProductImage[];
  category_id?: number;
  stock_minimo?: number;
  pvp?: string | number;
  custom_attributes?: Record<string, unknown>;
}

// Inventory documents
export interface InventoryDocumentLine {
  id: number;
  document_id: number;
  product_id: number;
  product_name?: string | null;
  product_isbn?: string | null;
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  unit_price_base?: number | null;
  discount_type?: "percent" | "fixed" | null;
  discount_value?: number | null;
  created_at: string;
}

export interface InventorySupplier {
  id: number;
  identification_type: SupplierIdentificationType;
  identification_number: string;
  trade_name: string;
  legal_name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface CreateSupplierPayload {
  identification_type: SupplierIdentificationType;
  identification_number: string;
  trade_name: string;
  legal_name: string;
  address?: string | null;
  phone?: string | null;
}

export interface UpdateSupplierPayload {
  identification_type?: SupplierIdentificationType;
  identification_number?: string;
  trade_name?: string;
  legal_name?: string;
  address?: string | null;
  phone?: string | null;
  is_active?: boolean;
}

export interface InventoryDocumentAttachment {
  id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface InventoryDocument {
  id: number;
  number: string;
  doc_type: DocumentType;
  status: DocumentStatus;
  adjust_type: AdjustType | null;
  ingreso_type?: IngresoType | null;
  egreso_type?: EgresoType | null;
  baja_reason?: BajaReason | null;
  adjustment_reason?: AdjustmentReason | null;
  supplier_id?: number | null;
  purchase_document_type?: PurchaseDocumentType | null;
  purchase_document_number?: string | null;
  purchase_document_date?: string | null;
  reference: string | null;
  notes: string | null;
  created_by: number;
  authorized_by: number | null;
  requested_at: string | null;
  authorized_at: string | null;
  created_at: string;
  supplier?: InventorySupplier | null;
  attachments?: InventoryDocumentAttachment[];
  lines: InventoryDocumentLine[];
}

export interface CreateIngresoPayload {
  ingreso_type?: IngresoType;
  supplier_id?: number;
  purchase_document_type?: PurchaseDocumentType;
  purchase_document_number?: string;
  purchase_document_date?: string;
  reference?: string;
  notes?: string;
  lines: Array<{
    product_id: number;
    quantity: string | number;
    unit_cost?: string | number;
  }>;
}

export interface CreateEgresoPayload {
  egreso_type?: EgresoType;
  purchase_document_type?: PurchaseDocumentType;
  purchase_document_number?: string;
  purchase_document_date?: string;
  baja_reason?: BajaReason;
  adjustment_reason?: AdjustmentReason;
  reference?: string;
  notes?: string;
  lines: Array<{
    product_id: number;
    quantity: string | number;
    unit_cost?: string | number;
    unit_price?: string | number;
    unit_price_base?: string | number;
    discount_type?: "percent" | "fixed";
    discount_value?: string | number;
  }>;
}

export interface CreateBajaPayload {
  reference: string;
  notes?: string;
  lines: Array<{ product_id: number; quantity: string | number }>;
}

export interface CreateAjustePayload {
  adjust_type: AdjustType;
  notes?: string;
  lines: Array<{ product_id: number; quantity: string | number }>;
}

export interface AuthCodeResponse {
  authorization_code: string;
}

export interface ApprovePayload {
  authorization_code: string;
}

export interface SetApprovalCodePayload {
  approval_code: string;
}

// Kardex
export interface KardexEntry {
  id: number;
  product_id: number;
  document_id: number | null;
  entry_type: KardexEntryType;
  quantity_in: number;
  cost_in: number;
  quantity_out: number;
  cost_out: number;
  balance_quantity: number;
  balance_value: number;
  weighted_avg_cost: number;
  lot_id: number | null;
  document_number?: string | null;
  document_doc_type?: DocumentType | null;
  created_at: string;
}

export interface KardexResponse {
  product_id: number;
  method: string;
  opening_balance_quantity: number;
  opening_balance_value: number;
  closing_balance_quantity: number;
  closing_balance_value: number;
  weighted_avg_cost: number;
  entries: KardexEntry[];
}

// Audit
export interface AuditLog {
  id: number;
  timestamp: string;
  user_id: number | null;
  username: string | null;
  ip_address: string | null;
  action: AuditAction;
  entity_type: string | null;
  entity_id: string | null;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  description: string | null;
}

// System params
export interface SystemParam {
  id: number;
  key: string;
  value: string;
  description: string | null;
  updated_by: number | null;
  updated_at: string;
}

// Reports
export interface ConsolidadoReport {
  period: { from: string; to: string };
  movements: Record<string, number>;
  movements_by_type: {
    ingresos: Record<string, number>;
    egresos: Record<string, number>;
  };
  movements_amount: {
    IN: number;
    EG: number;
  };
  movements_amount_by_type: {
    ingresos: Record<string, number>;
    egresos: Record<string, number>;
  };
  status_summary: Record<string, number>;
  total_movements: number;
  total_movements_amount: number;
  active_products: number;
  products_below_minimum: number;
}

export interface StockValorizadoItem {
  id: number;
  name: string;
  stock: number;
  cost: number;
  value: number;
  category_id: number;
}

export interface StockValorizadoReport {
  method: string;
  items: StockValorizadoItem[];
  total_value: number;
}

// Company config
export interface CompanyConfig {
  id: number;
  razon_social: string;
  nombre_comercial: string | null;
  ruc: string;
  direccion: string | null;
  telefono: string | null;
  email: string;
  logo: string | null;
  enabled_ingreso_types: IngresoType[];
  enabled_egreso_types: EgresoType[];
  enabled_baja_reasons: BajaReason[];
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
}

export interface CreateCompanyPayload {
  razon_social: string;
  ruc: string;
  email: string;
  nombre_comercial?: string;
  direccion?: string;
  telefono?: string;
  logo?: string;
  enabled_ingreso_types?: IngresoType[];
  enabled_egreso_types?: EgresoType[];
  enabled_baja_reasons?: BajaReason[];
}

export interface UpdateCompanyPayload {
  razon_social?: string;
  ruc?: string;
  email?: string;
  nombre_comercial?: string;
  direccion?: string;
  telefono?: string;
  logo?: string;
  enabled_ingreso_types?: IngresoType[];
  enabled_egreso_types?: EgresoType[];
  enabled_baja_reasons?: BajaReason[];
}

// Pagination helpers
export interface PaginatedParams {
  limit?: number;
  cursor?: number;
}
