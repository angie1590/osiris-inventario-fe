import type { SupplierIdentificationType } from "@/types/api";

export const ID_TYPE_LABEL: Record<SupplierIdentificationType, string> = {
  ruc: "RUC",
  cedula: "CÉDULA",
  passport: "PASAPORTE",
};

export function isValidEcuadorRuc(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (province < 1 || province > 24) return false;
  const third = Number(value[2]);

  if (third < 6) {
    const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let total = 0;
    for (let i = 0; i < coefs.length; i += 1) {
      let p = Number(value[i]) * coefs[i];
      if (p >= 10) p -= 9;
      total += p;
    }
    const check = (10 - (total % 10)) % 10;
    return check === Number(value[9]) && value.slice(10) !== "000";
  }

  if (third === 6) {
    const coefs = [3, 2, 7, 6, 5, 4, 3, 2];
    const total = coefs.reduce(
      (acc, coef, i) => acc + Number(value[i]) * coef,
      0,
    );
    let check = 11 - (total % 11);
    if (check === 11) check = 0;
    return (
      check !== 10 && check === Number(value[8]) && value.slice(9) !== "0000"
    );
  }

  if (third === 9) {
    const coefs = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const total = coefs.reduce(
      (acc, coef, i) => acc + Number(value[i]) * coef,
      0,
    );
    let check = 11 - (total % 11);
    if (check === 11) check = 0;
    return (
      check !== 10 && check === Number(value[9]) && value.slice(10) !== "000"
    );
  }

  return false;
}

export function isValidEcuadorCedula(value: string) {
  if (!/^\d{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (province < 1 || province > 24) return false;
  const third = Number(value[2]);
  if (third >= 6) return false;

  const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let total = 0;
  for (let i = 0; i < coefs.length; i += 1) {
    let p = Number(value[i]) * coefs[i];
    if (p >= 10) p -= 9;
    total += p;
  }
  const check = (10 - (total % 10)) % 10;
  return check === Number(value[9]);
}

/** Devuelve el mensaje de error o null si la identificación es válida. */
export function getIdentificationError(
  type: SupplierIdentificationType,
  value: string,
): string | null {
  if (type === "ruc") {
    if (!/^\d{13}$/.test(value)) return "RUC inválido (debe tener 13 dígitos)";
    return isValidEcuadorRuc(value) ? null : "RUC inválido";
  }
  if (type === "cedula") {
    if (!/^\d{10}$/.test(value)) return "Cédula inválida (debe tener 10 dígitos)";
    return isValidEcuadorCedula(value) ? null : "Cédula inválida";
  }
  return value.trim() ? null : "Pasaporte requerido";
}

export function identificationMaxLength(type: SupplierIdentificationType) {
  if (type === "passport") return 20;
  return type === "cedula" ? 10 : 13;
}

export function normalizeIdentificationInput(
  type: SupplierIdentificationType,
  value: string,
) {
  if (type === "passport") return value.toUpperCase().slice(0, 20);
  return value.replace(/\D/g, "").slice(0, identificationMaxLength(type));
}
