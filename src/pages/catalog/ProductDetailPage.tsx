import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  useProduct,
  useToggleProductStatus,
  useCategories,
} from "@/features/catalog/hooks";
import { buildCategoryPath } from "@/features/catalog/categoryPath";
import { ReactivateProductDialog } from "@/features/catalog/ReactivateProductDialog";
import { useStockMode, formatQuantity } from "@/hooks/useStockMode";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function ProductDetailPage() {
  const GALLERY_TARGET_WIDTH = 800;
  const GALLERY_TARGET_HEIGHT = 450;

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === "admin" || user?.role === "operator";
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [reactivate, setReactivate] = useState(false);
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  const { data: product, isLoading } = useProduct(Number(id));
  const { data: categories } = useCategories();
  const { integerMode } = useStockMode();
  const toggleStatus = useToggleProductStatus();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!product) return <p>Producto no encontrado</p>;

  const gallery = (product.photos ?? []).filter((img) => !!img?.url);
  const images =
    gallery.length > 0
      ? gallery
      : product.photo
        ? [{ url: product.photo, is_cover: true }]
        : [];
  const coverIndex = Math.max(
    0,
    images.findIndex((img) => img.is_cover),
  );
  const cover = images[coverIndex]?.url;
  const activeImageUrl = images[photoIndex]?.url;
  const activeImageDimensions = activeImageUrl
    ? imageDimensions[activeImageUrl]
    : undefined;
  const lowResForGallery =
    !!activeImageDimensions &&
    (activeImageDimensions.width < GALLERY_TARGET_WIDTH ||
      activeImageDimensions.height < GALLERY_TARGET_HEIGHT);

  useEffect(() => {
    if (!photoZoomOpen || images.length <= 1) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPhotoIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPhotoIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photoZoomOpen, images.length]);

  useEffect(() => {
    if (!photoZoomOpen || images.length === 0) return;
    let disposed = false;
    images.forEach((item) => {
      if (imageDimensions[item.url]) return;
      const img = new Image();
      img.onload = () => {
        if (disposed) return;
        setImageDimensions((prev) => ({
          ...prev,
          [item.url]: {
            width: img.naturalWidth,
            height: img.naturalHeight,
          },
        }));
      };
      img.src = item.url;
    });
    return () => {
      disposed = true;
    };
  }, [photoZoomOpen, images, imageDimensions]);

  const handleToggle = async () => {
    const newStatus = product.status === "active" ? "inactive" : "active";
    try {
      await toggleStatus.mutateAsync({ id: product.id, status: newStatus });
      toast({
        variant: "success",
        title:
          newStatus === "active" ? "Producto activado" : "Producto desactivado",
        description: `"${product.name}" ${newStatus === "active" ? "activado" : "desactivado"} correctamente.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error al cambiar estado",
        description: `No se pudo actualizar "${product.name}". Intenta nuevamente.`,
      });
      throw new Error("toggle failed");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={product.name}
        actions={
          <div className="flex items-center gap-2">
            <Badge
              variant={product.status === "active" ? "default" : "secondary"}
            >
              {product.status === "active" ? "Activo" : "Inactivo"}
            </Badge>
            {product.bajo_stock && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Bajo Stock
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {cover && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Foto</CardTitle>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                className="w-full rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => {
                  setPhotoIndex(coverIndex);
                  setPhotoZoomOpen(true);
                }}
              >
                <img
                  src={cover}
                  alt={product.name}
                  className="max-h-72 w-full cursor-zoom-in rounded-md border object-contain"
                />
              </button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Información general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Código de barras</span>
              <span className="text-right font-medium">{product.isbn}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Categoría</span>
              <span className="text-right font-medium">
                {buildCategoryPath(categories ?? [], product.category_id)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Descripción</span>
              <span className="text-right font-medium">
                {product.description || "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">PVP</span>
              <span className="text-right font-medium">
                ${Number(product.pvp).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Stock actual</span>
              <span
                className={
                  product.bajo_stock
                    ? "text-destructive font-bold text-right"
                    : "font-bold text-right"
                }
              >
                {formatQuantity(product.stock_actual, integerMode)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Stock mínimo</span>
              <span className="text-right font-medium">
                {formatQuantity(product.stock_minimo, integerMode)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {Object.keys(product.custom_attributes ?? {}).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Atributos personalizados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {Object.entries(product.custom_attributes).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between rounded bg-muted/50 px-3 py-1"
                >
                  <span className="text-muted-foreground">{k}</span>
                  <span>
                    {typeof v === "boolean" ? (v ? "Sí" : "No") : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {canEdit && (
          <Button onClick={() => navigate(`/products/${product.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => {
              const categoryAlive = (categories ?? []).some(
                (c) => c.id === product.category_id,
              );
              if (product.status === "inactive" && !categoryAlive)
                setReactivate(true);
              else setConfirmToggle(true);
            }}
          >
            {product.status === "active" ? "Desactivar" : "Activar"}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to={`/kardex/${product.id}`}>
            <BookOpen className="mr-2 h-4 w-4" />
            Ver Kardex
          </Link>
        </Button>
      </div>

      {confirmToggle && (
        <ConfirmDialog
          open
          onClose={() => setConfirmToggle(false)}
          title={
            product.status === "active"
              ? "Desactivar producto"
              : "Activar producto"
          }
          description={
            <>
              ¿{product.status === "active" ? "Desactivar" : "Activar"} el
              producto <strong>{product.name}</strong>?
            </>
          }
          confirmLabel={product.status === "active" ? "Desactivar" : "Activar"}
          variant={product.status === "active" ? "danger" : "default"}
          onConfirm={handleToggle}
        />
      )}

      {reactivate && (
        <ReactivateProductDialog
          product={product}
          onClose={() => setReactivate(false)}
        />
      )}

      {images.length > 0 && (
        <Dialog open={photoZoomOpen} onOpenChange={setPhotoZoomOpen}>
          <DialogContent className="w-[min(96vw,1240px)] max-w-none p-3 sm:p-4">
            <div className="flex gap-4">
              <div className="w-28 shrink-0 overflow-y-auto pr-1 max-h-[75vh]">
                <div className="flex flex-col gap-2">
                  {images.map((img, idx) => (
                    <button
                      key={`${img.url}-${idx}`}
                      type="button"
                      onClick={() => setPhotoIndex(idx)}
                      className={`overflow-hidden rounded-md border transition ${
                        idx === photoIndex
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={`Miniatura ${idx + 1}`}
                        className="h-16 w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex h-[620px] flex-1 items-center justify-center rounded-md bg-muted/20 p-4">
                {images.length > 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 h-9 w-9 rounded-full"
                    onClick={() =>
                      setPhotoIndex((prev) =>
                        prev === 0 ? images.length - 1 : prev - 1,
                      )
                    }
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}

                <img
                  src={images[photoIndex]?.url}
                  alt={`${product.name} - imagen ${photoIndex + 1}`}
                  className="h-full w-full rounded-md object-contain"
                />

                {images.length > 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 h-9 w-9 rounded-full"
                    onClick={() =>
                      setPhotoIndex((prev) =>
                        prev === images.length - 1 ? 0 : prev + 1,
                      )
                    }
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}

                {lowResForGallery && (
                  <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800 shadow-sm">
                    Esta imagen tiene menor resolución que el visor (
                    {GALLERY_TARGET_WIDTH}x{GALLERY_TARGET_HEIGHT}) y puede
                    pixelarse al ampliarse.
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="absolute bottom-4 right-6 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                  {photoIndex + 1} / {images.length}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
