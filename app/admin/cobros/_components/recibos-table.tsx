"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. La tabla de clientes de Studio
// (src/app/(main)/dashboard/default/_components/recent-customers-table/{table,columns}.tsx) con el libro de recibos de MaKo.

// =============================================================================
// Billing › Recibos — el libro de recibos de MaKo (6/11/2026)
// =============================================================================
// La pestaña «Transactions» de Studio dice «coming soon»: acá va la tabla de su dashboard con un recibo por fila. Martín
// (5/11/2026): «me gustaría que todo esto lo vayamos evidentemente guardando dentro de la aplicación… para que tengamos un
// registro». Los filtros (mes, cuenta, medio, estado y «sólo los que no salieron») van al server (recibosAction); buscar es
// sobre lo que ya llegó. «Cargar pago» abre el recibo de Studio (dashboard/invoice).

import * as React from "react";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  Subscribe,
  useTable,
} from "@tanstack/react-table";
import { CalendarDays, CircleAlertIcon, CircleCheckIcon, Clock3Icon, CreditCard, EllipsisVertical, Landmark, Plus, Receipt, Search, UsersRound } from "lucide-react";
import { toast } from "sonner";

import Link from "@/app/_ui/Link";
import { ReportarASoporte, reportarASoporte } from "@/app/_ui/ReportarASoporte";
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
  DropdownMenuCheckboxItem,
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
import type { FiltroRecibos, ReciboListado } from "@/lib/recibos";
import { MEDIOS, ROTULO_CORREO, ROTULO_ESTADO_RECIBO, ROTULO_MEDIO, ROTULO_WA, esMedio, numeroEnTexto, totalesEnTexto, type EstadoRecibo } from "@/lib/recibos-reglas";
import { formatoMonto } from "@/lib/pasarela-moneda";

