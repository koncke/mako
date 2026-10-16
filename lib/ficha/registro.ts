// =============================================================================
// ficha/registro — lo que comparten el server y la pantalla sobre quién mira y cómo se titula un bloque
// =============================================================================
// La ficha del lead tiene UN armador para las dos puertas (el pop-up del tablero y /crm/[id]), que hasta
// el 14/10/2026 repetían el armado a mano (docs/diseno-ficha-bloques.md §3, «Para implementar»). El
// armador vive en app/crm/lead-view/ficha/ y el contrato de un bloque (sus props, sus reglas y su
// registro) en app/crm/lead-view/ficha/tipos.ts.
//
// ⚠️ CAMBIÓ EN LA SEGUNDA ETAPA (14/10/2026): la primera dejó acá un «cargador» por bloque del lado del
//    server, que el armador llamaba antes de dibujar. Se reemplazó: lo que un bloque necesita y no viene
//    en `LeadFullData` lo pide el bloque con SU server action al montarse (sólo si está puesto), así
//    ningún frente de la tanda B2 toca `getLeadFullAction` ni el armador. Y «¿se dibuja?» lo dice cada
//    registro (`estaVacio`), no un `datos != null` genérico.
//
// Puro, sin `server-only` ni `'use client'`: lo importan los dos lados y los tests.
// =============================================================================

import { reunionesDe } from '../funnel-etapas';

/** Quién mira, en lo que le importa a un bloque (decisión 5: el coaching lo ven el admin y el closer del lead). */
export type RolFicha = 'admin' | 'closer' | 'setter' | 'otro';

/** El rol del workspace (`getRolWsEfectivo`) llevado a lo que le importa a la ficha. */
export function rolDeFicha(rol: string | null | undefined): RolFicha {
  return rol === 'admin' || rol === 'closer' || rol === 'setter' ? rol : 'otro';
}

const norma = (s: string | null | undefined): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * ¿Quien mira es el closer de ESTE lead? `leads.closer` es texto libre: el nombre que se eligió del
 * equipo (`PersonaEditable`) o uno escrito a mano. Vale el nombre o el email de la sesión, sin
 * mayúsculas ni tildes. Un closer vacío no es de nadie.
 */
export function esElCloserDelLead(closer: string | null | undefined, yo: { nombre?: string | null; email?: string | null } | null | undefined): boolean {
  const c = norma(closer);
  if (!c || !yo) return false;
  return c === norma(yo.nombre) || c === norma(yo.email);
}

/** ¿Ve lo privado (el coaching de la llamada)? El admin siempre; el closer, sólo en SUS leads. */
export function vePrivado(rol: RolFicha, closerDelLead: string | null | undefined, yo: { nombre?: string | null; email?: string | null } | null | undefined): boolean {
  return rol === 'admin' || (rol === 'closer' && esElCloserDelLead(closerDelLead, yo));
}

/**
 * El título que se DIBUJA. En Reuniones «cada bloque toma su título del nombre de la etapa y nunca dice
 * "Reunión 1"» (§3): `reunion-1` es la primera etapa de reunión del funnel (la que guarda su fecha en el
 * primer lugar, `slotPorIndice`) y `reunion-2` la segunda. Sin esa etapa, el título del catálogo.
 */
export function tituloDeBloque(def: { id: string; titulo: string }, etapas: ReadonlyArray<{ key: string; label?: string; kind?: string }> | null | undefined): string {
  const i = def.id === 'reunion-1' ? 0 : def.id === 'reunion-2' ? 1 : -1;
  if (i < 0 || !etapas?.length) return def.titulo;
  const key = reunionesDe(etapas)[i];
  return etapas.find((e) => e.key === key)?.label?.trim() || def.titulo;
}
