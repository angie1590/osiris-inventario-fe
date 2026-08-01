import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";

export default function EgresoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | undefined;
    api
      .get<Blob>(`/inventory/egresos/${id}/print.pdf`, {
        responseType: "blob",
      })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        setPdfUrl(objectUrl);
      })
      .catch(() => setError(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (error) {
    return <p className="p-4 text-sm">No se pudo preparar la impresión.</p>;
  }

  if (!pdfUrl) {
    return <p className="p-4 text-sm">Preparando impresión...</p>;
  }

  return (
    <iframe
      ref={frameRef}
      src={pdfUrl}
      title="Nota de Venta"
      className="h-screen w-screen border-0"
      onLoad={() => frameRef.current?.contentWindow?.print()}
    />
  );
}
