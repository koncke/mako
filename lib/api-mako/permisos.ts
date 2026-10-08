// =============================================================================
// api-mako/permisos — los permisos POR ÁREA de un token detallado, en puro
// =============================================================================
// Decisión de Martín (08/10/2026), copiando los «fine-grained personal access tokens» de
// GitHub: un token con nombre elige, área por área, «Sin acceso», «Solo lectura» o
// «Lectura y escritura». Antes había un nivel GLOBAL por token (lectura / proponer /
// ejecutar, en el prefijo); ése sigue existiendo, pero sólo para el token principal de la
// skill de Claude, que es el «clásico».
//
// Qué pide cada operación:
//   · una LECTURA pide «Solo lectura» (o más) en su área;
//   · una ACCIÓN o un CONTROL piden «Lectura y escritura» en su área. Con eso, un token
//     detallado ESCRIBE DIRECTO, como en GitHub (decisión del mismo día): no deja una
//     pendiente que confirme una persona. Lo que cuesta plata sigue dejando la propuesta
//     con link (eso lo decide la ruta, no este módulo).
//
// Ausente = sin acceso. Un área que el token no nombra no existe para él: 404, nunca 403
// (la regla de la casa y la de GitHub: no confirmar que algo existe).
//
// Los códigos que viajan por HTTP son los de GitHub (`read` / `write`), para que el header
// `X-Accepted-MaKo-Permissions` se lea igual que `X-Accepted-GitHub-Permissions`.
//
// SIN `server-only` y SIN importar valores (sólo tipos de tipos.ts): lo importa la pantalla
// que crea el token, y tests/api-mako-registro.test.ts lo admite como excepción por eso.
// =============================================================================

import type { Area, OperacionDef } from './tipos';

export type NivelPermiso = 'ninguno' | 'lectura' | 'escritura';

/** Lo que guarda un token detallado: sólo las áreas con acceso. */
export type Permisos = Partial<Record<Area, 'lectura' | 'escritura'>>;

export const NIVELES: readonly NivelPermiso[] = ['ninguno', 'lectura', 'escritura'];

/** Los rótulos de GitHub («No access», «Read-only», «Read and write»), en español neutro. */
export const TEXTO_NIVEL: Record<NivelPermiso, string> = {
  ninguno: 'Sin acceso',
  lectura: 'Solo lectura',
  escritura: 'Lectura y escritura',
};

/** El código que viaja por HTTP, como en GitHub. */
export const CODIGO_NIVEL: Record<'lectura' | 'escritura', 'read' | 'write'> = { lectura: 'read', escritura: 'write' };

const ORDEN: Record<NivelPermiso, number> = { ninguno: 0, lectura: 1, escritura: 2 };

/** Qué nivel pide una operación en su área. */
export const nivelRequerido = (d: Pick<OperacionDef, 'tipo'>): 'lectura' | 'escritura' =>
  d.tipo === 'lectura' ? 'lectura' : 'escritura';

/** El nivel que el token tiene en un área (ausente = sin acceso). */
export const nivelEn = (p: Permisos | null | undefined, area: Area): NivelPermiso => p?.[area] ?? 'ninguno';

/** ¿Estos permisos alcanzan para esta operación? */
export function permitePorArea(p: Permisos, d: Pick<OperacionDef, 'tipo' | 'area'>): boolean {
  return ORDEN[nivelEn(p, d.area)] >= ORDEN[nivelRequerido(d)];
}

/** `crm=read`: lo que el endpoint acepta, para `X-Accepted-MaKo-Permissions`. */
export const permisoAceptado = (d: Pick<OperacionDef, 'tipo' | 'area'>): string => `${d.area}=${CODIGO_NIVEL[nivelRequerido(d)]}`;

/**
 * Los permisos guardados, tolerantes: sólo áreas de la lista y niveles conocidos. Lo
 * desconocido se descarta —un nivel inventado no puede dar acceso—, y «ninguno» no se
 * guarda (ausente ya lo significa).
 */
export function sanearPermisos(raw: unknown, areas: readonly string[]): Permisos {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Permisos = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!areas.includes(k)) continue;
    if (v === 'lectura' || v === 'escritura') out[k as Area] = v;
  }
  return out;
}

/** Cuántas áreas tiene con acceso, y cuántas con escritura (para el resumen de la lista). */
export function contarPermisos(p: Permisos): { total: number; escritura: number } {
  const vals = Object.values(p);
  return { total: vals.length, escritura: vals.filter((v) => v === 'escritura').length };
}
