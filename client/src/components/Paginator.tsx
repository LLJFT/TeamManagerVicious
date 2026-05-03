import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE = 50;

export function totalPages(count: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  if (count <= 0) return 1;
  return Math.max(1, Math.ceil(count / pageSize));
}

export function paginate<T>(items: T[], page: number, pageSize: number = DEFAULT_PAGE_SIZE): T[] {
  const pages = totalPages(items.length, pageSize);
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

interface PaginatorProps {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (next: number) => void;
  testId?: string;
}

export function Paginator({
  page, pageSize = DEFAULT_PAGE_SIZE, total, onPageChange, testId,
}: PaginatorProps) {
  const pages = totalPages(total, pageSize);
  const safePage = Math.min(Math.max(1, page), pages);

  useEffect(() => {
    if (page !== safePage) onPageChange(safePage);
  }, [page, safePage, onPageChange]);

  if (total <= pageSize) return null;
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const prefix = testId ? `${testId}-` : "";
  return (
    <div
      className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border flex-wrap"
      data-testid={testId ? `paginator-${testId}` : "paginator"}
    >
      <span
        className="text-xs text-muted-foreground tabular-nums"
        data-testid={`${prefix}paginator-range`}
      >
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <span
          className="text-xs text-muted-foreground tabular-nums"
          data-testid={`${prefix}paginator-page`}
        >
          Page {safePage} / {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          data-testid={`${prefix}paginator-prev`}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={safePage >= pages}
          onClick={() => onPageChange(safePage + 1)}
          data-testid={`${prefix}paginator-next`}
        >
          Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
