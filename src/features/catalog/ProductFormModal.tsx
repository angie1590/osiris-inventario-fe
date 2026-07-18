import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductForm } from "./ProductForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/features/catalog/hooks";
import type { Product } from "@/types/api";

interface ProductFormModalProps {
  product?: Product;
  onClose: () => void;
}

export function ProductFormModal({ product, onClose }: ProductFormModalProps) {
  const isEdit = !!product;
  const { data: freshProduct, isLoading } = useProduct(product?.id ?? 0);
  const resolvedProduct = isEdit ? (freshProduct ?? product) : undefined;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>
        {isEdit && isLoading && !freshProduct ? (
          <div className="space-y-3 p-1">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : (
          <ProductForm
            product={resolvedProduct}
            layout="modal"
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
