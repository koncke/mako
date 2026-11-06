// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/orbit/src/components/datatable/features.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import {
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'
import type {
  Cell,
  CellContext,
  Column,
  ColumnDef,
  ReactTable,
  Row,
  RowData,
} from '@tanstack/react-table'

export const dataTableFeatures = tableFeatures({
  columnSizingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  rowPaginationFeature,
  rowSortingFeature,
})

export type DataTableFeatures = typeof dataTableFeatures

export type DataTableCell<TData extends RowData, TValue = unknown> = Cell<
  DataTableFeatures,
  TData,
  TValue
>

export type DataTableCellContext<
  TData extends RowData,
  TValue = unknown,
> = CellContext<DataTableFeatures, TData, TValue>

export type DataTableColumn<TData extends RowData, TValue = unknown> = Column<
  DataTableFeatures,
  TData,
  TValue
>

/**
 * MaKo (6/11/2026): lo que una columna le pide a la tabla, en `meta` (Polar no lo tiene: sus tablas viven en pantallas anchas y,
 * si no entran, se corren de costado). Con un panel de ~240 px en el teléfono, la tabla de Polar escondía detrás del scroll
 * justo la columna que importa (lo pagado, el estado, el costo). Las dos cosas son opcionales: una columna sin `meta` se
 * dibuja como en Polar (su `size` en píxeles).
 */
export interface DataTableColumnMeta {
  /** Clases del encabezado y de cada celda de la columna, p. ej. `hidden @md:table-cell` para esconder la secundaria en una
   *  caja angosta (la tabla es un `@container` si se le pasa `className="@container"`). */
  className?: string
  /** El ancho como CSS (`'40%'`) en vez del `size` en píxeles: con `table-fixed`, en porcentajes la tabla nunca es más ancha
   *  que su caja, y si una columna se esconde, las demás se reparten su lugar. */
  width?: string
}

export type DataTableColumnDef<
  TData extends RowData,
  TValue = unknown,
> = ColumnDef<DataTableFeatures, TData, TValue> & { meta?: DataTableColumnMeta }

/** El `meta` de MaKo de una columna (vacío si no tiene). */
export const metaDeColumna = (columnDef: { meta?: unknown }): DataTableColumnMeta =>
  (columnDef.meta ?? {}) as DataTableColumnMeta

export type DataTableInstance<TData extends RowData> = ReactTable<
  DataTableFeatures,
  TData
>

export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>
