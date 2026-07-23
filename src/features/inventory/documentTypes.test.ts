import { describe, expect, it } from "vitest";
import {
  EGRESO_DOCUMENT_TYPES,
  getDefaultEgresoDocumentType,
  isEgresoDocumentDateRequired,
  isEgresoNotesRequired,
} from "@/features/inventory/documentTypes";

describe("egreso document mapping", () => {
  it("keeps expected documents by egreso type", () => {
    expect(EGRESO_DOCUMENT_TYPES.sale).toEqual([
      "invoice",
      "sales_note",
      "none",
    ]);
    expect(EGRESO_DOCUMENT_TYPES.baja).toEqual(["disposal_act", "none"]);
    expect(EGRESO_DOCUMENT_TYPES.adjustment_negative).toEqual([
      "adjustment_act",
      "none",
    ]);
    expect(EGRESO_DOCUMENT_TYPES.transfer_sent).toEqual([
      "transfer_note",
      "transfer_act",
    ]);
    expect(EGRESO_DOCUMENT_TYPES.other).toEqual(["other", "none"]);
  });

  it("requires notes only for document type other", () => {
    expect(isEgresoNotesRequired("other")).toBe(true);
    expect(isEgresoNotesRequired("none")).toBe(false);
    expect(isEgresoNotesRequired("invoice")).toBe(false);
  });

  it("requires document date for docs except none/other", () => {
    expect(isEgresoDocumentDateRequired("invoice")).toBe(true);
    expect(isEgresoDocumentDateRequired("transfer_note")).toBe(true);
    expect(isEgresoDocumentDateRequired("none")).toBe(false);
    expect(isEgresoDocumentDateRequired("other")).toBe(false);
  });

  it("defaults sale egreso to sales_note", () => {
    expect(getDefaultEgresoDocumentType("sale")).toBe("sales_note");
    expect(getDefaultEgresoDocumentType("other")).toBe("other");
  });
});
