import type {
  EgresoType,
  IngresoType,
  BajaReason,
  AdjustmentReason,
  PurchaseDocumentType,
} from "@/types/api";

export const INGRESO_DOCUMENT_TYPES: Record<
  IngresoType,
  PurchaseDocumentType[]
> = {
  purchase: [
    "invoice",
    "sales_note",
    "liquidation_purchase",
    "receipt",
    "other",
  ],
  initial_inventory: ["inventory_act", "none"],
  adjustment_positive: ["adjustment_act", "none"],
  customer_return: ["invoice", "credit_note", "other"],
  production: ["production_act", "none"],
  transfer_received: ["transfer_note", "none"],
  other: ["other", "none"],
};

export const EGRESO_DOCUMENT_TYPES: Record<EgresoType, PurchaseDocumentType[]> =
  {
    sale: ["invoice", "sales_note", "none"],
    baja: ["disposal_act", "none"],
    adjustment_negative: ["adjustment_act", "none"],
    supplier_return: ["supplier_return", "invoice", "transfer_note"],
    internal_consumption: ["internal_consumption_act", "none"],
    transfer_sent: ["transfer_note", "transfer_act"],
    other: ["other", "none"],
  };

export const BAJA_REASON_LABELS: Record<BajaReason, string> = {
  damage: "Daño",
  expiration: "Caducidad",
  loss: "Pérdida",
  theft: "Robo",
  donation: "Donación",
  gift: "Obsequio",
  destruction: "Destrucción",
  sample: "Muestra",
  other: "Otro",
};

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  physical_count: "Conteo físico",
  record_error: "Error de registro",
  administrative_correction: "Corrección administrativa",
  other: "Otro",
};

const INVENTORY_EGRESO_TYPES: EgresoType[] = [
  "baja",
  "adjustment_negative",
  "supplier_return",
  "internal_consumption",
  "transfer_sent",
  "other",
];

export const PURCHASE_DOCUMENT_TYPE_LABELS: Record<
  PurchaseDocumentType,
  string
> = {
  invoice: "Factura",
  sales_note: "Nota de venta",
  liquidation_purchase: "Liquidación de compra",
  receipt: "Recibo",
  other: "Otro",
  inventory_act: "Acta de inventario",
  adjustment_act: "Acta de ajuste",
  credit_note: "Nota de crédito",
  production_act: "Acta de producción",
  transfer_note: "Guía de remisión",
  delivery_note: "Nota de entrega",
  disposal_act: "Acta de baja",
  donation_act: "Acta de donación",
  internal_consumption_act: "Acta de consumo interno",
  supplier_return: "Devolución al proveedor",
  transfer_act: "Acta de transferencia",
  none: "Sin documento",
};

export function isEgresoNotesRequired(
  documentType: PurchaseDocumentType,
): boolean {
  return documentType === "other";
}

export function isEgresoDocumentDateRequired(
  documentType: PurchaseDocumentType,
): boolean {
  return documentType !== "none" && documentType !== "other";
}

export function isBajaReasonRequired(egresoType: EgresoType): boolean {
  return egresoType === "baja";
}

export function isAdjustmentReasonRequired(egresoType: EgresoType): boolean {
  return egresoType === "adjustment_negative";
}

export function isCommercialEgresoType(egresoType: EgresoType): boolean {
  return egresoType === "sale";
}

export function isInventoryEgresoType(egresoType: EgresoType): boolean {
  return INVENTORY_EGRESO_TYPES.includes(egresoType);
}

export function getDefaultBajaReason(): BajaReason {
  return "damage";
}

export function getDefaultAdjustmentReason(): AdjustmentReason {
  return "physical_count";
}

export function getDefaultEgresoDocumentType(
  egresoType: EgresoType,
): PurchaseDocumentType {
  if (egresoType === "sale") return "sales_note";
  return EGRESO_DOCUMENT_TYPES[egresoType][0];
}
