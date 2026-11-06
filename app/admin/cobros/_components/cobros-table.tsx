"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. La tabla de clientes de Studio
// (src/app/(main)/dashboard/default/_components/recent-customers-table/{table,columns}.tsx) con los cobros de MaKo.

// =============================================================================
// Billing › Cobros — lo que MaKo cobró, y en qué quedó la cuenta de cada comprador (6/11/2026)
// =============================================================================
// La pestaña «Accounts» de Studio dice «coming soon»: acá va la tabla de su dashboard (buscar, filtros, ordenar, selección,
// páginas) con un cobro por fila. Dos estados y no uno, a propósito: un cobro puede estar pagado y la cuenta no haberse creado
// (el email ya era de otra cuenta, o el alta falló), y eso es justo lo que hay que ver acá para resolverlo.
//
// ⚠️ REEMBOLSAR DEVUELVE PLATA REAL y no se reintenta solo: pasa por una confirmación, y si la pasarela lo rechaza, el motivo
//    queda a la vista. La cuenta que se creó al pagar NO se da de baja con el reembolso.
// ⚠️ Y REEMBOLSAR NO CORTA UNA SUSCRIPCIÓN (revisión del 23/10/2026): en una suscripción viva el reembolso trae marcada «Cortar
//    también la suscripción», y hay una acción propia para cortarla (también con el primer pago ya devuelto).

import * as React from "react";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  Subscribe,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpDown, CircleAlertIcon, CircleCheckIcon, Clock3Icon, CreditCard, Download, EllipsisVertical, LoaderIcon, Search, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { useRouter } from "@/app/_ui/Link";
import { reportarASoporte } from "@/app/_ui/ReportarASoporte";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/admin/_studio/components/ui/alert-dialog";
import { Badge } from "@/app/admin/_studio/components/ui/badge";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Checkbox } from "@/app/admin/_studio/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/admin/_studio/components/ui/dropdown-menu";
import { Input } from "@/app/admin/_studio/components/ui/input";
import { Label } from "@/app/admin/_studio/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/admin/_studio/components/ui/table";
import { type DataTableFeatures, dataTableFeatures } from "@/app/admin/_studio/lib/data-table-features";
import { bajarCsv } from "@/app/admin/_studio/lib/exportar";
import { NOMBRE_PASARELA, rotuloEstado, type EstadoAlta, type EstadoCobro } from "@/lib/cobros-tipos";
import { formatoMonto } from "@/lib/pasarela-moneda";

import { anularCobroMakoAction, atarCobroMakoAction, cancelarSuscripcionMakoAction, reembolsarCobroMakoAction, type CobroMako } from "../actions";
import { fechaCorta } from "../billing-vista";
import { TablaPie } from "./tabla-pie";

const ALTA: Record<EstadoAlta, string> = {
  pendiente: "Creando la cuenta",
  hecha: "Cuenta creada",
  ya_tenia_cuenta: "Ya tenía cuenta",
  error: "El alta falló",
};

function iconoCobro(e: EstadoCobro) {
  switch (e) {
    case "pagado":
      return <CircleCheckIcon className="stroke-primary-foreground fill-green-500 dark:fill-green-600" />;
    case "pendiente":
      return <LoaderIcon />;
    case "fallido":
    case "reembolsado":
      return <CircleAlertIcon className="text-amber-600 dark:text-amber-500" />;
    default:
      return <Clock3Icon className="text-muted-foreground" />;
  }
}

const cuentaDe = (c: CobroMako): string => (c.alta_estado ? ALTA[c.alta_estado] : c.plan ? (c.estado === "pagado" ? "Sin alta" : "Al pagar") : "Sin cuenta");

type Pedido = { tipo: "anular" | "reembolsar" | "atar" | "cortar"; cobro: CobroMako };

const ESTADOS: EstadoCobro[] = ["pendiente", "pagado", "fallido", "reembolsado", "anulado"];
const CUENTAS = ["Cuenta creada", "Creando la cuenta", "Ya tenía cuenta", "El alta falló", "Sin alta", "Al pagar", "Sin cuenta"];
const sortOptions = [
  { value: "newest", label: "Más nuevos primero" },
  { value: "oldest", label: "Más viejos primero" },
  { value: "monto-desc", label: "Monto mayor" },
  { value: "monto-asc", label: "Monto menor" },
] as const;
const sortOptionState = {
  newest: [{ id: "fecha", desc: true }],
  oldest: [{ id: "fecha", desc: false }],
  "monto-desc": [{ id: "monto", desc: true }],
  "monto-asc": [{ id: "monto", desc: false }],
} satisfies Record<(typeof sortOptions)[number]["value"], SortingState>;