import { fechaCorta } from "../billing-vista";
import { anularReciboAction, marcarDevueltoReciboAction, recibosAction, reenviarReciboAction, type DatosRecibos } from "../recibos-actions";
import { TablaPie } from "./tabla-pie";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** Los últimos 12 meses, para el filtro. */
function ultimosMeses(hoy: string): Array<{ value: string; label: string }> {
  const [y, m] = hoy.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return { value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, label: `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  });
}

function iconoEstado(e: EstadoRecibo) {
  if (e === "emitido") return <CircleCheckIcon className="stroke-primary-foreground fill-green-500 dark:fill-green-600" />;
  if (e === "anulado") return <Clock3Icon className="text-muted-foreground" />;
  return <CircleAlertIcon className="text-amber-600 dark:text-amber-500" />;
}
const FALLA = new Set(["fallo", "reboto", "sin_destino"]);

type Pedido = { tipo: "reenviar" | "anular" | "devuelto"; recibo: ReciboListado };

export function RecibosTable({ inicial, hoy }: { inicial: DatosRecibos; hoy: string }) {
  const [filtro, setFiltro] = React.useState<FiltroRecibos>({});
  const [datos, setDatos] = React.useState<DatosRecibos>(inicial);
  const [cargando, setCargando] = React.useState(false);
  const [pedido, setPedido] = React.useState<Pedido | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [otroCorreo, setOtroCorreo] = React.useState("");
  const [avisar, setAvisar] = React.useState(false);
  const primera = React.useRef(true);

  const fallo = (texto: string) =>
    toast.error(texto, { action: { label: "Reportar a Soporte", onClick: () => reportarASoporte({ error: texto }) } });

  const cargar = React.useCallback(async (f: FiltroRecibos) => {
    setCargando(true);
    const r = await recibosAction(f).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : "No pude leer los recibos." }));
    setDatos(r);
    setCargando(false);
  }, []);
  React.useEffect(() => {
    // La primera lectura la trajo el server.
    if (primera.current) {
      primera.current = false;
      return;
    }
    void cargar(filtro);
  }, [cargar, filtro]);

  const meses = React.useMemo(() => ultimosMeses(hoy), [hoy]);

  function pedir(tipo: Pedido["tipo"], r: ReciboListado) {
    setOtroCorreo("");
    setAvisar(r.correo_estado === "enviado");
    setPedido({ tipo, recibo: r });
  }

  async function hacer() {
    if (!pedido) return;
    const r = pedido.recibo;
    setOcupado(true);
    const x =
      pedido.tipo === "reenviar"
        ? await reenviarReciboAction(r.id, { correo: otroCorreo.trim() || null })
            .then((y) => (y.ok ? { ok: true as const, texto: `Correo: ${ROTULO_CORREO[y.correo] ?? y.correo}` } : { ok: false as const, texto: y.error }))
            .catch(() => ({ ok: false as const, texto: "No pude reenviarlo." }))
        : pedido.tipo === "anular"
          ? await anularReciboAction(r.id, avisar).then((y) => (y.ok ? { ok: true as const, texto: "Recibo anulado" } : { ok: false as const, texto: y.error })).catch(() => ({ ok: false as const, texto: "No pude anularlo." }))
          : await marcarDevueltoReciboAction(r.id).then((y) => (y.ok ? { ok: true as const, texto: "Marcado devuelto" } : { ok: false as const, texto: y.error })).catch(() => ({ ok: false as const, texto: "No pude marcarlo." }));
    setOcupado(false);
    setPedido(null);
    if (!x.ok) fallo(x.texto);
    else toast.success(x.texto);
    void cargar(filtro);
  }

  const columns = React.useMemo<ColumnDef<DataTableFeatures, ReciboListado>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Subscribe
              source={table.atoms.rowSelection}
              selector={() => table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() && "indeterminate")}
            >
              {(checked) => <Checkbox checked={checked} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Elegir todos los recibos de esta página" />}
            </Subscribe>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
              {(checked) => <Checkbox checked={checked} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label={`Elegir el recibo ${numeroEnTexto(row.original.numero)}`} />}
            </Subscribe>
          </div>
        ),
        enableHiding: false,
      },
      {
        id: "nombre",
        header: "A nombre de",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="bg-muted flex size-8 items-center justify-center rounded-md border">
                <Receipt className="text-muted-foreground size-4" />
              </span>
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm leading-none font-medium">{r.a_nombre}</span>
                <span className="text-muted-foreground max-w-64 truncate text-xs leading-none">
                  N.º {numeroEnTexto(r.numero)} · {r.lineas.map((l) => l.concepto).join(", ")}
                </span>
              </div>
            </div>
          );
        },
        enableHiding: false,
      },
      { id: "search", accessorFn: (r) => `${r.a_nombre} ${numeroEnTexto(r.numero)} ${r.lineas.map((l) => l.concepto).join(" ")}`, filterFn: "includesString", enableHiding: true },
      {
        id: "recibido",
        header: "Recibido",
        cell: ({ row }) => {
          const r = row.original;
          const medios = [...new Set(r.pagos.map((p) => (esMedio(p.medio) ? ROTULO_MEDIO[p.medio] : p.medio)))].join(" y ");
          return (
            <div className="grid gap-0.5">
              <span className="text-sm tabular-nums">{totalesEnTexto(r.totales_recibido)}</span>
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                {medios}
                {r.origen === "manual" && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    a mano
                  </Badge>
                )}
              </span>
            </div>
          );
        },
      },
      { id: "fecha", header: "Fecha", cell: ({ row }) => <span className="text-sm">{fechaCorta(row.original.fecha_pago)}</span> },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) => (
          <div className="grid gap-1">
            <Badge variant="outline" className="text-muted-foreground px-1.5">
              {iconoEstado(row.original.estado as EstadoRecibo)}
              {ROTULO_ESTADO_RECIBO[row.original.estado as EstadoRecibo] ?? row.original.estado}
            </Badge>
            {row.original.disputa_texto && <span className="text-muted-foreground max-w-56 text-xs">{row.original.disputa_texto}</span>}
          </div>
        ),
      },
      {
        id: "envio",
        header: "Correo · WhatsApp",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="grid gap-1">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className={FALLA.has(r.correo_estado) ? "text-destructive px-1.5" : "text-muted-foreground px-1.5"}>
                  {ROTULO_CORREO[r.correo_estado] ?? r.correo_estado}
                </Badge>
                <Badge variant="outline" className={FALLA.has(r.wa_estado) ? "text-destructive px-1.5" : "text-muted-foreground px-1.5"}>
                  {ROTULO_WA[r.wa_estado] ?? r.wa_estado}
                </Badge>
              </div>
              {(r.correo_error || r.wa_error) && <span className="text-muted-foreground max-w-56 text-xs">{r.correo_error ?? r.wa_error}</span>}
            </div>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const r = row.original;
          const comprobantes = r.pagos.filter((p) => p.comprobante_path && !p.anulado);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-muted-foreground data-[state=open]:bg-muted flex size-8" size="icon">
                  <EllipsisVertical />
                  <span className="sr-only">Acciones</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem asChild>
                  <a href={`/api/admin/recibos/${r.id}/pdf`}>Bajar el PDF</a>
                </DropdownMenuItem>
                {comprobantes.map((p, i) => (
                  <DropdownMenuItem key={p.id} asChild>
                    <a href={`/api/admin/recibos/${r.id}/comprobante/${p.id}`} target="_blank" rel="noopener noreferrer">
                      {comprobantes.length > 1 ? `Ver el comprobante ${i + 1}` : "Ver el comprobante"}
                    </a>
                  </DropdownMenuItem>
                ))}
                {r.estado === "emitido" && <DropdownMenuItem onSelect={() => pedir("reenviar", r)}>Reenviar</DropdownMenuItem>}
                {r.origen === "manual" && r.estado === "emitido" && <DropdownMenuItem onSelect={() => pedir("devuelto", r)}>Marcar devuelto</DropdownMenuItem>}
                {r.origen === "manual" && r.estado !== "anulado" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => pedir("anular", r)}>
                      Anular
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
  );

  const lista = datos.ok ? datos.recibos : [];
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility] = React.useState<ColumnVisibilityState>({ search: false });
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const table = useTable({
    features: dataTableFeatures,
    data: lista,
    columns,
    state: { rowSelection, columnFilters, columnVisibility, pagination },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
  });
  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";

  if (!datos.ok) {
    return (
      <div role="alert" className="text-destructive flex flex-col items-start gap-2 rounded-lg border p-4 text-sm">
        <p>{datos.error}</p>
        <ReportarASoporte error={datos.error} />
      </div>
    );
  }
  if (datos.faltaLaMigracion) {
    return <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">Los recibos todavía no están listos: falta aplicar la migración 0397.</p>;
  }

  const vigentes = Object.entries(datos.totales.vigentes);
  const devueltos = Object.entries(datos.totales.devueltos);
  const filtroMenu = (icono: React.ReactNode, rotulo: string, valor: string, opciones: Array<{ value: string; label: string }>, cambiar: (v: string) => void) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {icono}
          {rotulo}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 w-48 overflow-y-auto" align="start">
        <DropdownMenuRadioGroup value={valor} onValueChange={cambiar}>
          <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
          {opciones.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const r = pedido?.recibo;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
              placeholder="Buscar recibos..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                table.setPageIndex(0);
              }}
            />
          </div>
          {filtroMenu(<CalendarDays />, "Mes", filtro.mes ?? "all", meses, (v) => setFiltro((f) => ({ ...f, mes: v === "all" ? null : v })))}
          {filtroMenu(
            <UsersRound />,
            "Cuenta",
            filtro.destinoWs ? String(filtro.destinoWs) : "all",
            datos.cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
            (v) => setFiltro((f) => ({ ...f, destinoWs: v === "all" ? null : Number(v) })),
          )}
          {filtroMenu(
            <Landmark />,
            "Medio",
            filtro.medio ?? "all",
            MEDIOS.map((m) => ({ value: m, label: ROTULO_MEDIO[m] })),
            (v) => setFiltro((f) => ({ ...f, medio: v === "all" ? null : v })),
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CreditCard />
                Estado
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52" align="start">
              <DropdownMenuRadioGroup value={filtro.estado ?? "all"} onValueChange={(v) => setFiltro((f) => ({ ...f, estado: v === "all" ? null : (v as EstadoRecibo) }))}>
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                {(Object.keys(ROTULO_ESTADO_RECIBO) as EstadoRecibo[]).map((e) => (
                  <DropdownMenuRadioItem key={e} value={e}>
                    {ROTULO_ESTADO_RECIBO[e]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={!!filtro.soloFallas} onCheckedChange={(v) => setFiltro((f) => ({ ...f, soloFallas: v === true }))}>
                Sólo los que no salieron
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
          <Button size="sm" asChild>
            <Link prefetch={false} href="/admin?tab=billing&recibo=nuevo">
              <Plus data-icon="inline-start" />
              Cargar pago
            </Link>
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums">
        <span>
          Total: <span className="text-foreground font-medium">{vigentes.length ? vigentes.map(([m, v]) => formatoMonto(v, m)).join(" + ") : "—"}</span>
        </span>
        {devueltos.length > 0 && <span>Devuelto: {devueltos.map(([m, v]) => formatoMonto(v, m)).join(" + ")}</span>}
        {datos.alTope && <span>Se muestran los 200 más nuevos.</span>}
        {cargando && <span>Actualizando…</span>}
      </div>

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
                  {lista.length ? "Ningún recibo con esa búsqueda." : "Todavía no hay recibos: cuando entre un pago, su recibo aparece aquí."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablaPie table={table} id="recibos-rows-per-page" elegidos="elegidos" />

      <AlertDialog open={!!pedido} onOpenChange={(v) => !v && !ocupado && setPedido(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {r && (pedido?.tipo === "reenviar" ? `¿Reenviar el recibo N.º ${numeroEnTexto(r.numero)}?` : pedido?.tipo === "anular" ? `¿Anular el recibo N.º ${numeroEnTexto(r.numero)}?` : `¿Marcar devuelto el N.º ${numeroEnTexto(r.numero)}?`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {r && pedido?.tipo === "reenviar" &&
                `Sale otra vez por correo a ${r.correo_a?.length ? r.correo_a.join(", ") : "los admins de su cuenta"}${r.solo_correo ? "" : ", y al grupo de su cuenta"}.`}
              {r && pedido?.tipo === "anular" && `El N.º ${numeroEnTexto(r.numero)} queda gastado y sus órdenes se liberan: se corrige cargando otro.`}
              {r && pedido?.tipo === "devuelto" && "Queda marcado devuelto, con el mismo número. Si el correo ya le llegó, le avisamos una vez."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {r && pedido?.tipo === "reenviar" && (
            <Input type="email" placeholder="Otro correo (opcional)" value={otroCorreo} onChange={(e) => setOtroCorreo(e.target.value)} aria-label="Otro correo" />
          )}
          {r && pedido?.tipo === "anular" && r.correo_estado === "enviado" && (
            <div className="flex items-center gap-2">
              <Checkbox id="avisar-anulado" checked={avisar} onCheckedChange={(v) => setAvisar(v === true)} />
              <Label htmlFor="avisar-anulado" className="text-sm font-normal">
                Avisarle a quien lo recibió
              </Label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>No cambiar nada</AlertDialogCancel>
            <AlertDialogAction
              variant={pedido?.tipo === "reenviar" ? "default" : "destructive"}
              disabled={ocupado}
              onClick={(e) => {
                e.preventDefault();
                void hacer();
              }}
            >
              {ocupado ? "Un momento…" : pedido?.tipo === "reenviar" ? "Reenviar" : pedido?.tipo === "anular" ? "Anular el recibo" : "Marcar devuelto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

