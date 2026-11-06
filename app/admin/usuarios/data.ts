// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// =============================================================================
// Admin › Users — los datos de la tabla de Studio Admin, con las personas de MaKo (5/11/2026)
// =============================================================================
// Studio Admin (MIT), src/app/(main)/dashboard/users/_components/data.tsx: el tipo de la fila, los colores de cada estado
// y las opciones de los filtros. Lo de Studio era de muestra; acá cada campo sale de una fila de `usuarios`
// (`FilaUsuario`, lib/admin-usuarios-reglas.ts, que arma app/admin/page.tsx sin el perfil de la persona).
//
// LO QUE ES CADA COLUMNA DE STUDIO EN MaKo:
//   · Role / Team → el rol (`rolTxt`) y el TIPO de cuenta (Plataforma, Agencia, Cliente): MaKo no tiene equipos adentro de
//     un negocio, y lo que separa a una persona de otra es de qué lado está;
//   · Workspace → su negocio (una persona de MaKo es de un negocio, no de varios);
//   · Status → el estado de alta de MaKo (`estadoDeAlta`: activo, invitado, inactivo, suspendido) con los colores de Studio;
//   · Joined date → cuándo se creó su cuenta; la marca del avatar → cuándo entró por última vez (`lastActive` de Studio).

import { ROTULO_ESTADO_ALTA, estadoDeAlta, rolTxt, type EstadoAlta, type FilaUsuario } from "@/lib/admin-usuarios-reglas"

/** El tipo de cuenta (la columna «Team» de Studio). */
export const TIPOS_CUENTA = ["Plataforma", "Agencia", "Cliente"] as const
export type TipoCuenta = (typeof TIPOS_CUENTA)[number]

export type UserRow = FilaUsuario & { tipo: TipoCuenta }

export const TODOS = "Todos"

export const statusMeta: Record<EstadoAlta, { badgeClass: string; dotClass: string }> = {
  activo: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  invitado: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  inactivo: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  suspendido: {
    badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
}

/** Lo que dice el estado en la tabla, en el filtro y en el CSV: el mismo texto en los tres. */
export const estadoTxt = (u: Pick<FilaUsuario, "estado" | "ultimoLogin">, ahoraMs: number): string =>
  ROTULO_ESTADO_ALTA[estadoDeAlta(u, ahoraMs)].rotulo

/** El negocio de la persona, como lo nombra la columna Workspace. */
export const negocioTxt = (u: Pick<FilaUsuario, "negocio" | "rol">): string => u.negocio ?? (u.rol === "admin" ? "Plataforma" : "Sin negocio")

/** Las opciones de los cuatro filtros, de las personas que hay (nunca una lista escrita a mano). */
export function filtrosDe(filas: readonly UserRow[]) {
  const unicos = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "es"))
  return {
    role: [TODOS, ...unicos(filas.map((u) => rolTxt(u)))],
    team: [TODOS, ...TIPOS_CUENTA.filter((t) => filas.some((u) => u.tipo === t))],
    status: [TODOS, ...Object.values(ROTULO_ESTADO_ALTA).map((e) => e.rotulo)],
    workspace: [TODOS, ...unicos(filas.map((u) => negocioTxt(u)))],
  }
}

/** Minutos desde que entró por última vez (`lastActive` de Studio). Sin ingreso, infinito. */
export function minutosDesde(iso: string | null, ahoraMs: number): number {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? Math.max(0, (ahoraMs - t) / 60_000) : Number.POSITIVE_INFINITY
}

/** «24 jun 2024, 9:23», en la zona de la plataforma (la misma en el servidor y en el navegador: no cambia al hidratar). */
export function fechaHoraTxt(iso: string | null, tz: string): string {
  const t = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(t)) return "—"
  const partes = new Intl.DateTimeFormat("es", { timeZone: tz, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(new Date(t))
  const v = (k: string) => partes.find((p) => p.type === k)?.value ?? ""
  return `${v("day")} ${v("month").replace(".", "")} ${v("year")}, ${v("hour")}:${v("minute")}`
}