export function CobrosTable({ cobros, truncado }: { cobros: CobroMako[]; truncado: boolean }) {
  const router = useRouter();
  const [pedido, setPedido] = React.useState<Pedido | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  // La casilla «Cortar también la suscripción» del reembolso: marcada si la suscripción sigue viva.
  const [cortar, setCortar] = React.useState(true);

  const fallo = (texto: string) =>
    toast.error(texto, { action: { label: "Reportar a Soporte", onClick: () => reportarASoporte({ error: texto }) } });

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    } catch {
      fallo(`No pude copiarlo. El link es: ${link}`);
    }
  }

  function pedir(tipo: Pedido["tipo"], c: CobroMako) {
    if (tipo === "reembolsar") setCortar(c.suscripcionViva);
    setPedido({ tipo, cobro: c });
  }

  async function hacer() {
    if (!pedido) return;
    const c = pedido.cobro;
    setOcupado(true);
    const r =
      pedido.tipo === "anular"
        ? await anularCobroMakoAction(c.id).then((x) => ({ ok: x.ok, texto: x.error ?? "No pude anular el link." })).catch(() => ({ ok: false, texto: "No pude anular el link." }))
        : pedido.tipo === "reembolsar"
          ? await reembolsarCobroMakoAction(c.id, null, { cortarSuscripcion: c.suscripcionViva && cortar })
              .then((x) => ({ ok: x.ok, texto: x.resumen }))
              .catch(() => ({ ok: false, texto: "No pude hacer el reembolso." }))
          : pedido.tipo === "atar"
            ? await atarCobroMakoAction(c.id).then((x) => ({ ok: x.ok, texto: x.resumen })).catch(() => ({ ok: false, texto: "No pude atar el cobro a su cuenta." }))
            : await cancelarSuscripcionMakoAction(c.id).then((x) => ({ ok: x.ok, texto: x.resumen })).catch(() => ({ ok: false, texto: "No pude cortar la suscripción." }));
    setOcupado(false);
    setPedido(null);
    // Un reembolso que la pasarela rechazó se dice con SU motivo, y no se reintenta solo.
    if (!r.ok) fallo(r.texto);
    else toast.success({ anular: "Link anulado", reembolsar: "Reembolso hecho", atar: "Plan asignado", cortar: "Suscripción cortada" }[pedido.tipo]);
    router.refresh();
  }

  const columns = React.useMemo<ColumnDef<DataTableFeatures, CobroMako>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Subscribe
              source={table.atoms.rowSelection}
              selector={() => table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() && "indeterminate")}
            >
              {(checked) => <Checkbox checked={checked} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Elegir todos los cobros de esta página" />}
            </Subscribe>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
              {(checked) => <Checkbox checked={checked} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label={`Elegir el cobro de ${row.original.nombre ?? row.original.email ?? "este comprador"}`} />}
            </Subscribe>
          </div>
        ),
        enableHiding: false,
      },
      {
        id: "comprador",
        accessorFn: (c) => c.nombre ?? c.email ?? "",
        header: "Comprador",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="bg-muted flex size-8 items-center justify-center rounded-md border">
                <UserRound className="text-muted-foreground size-4" />
              </span>
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm leading-none font-medium">{c.nombre || c.email || "Sin nombre"}</span>
                <span className="text-muted-foreground truncate text-xs leading-none">{c.nombre && c.email ? c.email : `cobro ${c.id}`}</span>
              </div>
            </div>
          );
        },
        enableHiding: false,
      },
      { id: "search", accessorFn: (c) => `${c.nombre ?? ""} ${c.email ?? ""} ${c.plan ?? c.concepto} ${c.alta_ws_nombre ?? ""}`, filterFn: "includesString", enableHiding: true },
      {
        id: "plan",
        accessorFn: (c) => c.plan ?? c.concepto,
        header: "Plan",
        cell: ({ row }) => (
          <div className="grid gap-0.5">
            <span className="text-sm">{row.original.plan ?? row.original.concepto}</span>
            <span className="text-muted-foreground text-xs">{row.original.tipo === "suscripcion" ? "Todos los meses" : "Una vez"}</span>
          </div>
        ),
      },
      {
        id: "monto",
        accessorFn: (c) => c.monto_usd ?? c.monto,
        header: "Monto",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="grid gap-0.5">
              <span className="text-sm tabular-nums">
                {formatoMonto(c.monto, c.moneda)}
                {c.tipo === "suscripcion" ? " por mes" : ""}
              </span>
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                {NOMBRE_PASARELA[c.proveedor]}
                {c.modo === "prueba" && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    prueba
                  </Badge>
                )}
              </span>
            </div>
          );
        },
      },
      {
        id: "estado",
        accessorFn: (c) => c.estado,
        header: "Cobro",
        filterFn: "equalsString",
        cell: ({ row }) => (
          <div className="grid gap-1">
            <Badge variant="outline" className="text-muted-foreground px-1.5">
              {iconoCobro(row.original.estado)}
              {rotuloEstado(row.original.estado)}
            </Badge>
            {row.original.motivo && row.original.estado !== "pagado" && <span className="text-muted-foreground max-w-56 text-xs">{row.original.motivo}</span>}
          </div>
        ),
      },
      {
        id: "cuenta",
        accessorFn: cuentaDe,
        header: "Cuenta",
        filterFn: "equalsString",
        cell: ({ row }) => (
          <div className="grid gap-1">
            <Badge variant="outline" className="text-muted-foreground px-1.5">
              {cuentaDe(row.original)}
            </Badge>
            {row.original.alta_ws_nombre && <span className="text-xs">{row.original.alta_ws_nombre}</span>}
            {row.original.alta_motivo && <span className="text-muted-foreground max-w-56 text-xs">{row.original.alta_motivo}</span>}
          </div>
        ),
      },
      {
        id: "fecha",
        accessorFn: (c) => c.created_at,
        header: "Fecha",
        cell: ({ row }) => (
          <div className="grid gap-0.5">
            <span className="text-sm">{fechaCorta(row.original.created_at)}</span>
            <span className="text-muted-foreground text-xs">{row.original.pagado_at ? `pagó el ${fechaCorta(row.original.pagado_at)}` : ""}</span>
          </div>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const c = row.original;
          const puedeAnular = c.estado === "pendiente" || c.estado === "fallido";
          const puedeAtar = c.estado === "pagado" && c.alta_estado === "ya_tenia_cuenta";
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-muted-foreground data-[state=open]:bg-muted flex size-8" size="icon">
                  <EllipsisVertical />
                  <span className="sr-only">Acciones</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {c.link && <DropdownMenuItem onSelect={() => void copiar(c.link!)}>Copiar el link</DropdownMenuItem>}
                {puedeAtar && <DropdownMenuItem onSelect={() => pedir("atar", c)}>Darle el plan a su cuenta</DropdownMenuItem>}
                {puedeAnular && <DropdownMenuItem onSelect={() => pedir("anular", c)}>Anular el link</DropdownMenuItem>}
                {c.suscripcionViva && (
                  <DropdownMenuItem variant="destructive" onSelect={() => pedir("cortar", c)}>
                    Cortar la suscripción
                  </DropdownMenuItem>
                )}
                {c.estado === "pagado" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => pedir("reembolsar", c)}>
                      Reembolsar
                    </DropdownMenuItem>
                  </>
                )}
                {!c.link && !puedeAtar && !puedeAnular && !c.suscripcionViva && c.estado !== "pagado" && <DropdownMenuItem disabled>Nada que hacer</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las acciones leen el estado al momento del clic
    [],
  );

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "fecha", desc: true }]);
  const [columnVisibility] = React.useState<ColumnVisibilityState>({ search: false });
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const table = useTable({
    features: dataTableFeatures,
    data: cobros,
    columns,
    state: { rowSelection, columnFilters, sorting, columnVisibility, pagination },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
  const estadoFiltro = (table.getColumn("estado")?.getFilterValue() as string | undefined) ?? "all";
  const cuentaFiltro = (table.getColumn("cuenta")?.getFilterValue() as string | undefined) ?? "all";
  const sortValue = (Object.entries(sortOptionState).find(([, s]) => s[0].id === sorting[0]?.id && s[0].desc === sorting[0]?.desc)?.[0] ?? "newest") as keyof typeof sortOptionState;

  function exportar() {
    const filas = table.getFilteredRowModel().rows.map((r) => r.original);
    bajarCsv("cobros-de-mako.csv", [
      ["Comprador", "Email", "Plan", "Monto", "Moneda", "Cada cuánto", "Pasarela", "Cobro", "Cuenta", "Negocio", "Creado", "Pagado"],
      ...filas.map((c) => [
        c.nombre ?? "", c.email ?? "", c.plan ?? c.concepto, c.monto, c.moneda, c.tipo === "suscripcion" ? "Todos los meses" : "Una vez",
        NOMBRE_PASARELA[c.proveedor], rotuloEstado(c.estado), cuentaDe(c), c.alta_ws_nombre ?? "", c.created_at.slice(0, 10), c.pagado_at?.slice(0, 10) ?? "",
      ]),
    ]);
  }

  const c = pedido?.cobro;
  const quien = c?.nombre ?? c?.email ?? "este comprador";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-80">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
              placeholder="Buscar cobros..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                table.setPageIndex(0);
              }}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CreditCard />
                Cobro
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="start">
              <DropdownMenuRadioGroup
                value={estadoFiltro}
                onValueChange={(value) => {
                  table.getColumn("estado")?.setFilterValue(value === "all" ? undefined : value);
                  table.setPageIndex(0);
                }}
              >
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                {ESTADOS.map((e) => (
                  <DropdownMenuRadioItem key={e} value={e}>
                    {rotuloEstado(e)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <UsersRound />
                Cuenta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44" align="start">
              <DropdownMenuRadioGroup
                value={cuentaFiltro}
                onValueChange={(value) => {
                  table.getColumn("cuenta")?.setFilterValue(value === "all" ? undefined : value);
                  table.setPageIndex(0);
                }}
              >
                <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
                {CUENTAS.map((e) => (
                  <DropdownMenuRadioItem key={e} value={e}>
                    {e}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sortValue}
                onValueChange={(value) => {
                  table.setSorting(sortOptionState[value as keyof typeof sortOptionState] ?? sortOptionState.newest);
                  table.setPageIndex(0);
                }}
              >
                {sortOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download data-icon="inline-start" />
            Exportar
          </Button>
        </div>
      </div>

      {truncado && <p className="text-muted-foreground text-xs">Se muestran los {cobros.length} más nuevos.</p>}

      <div className="bg-card overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/15">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="h-11 p-3 font-medium">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={table.state.rowSelection[row.id] && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-3 align-middle">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  {cobros.length ? "Ningún cobro con esos filtros." : "Todavía no hay cobros: cuando vendas un plan, aparece aquí."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablaPie table={table} id="cobros-rows-per-page" elegidos="elegidos" />

      <AlertDialog open={!!pedido} onOpenChange={(v) => !v && !ocupado && setPedido(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pedido?.tipo === "anular"
                ? `¿Anular el link de ${quien}?`
                : pedido?.tipo === "reembolsar"
                  ? `¿Reembolsar a ${quien}?`
                  : pedido?.tipo === "atar"
                    ? "¿Darle el plan a su cuenta?"
                    : `¿Cortar la suscripción de ${quien}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {c && pedido?.tipo === "anular" && "Nadie va a poder pagar este link."}
              {c && pedido?.tipo === "reembolsar" &&
                `Se ${c.tipo === "suscripcion" ? "devuelve el primer pago" : "devuelven"}: ${formatoMonto(c.monto, c.moneda)} por ${NOMBRE_PASARELA[c.proveedor]}. No se puede deshacer, y su cuenta de MaKo sigue activa.`}
              {c && pedido?.tipo === "atar" && `La cuenta de MaKo de ${c.email} pasa al plan ${c.plan ?? "pagado"}, y este cobro queda atado a ella.`}
              {c && pedido?.tipo === "cortar" &&
                `${NOMBRE_PASARELA[c.proveedor]} deja de cobrarle cada mes, desde ahora. No devuelve nada.${c.proveedor === "mercadopago" ? " En Mercado Pago no se puede deshacer." : ""}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {c && pedido?.tipo === "reembolsar" && c.suscripcionViva && (
            <div className="flex items-start gap-2">
              <Checkbox id="cortar-suscripcion" checked={cortar} onCheckedChange={(v) => setCortar(v === true)} />
              <Label htmlFor="cortar-suscripcion" className="text-sm leading-snug font-normal">
                Cortar también la suscripción. Si no, se le sigue cobrando cada mes.
              </Label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>No cambiar nada</AlertDialogCancel>
            <AlertDialogAction
              variant={pedido?.tipo === "atar" ? "default" : "destructive"}
              disabled={ocupado}
              onClick={(e) => {
                e.preventDefault();
                void hacer();
              }}
            >
              {ocupado
                ? "Un momento…"
                : pedido?.tipo === "anular"
                  ? "Anular el link"
                  : pedido?.tipo === "reembolsar"
                    ? "Reembolsar"
                    : pedido?.tipo === "atar"
                      ? "Darle el plan"
                      : "Cortar la suscripción"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
