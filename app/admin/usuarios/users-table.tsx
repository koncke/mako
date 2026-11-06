"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.

// Admin › Users — la tabla y su pie (Studio Admin, MIT, src/app/(main)/dashboard/users/_components/users-table.tsx),
// copiada tal cual. MaKo: los textos en español, y la vista de grilla (el selector lista / grilla que en Studio no cambia
// nada) dibuja las MISMAS filas, filtradas y paginadas, como tarjetas (./users-grid.tsx): el pie es el mismo para las dos.
import type { MouseEvent } from "react";

import type { ReactTable } from "@tanstack/react-table";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/app/admin/_studio/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import { Separator } from "@/app/admin/_studio/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/admin/_studio/components/ui/table";
import type { DataTableFeatures } from "@/app/admin/_studio/lib/data-table-features";

import type { UserRow } from "./data";
import type { ContextoColumnas } from "./users-columns";
import { UsersGrid } from "./users-grid";

function preventPaginationNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

function getPageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 3) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 2) return [1, 2, 3];
  if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount];

  return [currentPage - 1, currentPage, currentPage + 1];
}

export function UsersTable({ table, vista, ctx }: { table: ReactTable<DataTableFeatures, UserRow>; vista: "list" | "grid"; ctx: ContextoColumnas }) {
  const pageCount = Math.max(table.getPageCount(), 1);
  const currentPage = Math.min(table.state.pagination.pageIndex + 1, pageCount);
  const pageNumbers = getPageNumbers(currentPage, pageCount);
  const rowsPerPage = `${table.state.pagination.pageSize}`;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {vista === "grid" ? <UsersGrid table={table} ctx={ctx} /> : <div>
        <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
          <TableHeader className="[&_tr]:border-t">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-4 font-normal">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border/60 hover:bg-white/2.5"
                  data-state={table.state.rowSelection[row.id] && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-4 align-middle">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  Nadie con esos filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>}

      <Separator />

      <div className="flex items-center justify-between px-4">
        <div className="text-muted-foreground flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span>Filas por página</span>
            <Select
              value={`${table.state.pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-20" id="users-rows-per-page">
                <SelectValue placeholder={rowsPerPage} />
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
          <span>
            Página {currentPage} de {pageCount}
          </span>
        </div>

        <Pagination className="mx-0 w-auto justify-start md:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text=""
                className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  preventPaginationNavigation(event);
                  table.previousPage();
                }}
              />
            </PaginationItem>
            {pageNumbers[0] > 1 ? (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            ) : null}
            {pageNumbers.map((pageNumber) => (
              <PaginationItem key={`page-${pageNumber}`}>
                <PaginationLink
                  href="#"
                  isActive={table.state.pagination.pageIndex === pageNumber - 1}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    table.setPageIndex(pageNumber - 1);
                  }}
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            ))}
            {pageNumbers[pageNumbers.length - 1] < pageCount ? (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            ) : null}
            <PaginationItem>
              <PaginationNext
                href="#"
                text=""
                className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  preventPaginationNavigation(event);
                  table.nextPage();
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
