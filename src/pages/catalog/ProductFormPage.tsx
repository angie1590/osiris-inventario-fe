import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProductForm } from "@/features/catalog/ProductForm";
import { useProduct } from "@/features/catalog/hooks";

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: product, isLoading: productLoading } = useProduct(
    id ? Number(id) : 0,
  );

  if (isEdit && productLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={isEdit ? "Editar producto" : "Nuevo producto"}
        actions={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />
      <ProductForm
        product={isEdit ? product : undefined}
        layout="page"
        onSuccess={(saved) => navigate(`/products/${saved.id}`)}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
