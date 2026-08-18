import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}

function visiblePages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const values = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  return values.flatMap<number | "ellipsis">((page, index) =>
    index > 0 && page - values[index - 1] > 1 ? ["ellipsis", page] : [page],
  );
}

export function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  itemLabel,
  className = "border-t px-3 py-2",
}: TablePaginationProps) {
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState(String(page));
  const pageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPage) pageInputRef.current?.select();
  }, [editingPage]);

  useEffect(() => {
    if (!editingPage) setPageInput(String(page));
  }, [editingPage, page]);

  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const submitPage = () => {
    const target = Number(pageInput);
    if (Number.isInteger(target) && target >= 1 && target <= totalPages)
      onPageChange(target);
    setEditingPage(false);
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-sm ${className}`}
    >
      <span className="text-muted-foreground">
        Mostrando {start} a {end} de {total}
        {itemLabel ? ` ${itemLabel}` : ""}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        {editingPage ? (
          <Input
            ref={pageInputRef}
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            className="h-9 w-16 px-2 text-center"
            aria-label={`Ir a página, entre 1 y ${totalPages}`}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={submitPage}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitPage();
              if (event.key === "Escape") setEditingPage(false);
            }}
          />
        ) : (
          visiblePages(page, totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1 text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                variant={item === page ? "default" : "outline"}
                size="sm"
                className="min-w-9 px-2"
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
                onDoubleClick={() => item === page && setEditingPage(true)}
              >
                {item}
              </Button>
            ),
          )
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
