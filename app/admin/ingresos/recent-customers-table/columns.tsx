"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// Admin › Revenue — las columnas de la tabla de clientes (Studio Admin, MIT,
// src/app/(main)/dashboard/default/_components/recent-customers-table/columns.tsx). Copiadas: la casilla, el cliente con su
// cajita y su referencia abajo, Status y Billing como insignias con su ícono, Plan y Joined con su segunda línea.
// Lo de MaKo: Estado es la suscripción, Cobro si está al día, Plan lo que paga por mes (y abajo lo que pagó en total: lo
// que Martín pidió ver por cliente) y Alta su primer pago (y abajo el último). El nombre lleva a su ficha.
import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CircleAlertIcon, CircleCheckIcon, Clock3Icon, LoaderIcon, UserRound } from "lucide-react";

import Link from "@/app/_ui/Link";
import { Badge } from "@/app/admin/_studio/components/ui/badge";
import { Checkbox } from "@/app/admin/_studio/components/ui/checkbox";
import type { DataTableFeatures } from "@/app/admin/_studio/lib/data-table-features";
import { diaTxt } from "@/lib/admin-ingresos-reglas";

import type { EstadoCobro, FilaCliente } from "../revenue-vista";

function billingIcon(billing: EstadoCobro) {
  switch (billing) {
    case "Al día":
    case "Pagado":
      return <CircleCheckIcon className="stroke-primary-foreground fill-green-500 dark:fill-green-600" />;
    case "Por vencer":
      return <LoaderIcon />;
    case "Atrasado":
      return <CircleAlertIcon className="text-amber-600 dark:text-amber-500" />;
    case "Sin cobro":
      return <Clock3Icon className="text-muted-foreground" />;
    default:
      return null;
  }
}

export function recentCustomersColumns(hoy: string): ColumnDef<DataTableFeatures, FilaCliente>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Subscribe
            source={table.atoms.rowSelection}
            selector={() =>
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() && "indeterminate")
            }
          >
            {(checked) => (
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Elegir todos los clientes de esta página"
              />
            )}
          </Subscribe>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
            {(checked) => (
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label={`Elegir a ${row.original.name}`}
              />
            )}
          </Subscribe>
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Cliente",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="bg-muted flex size-8 items-center justify-center rounded-md border">
            <UserRound className="text-muted-foreground size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-end justify-between gap-3">
              <div className="grid min-w-0 gap-0.5">
                {row.original.ruta ? (
                  <Link prefetch={false} href={row.original.ruta} className="truncate text-sm leading-none font-medium hover:underline">
                    {row.original.name}
                  </Link>
                ) : (
                  <span className="truncate text-sm leading-none font-medium">{row.original.name}</span>
                )}
                <span className="text-muted-foreground truncate text-xs leading-none">{row.original.ref}</span>
              </div>
            </div>
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) => `${row.name} ${row.ref}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: "Estado",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "billing",
      header: "Cobro",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {billingIcon(row.original.billing)}
          {row.original.billing}
          {row.original.diasAtraso != null ? ` · ${row.original.diasAtraso} d` : ""}
        </Badge>
      ),
    },
    {
      accessorKey: "plan",
      header: "Plan",
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="text-sm">{row.original.plan}</span>
          <span className="text-muted-foreground text-xs">Pagó {row.original.total} en total</span>
        </div>
      ),
    },
    {
      id: "joinedWindow",
      accessorFn: (row) => {
        const daysSinceJoined = differenceInCalendarDays(parseISO(hoy), parseISO(row.joined));

        if (daysSinceJoined <= 30) return ["30", "90"];
        if (daysSinceJoined <= 90) return ["90"];
        return [];
      },
      filterFn: "arrIncludes",
      enableHiding: true,
    },
    {
      accessorKey: "joined",
      header: "Alta",
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="text-sm">{format(parseISO(row.original.joined), "d 'de' MMMM yyyy", { locale: es })}</span>
          <span className="text-muted-foreground text-xs">{row.original.ultimo ? `último pago ${diaTxt(row.original.ultimo, hoy)}` : ""}</span>
        </div>
      ),
    },
  ];
}
