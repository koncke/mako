"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.

// =============================================================================
// Admin › Users — Studio Admin (MIT), src/app/(main)/dashboard/users/_components/users.tsx (5/11/2026)
// =============================================================================
// Martín, 5/11/2026: «Users = dashboard/users, tal cual: filtros Role, Team, Status y Workspace, Hide, Customize, Export,
// vista lista o grilla, selección. El «…» de cada fila trae las acciones reales de MaKo». Copiado tal cual: la tarjeta, el
// buscador con su ⌘K, los cuatro filtros, «N selected», el selector lista / grilla y la tabla. Lo que en Studio se dibuja
// y no hace nada, acá anda, con piezas del MISMO repo:
//   · «Hide» es el «Toggle columns» de su tabla de tareas (src/app/(main)/dashboard/tasks/_components/tasks-toolbar.tsx);
//   · «Customize» es el «Sort» de su tabla de clientes (dashboard/default/_components/recent-customers-table/table.tsx);
//   · «Export» baja un CSV de lo elegido (o de lo filtrado, sin nada elegido);
//   · el ⌘K enfoca el buscador (en Studio está dibujado);
//   · la grilla dibuja las mismas filas como tarjetas (./users-grid.tsx).
// «Add User» no está: el alta de una persona es de su negocio (Settings › Equipo) o del alta de un cliente (Customers).
//
// ⚠️ LAS ACCIONES VAN POR /api/admin/usuarios, la ruta de siempre: vuelve a preguntar `getSesionAdmin`, frena dejar a un
//    negocio sin su admin y, al suspender, apaga los tokens de la API de esa persona. Esta pantalla no decide nada.
// ⚠️ «Entrar a su negocio» es una RECARGA ENTERA a /inicio?ws=N (no un Link): el layout dibuja la barra de «Viendo a X».

import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Download, Grid, Rows3, Search, SlidersHorizontal } from "lucide-react";
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
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/admin/_studio/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/app/admin/_studio/components/ui/input-group";
import { Kbd } from "@/app/admin/_studio/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/app/admin/_studio/components/ui/tabs";
import { dataTableFeatures } from "@/app/admin/_studio/lib/data-table-features";
import { bajarCsv } from "@/app/admin/_studio/lib/exportar";
import { rolTxt } from "@/lib/admin-usuarios-reglas";

import { TODOS, estadoTxt, fechaHoraTxt, filtrosDe, negocioTxt, type UserRow } from "./data";
import { type AccionUsuario, type ContextoColumnas, usersColumns } from "./users-columns";
import { UsersTable } from "./users-table";

/** Lo que dice cada columna en «Hide» (Studio mostraba el id). */
const ROTULO_COLUMNA: Record<string, string> = { name: "Usuario", role: "Rol / Tipo", team: "Tipo", workspace: "Workspace", status: "Estado", joinedDate: "Alta" };

const sortOptions = [
  { value: "newest", label: "Más nuevos primero" },
  { value: "oldest", label: "Más viejos primero" },
  { value: "name-asc", label: "Nombre A-Z" },
  { value: "name-desc", label: "Nombre Z-A" },
] as const;
const sortOptionState = {
  newest: [{ id: "joinedDate", desc: true }],
  oldest: [{ id: "joinedDate", desc: false }],
  "name-asc": [{ id: "name", desc: false }],
  "name-desc": [{ id: "name", desc: true }],
} satisfies Record<(typeof sortOptions)[number]["value"], SortingState>;

