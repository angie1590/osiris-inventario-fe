const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".heic"] as const;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
]);

export const PRODUCT_PHOTO_ACCEPT = [
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
].join(",");

export function isAllowedProductPhotoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedProductPhotoFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    ALLOWED_MIME_TYPES.has(file.type.toLowerCase()) ||
    ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
  );
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}
