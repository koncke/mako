"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/crm/_components/opportunities-table/columns.tsx.
// Una fila por negocio: ID (el número del negocio), Cliente, Grupo (la columna «Stage»), Última vez (en lugar de «Priority»),
// Estado (la tira de «Health»: con el porqué de «Para mirar» en su tooltip) y MRR («Value»). El lápiz abre la ficha.
// La casilla de selección de Studio no va: en Customers no hay nada que hacer con varios a la vez.

import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "cn";
import { Pencil } from "lucide-react";

import Link from "@/app/_ui/Link";
import { Badge } from "@/app/admin/_studio/components/ui/badge";
import { Button } from "@/app/admin/_studio/components/ui/button";
import type { DataTableFeatures } from "@/app/admin/_studio/lib/data-table-features";

import { destinoCliente, type FilaTabla, type Grupo, pasaGrupo, PUNTAJE_ESTADO, usdTxt } from "../../customers-vista";

const healthStripSlots = Array.from({ length: 18 }, (_, index) => ({
  id: `strip-${index + 1}`,
  threshold: index + 1,
}));

export const opportunitiesColumns: ColumnDef<DataTableFeatures, FilaTabla>[] = [
  {
    accessorKey: "ws",
    header: "ID",
    cell: ({ row }) => <div className="text-sm tracking-tight tabular-nums">{row.original.ws}</div>,
    enableHiding: false,
  },
  {
    accessorKey: "nombre",
    header: "Cliente",
    cell: ({ row }) => <div className="text-sm font-medium">{row.original.nombre}</div>,
  },
  {
    accessorKey: "grupo",
    header: "Grupo",
    cell: ({ row }) => (
      <Badge variant="outline" className="rounded-full px-2.5">
        {row.original.grupo}
      </Badge>
    ),
    filterFn: (row, _id, value) => pasaGrupo(row.original.segmentos, value as Grupo),
  },
  {
    accessorKey: "ultimaVez",
    header: "Última vez",
    cell: ({ row }) => <div className="text-sm">{row.original.ultimaVez}</div>,
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ row }) => (
      <div className="flex items-end gap-0.5" title={row.original.detalleEstado}>
        <span className="sr-only">{row.original.detalleEstado}</span>
        {healthStripSlots.map((slot) => (
          <div
            key={`${row.original.ws}-${slot.id}`}
            className={cn(
              "h-5 w-1 rounded-full",
              slot.threshold <= PUNTAJE_ESTADO[row.original.estado] ? "bg-green-500/85" : "bg-green-500/15",
            )}
          />
        ))}
      </div>
    ),
    filterFn: "equalsString",
  },
  {
    accessorKey: "mrr",
    header: "MRR",
    cell: ({ row }) => <div className="text-sm font-medium tabular-nums">{row.original.mrr > 0 ? usdTxt(row.original.mrr) : "—"}</div>,
  },
  {
    id: "actions",
    header: () => <div className="text-right">Ficha</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-8 rounded-full hover:bg-transparent focus-visible:bg-transparent"
        >
          <Link href={destinoCliente("ficha", row.original.ws)}>
            <Pencil />
            <span className="sr-only">Abrir la ficha de {row.original.nombre}</span>
          </Link>
        </Button>
      </div>
    ),
    enableHiding: false,
  },
];