export function Users({ users, ahoraMs, tz }: { users: UserRow[]; ahoraMs: number; tz: string }) {
  const router = useRouter();
  const buscar = React.useRef<HTMLInputElement>(null);
  const [vista, setVista] = React.useState<"list" | "grid">("list");
  const [pedir, setPedir] = React.useState<{ u: UserRow; accion: "suspender" | "reactivar" } | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "joinedDate", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    search: false,
    team: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const filters = React.useMemo(() => filtrosDe(users), [users]);

  async function llamar(cuerpo: Record<string, unknown>): Promise<boolean> {
    setOcupado(true);
    try {
      const r = await fetch('/api/admin/usuarios', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || `No se pudo (HTTP ${r.status}).`);
      return true;
    } catch (e) {
      const error = e instanceof Error ? e.message : "No se pudo conectar.";
      toast.error(error, { action: { label: "Reportar a Soporte", onClick: () => void reportarASoporte({ error, accion: "Admin › Users" }) } });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const onAccion = React.useCallback(async (u: UserRow, accion: AccionUsuario) => {
    if (accion === "ver") { if (u.workspaceId != null) router.push(`/admin?tab=customers&cliente=${u.workspaceId}`); return; }
    if (accion === "inspeccionar") { if (u.workspaceId != null) window.location.href = `/inicio?ws=${u.workspaceId}`; return; }
    if (accion === "reenviar") { if (await llamar({ action: 'reinvitar', id: u.id })) toast.success(`Acceso reenviado a ${u.email}`); return; }
    setPedir({ u, accion });
  }, [router]);

  async function confirmar() {
    if (!pedir) return;
    const { u, accion } = pedir;
    // Reactivar a quien nunca entró lo devuelve a «invitado», no a «activo»: no entró.
    const nuevo = accion === "suspender" ? "suspendido" : u.ultimoLogin ? "activo" : "invitado";
    if (await llamar({ action: 'estado', id: u.id, estado: nuevo })) {
      setPedir(null);
      toast.success(accion === "suspender" ? `${u.nombre || u.email} quedó suspendido` : `${u.nombre || u.email} puede volver a entrar`);
      router.refresh();
    }
  }

  const ctx = React.useMemo<ContextoColumnas>(() => ({ ahoraMs, tz, onAccion }), [ahoraMs, tz, onAccion]);
  const columns = React.useMemo(() => usersColumns(ctx), [ctx]);

  const table = useTable({
    features: dataTableFeatures,
    data: users,
    columns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => String(row.id),
    autoResetPageIndex: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  // El ⌘K del buscador (en Studio, dibujado). En captura: así gana a la búsqueda de la cabecera, que también lo escucha.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        buscar.current?.focus();
      }
    };
    document.addEventListener("keydown", down, true);
    return () => document.removeEventListener("keydown", down, true);
  }, []);

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
  const roleFilter = (table.getColumn("role")?.getFilterValue() as string | undefined) ?? filters.role[0];
  const teamFilter = (table.getColumn("team")?.getFilterValue() as string | undefined) ?? filters.team[0];
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? filters.status[0];
  const workspaceFilter =
    (table.getColumn("workspace")?.getFilterValue() as string | undefined) ?? filters.workspace[0];
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.id !== "search" && typeof column.accessorFn !== "undefined" && column.getCanHide());
  const sortValue = (() => {
    const s = sorting[0];
    if (s?.id === "joinedDate" && !s.desc) return "oldest";
    if (s?.id === "name") return s.desc ? "name-desc" : "name-asc";
    return "newest";
  })();

  function setColumnSelectFilter(columnId: string, value: string) {
    table.getColumn(columnId)?.setFilterValue(value === TODOS ? undefined : value);
    table.setPageIndex(0);
  }

  function exportar() {
    const elegidas = table.getFilteredSelectedRowModel().rows;
    const filas = (elegidas.length ? elegidas : table.getFilteredRowModel().rows).map((r) => r.original);
    bajarCsv("personas-de-mako.csv", [
      ["Nombre", "Email", "Rol", "Tipo", "Negocio", "Estado", "Alta", "Último ingreso"],
      ...filas.map((u) => [u.nombre, u.email, rolTxt(u), u.tipo, negocioTxt(u), estadoTxt(u, ahoraMs), fechaHoraTxt(u.creado, tz), fechaHoraTxt(u.ultimoLogin, tz)]),
    ]);
  }

  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle className="text-xl leading-none">Users</CardTitle>
        <CardDescription className="max-w-sm leading-snug">
          Las personas de todos los negocios y su acceso.
        </CardDescription>
        <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              ref={buscar}
              className="h-7"
              placeholder="Buscar personas..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                table.setPageIndex(0);
              }}
            />
            <InputGroupAddon align="inline-end">
              <Kbd className="h-4 text-[10px]">⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal /> Ocultar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-38">
              <DropdownMenuLabel>Columnas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {ROTULO_COLUMNA[column.id] ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown /> Ordenar
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
            <Download /> Exportar
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={roleFilter} onValueChange={(value) => setColumnSelectFilter("role", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Rol:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {filters.role.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={teamFilter} onValueChange={(value) => setColumnSelectFilter("team", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Tipo:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {filters.team.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setColumnSelectFilter("status", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Estado:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {filters.status.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Select value={workspaceFilter} onValueChange={(value) => setColumnSelectFilter("workspace", value)}>
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Workspace:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                {filters.workspace.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 px-4">
          <div className="text-muted-foreground text-sm tabular-nums">{selectedCount} {selectedCount === 1 ? "elegida" : "elegidas"}</div>

          <Tabs value={vista} onValueChange={(v) => setVista(v === "grid" ? "grid" : "list")}>
            <TabsList>
              <TabsTrigger value="list" aria-label="Ver en lista">
                <Rows3 />
              </TabsTrigger>
              <TabsTrigger value="grid" aria-label="Ver en grilla">
                <Grid />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <UsersTable table={table} vista={vista} ctx={ctx} />
      </CardContent>

      <AlertDialog open={pedir != null} onOpenChange={(abierto) => { if (!abierto && !ocupado) setPedir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pedir?.accion === "suspender" ? `¿Suspender a ${pedir.u.nombre || pedir.u.email}?` : `¿Reactivar a ${pedir?.u.nombre || pedir?.u.email}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pedir?.accion === "suspender" ? "No va a poder entrar a MaKo y se apagan sus tokens de la API. Se puede reactivar." : "Vuelve a poder entrar con su cuenta."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>No cambiar nada</AlertDialogCancel>
            <AlertDialogAction
              variant={pedir?.accion === "suspender" ? "destructive" : "default"}
              disabled={ocupado}
              onClick={(e) => { e.preventDefault(); void confirmar(); }}
            >
              {pedir?.accion === "suspender" ? "Suspender su acceso" : "Reactivar su acceso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
