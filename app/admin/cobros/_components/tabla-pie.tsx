// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: el pie de
// src/app/(main)/dashboard/default/_components/recent-customers-table/table.tsx (las elegidas, filas por página y las páginas),
// sacado a un archivo porque lo usan las dos tablas de Billing.
"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/app/admin/_studio/components/ui/button";
import { Label } from "@/app/admin/_studio/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";

type TablaConPaginas = {
  state: { pagination: { pageIndex: number; pageSize: number } };
  getFilteredSelectedRowModel: () => { rows: unknown[] };
  getFilteredRowModel: () => { rows: unknown[] };
  setPageSize: (n: number) => void;
  setPageIndex: (n: number) => void;
  getPageCount: () => number;
  getCanPreviousPage: () => boolean;
  getCanNextPage: () => boolean;
  previousPage: () => void;
  nextPage: () => void;
};

export function TablaPie({ table, id, elegidos }: { table: TablaConPaginas; id: string; elegidos: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
        {table.getFilteredSelectedRowModel().rows.length} de {table.getFilteredRowModel().rows.length} {elegidos}.
      </div>
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor={id} className="text-sm font-medium">
            Filas por página
          </Label>
          <Select value={`${table.state.pagination.pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}>
            <SelectTrigger size="sm" className="w-20" id={id}>
              <SelectValue placeholder={table.state.pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          Página {table.state.pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button variant="outline" className="hidden size-8 lg:flex" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
            <span className="sr-only">A la primera página</span>
            <ChevronsLeft className="size-4" />
          </Button>
          <Button variant="outline" className="size-8" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <span className="sr-only">A la página anterior</span>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" className="size-8" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <span className="sr-only">A la página siguiente</span>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 lg:flex"
            size="icon"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">A la última página</span>
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
