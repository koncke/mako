"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.

// =============================================================================
// Admin › Users — la vista de grilla
// =============================================================================
// En Studio Admin el selector lista / grilla de Users (src/app/(main)/dashboard/users/_components/users.tsx) se dibuja y
// no cambia nada. Martín lo pidió andando («vista lista o grilla»), y Studio no trae una grilla de personas: ésta se arma
// SÓLO con sus piezas (la `Card` de Studio y las mismas celdas de la tabla: el avatar con su marca, Rol / Tipo, Workspace,
// el estado y el «…»), sobre las MISMAS filas de la tabla (filtradas, ordenadas y paginadas), así los filtros, la
// selección y el pie valen igual en las dos vistas. Está en la lista «no está en la fuente» del relevo.

import type { ReactTable } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";

import { Card, CardAction, CardContent, CardHeader } from "@/app/admin/_studio/components/ui/card";
import { Checkbox } from "@/app/admin/_studio/components/ui/checkbox";
import type { DataTableFeatures } from "@/app/admin/_studio/lib/data-table-features";
import { rolTxt } from "@/lib/admin-usuarios-reglas";

import { fechaHoraTxt, minutosDesde, negocioTxt, type UserRow } from "./data";
import { AvatarCell, type ContextoColumnas, RoleCell, StatusBadge, UserActions, WorkspaceCell } from "./users-columns";

export function UsersGrid({ table, ctx }: { table: ReactTable<DataTableFeatures, UserRow>; ctx: ContextoColumnas }) {
  const rows = table.getRowModel().rows;

  if (!rows.length) {
    return <div className="text-muted-foreground flex h-24 items-center justify-center px-4 text-sm">Nadie con esos filtros.</div>;
  }

  return (
    <div className="grid gap-4 px-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {rows.map((row) => {
        const u = row.original;
        const nombre = u.nombre || u.email;
        return (
          <Card key={row.id} size="sm" data-state={table.state.rowSelection[row.id] && "selected"} className="data-[state=selected]:ring-ring">
            <CardHeader>
              <div className="flex min-w-0 items-center gap-3">
                <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
                  {(checked) => (
                    <Checkbox aria-label={`Elegir a ${nombre}`} checked={checked} onCheckedChange={(value) => row.toggleSelected(!!value)} />
                  )}
                </Subscribe>
                <AvatarCell name={nombre} foto={u.foto} lastActive={minutosDesde(u.ultimoLogin, ctx.ahoraMs)} />
                <div className="min-w-0">
                  <div className="text-foreground truncate text-sm font-medium">{nombre}</div>
                  <div className="text-muted-foreground truncate text-sm">{u.email}</div>
                </div>
              </div>
              <CardAction>
                <UserActions row={u} ctx={ctx} />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <RoleCell role={rolTxt(u)} team={u.tipo} />
                <WorkspaceCell workspaces={[negocioTxt(u)]} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <StatusBadge row={u} ahoraMs={ctx.ahoraMs} />
                <span className="text-muted-foreground text-xs">{fechaHoraTxt(u.creado, ctx.tz)}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
