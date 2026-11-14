'use server';

// =============================================================================
// Las piezas del Web Generator como fuente del lead entrante — las acciones del CRM y de Automations (14/11/2026)
// =============================================================================
// Martín, 14/11: «si se arma un formulario o piensa en otras cosas que se pueden armar en Web Generator, que se pueda asignar
// dentro del lead entrante. Eso es súper importante». La regla y el porqué: lib/editor-landing/piezas.ts; la base:
// lib/piezas-web.ts. Leer: cualquier sesión del negocio. Asignar: sólo su admin (como las campañas de Meta).
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md): los tipos viven en el núcleo.
// =============================================================================

import { getRolWsEfectivo } from '@/lib/workspace';
import { exigirSesion } from '@/lib/sesion-accion';
import { asignacionesDelNegocio, asignarPieza, landingsConPiezas, type LandingConPiezas } from '@/lib/piezas-web';
import { claveValida, type AsignacionesPiezas } from '@/lib/editor-landing/piezas';
import { productosAsignables } from '@/lib/landing-funnel';
import { idDelFunnelDefault } from '@/lib/funnels';

/**
 * Las landings publicadas con sus piezas, lo asignado y los CRM del negocio (con su nombre; `principal` = el id real del CRM
 * del negocio, que las pantallas nombran como null). null = no se pudo leer (no es «ninguna»).
 */
export async function piezasWebAction(): Promise<{ landings: LandingConPiezas[]; asignadas: AsignacionesPiezas; crms: Array<{ id: number; nombre: string }>; principal: number | null } | null> {
  await exigirSesion();
  try {
    const [landings, asignadas, crms, principal] = await Promise.all([
      landingsConPiezas(), asignacionesDelNegocio(), productosAsignables().catch(() => []), idDelFunnelDefault().catch(() => null),
    ]);
    return { landings, asignadas, crms: crms.map((c) => ({ id: c.id, nombre: c.nombre })), principal };
  } catch (e) {
    console.error('[piezas-web] no se pudieron leer las landings:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Prende o apaga un CRM para una pieza. Sólo el admin. */
export async function asignarPiezaAction(clave: string, funnelId: number, prendido: boolean): Promise<{ ok: true; asignadas: AsignacionesPiezas } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Sólo el administrador del negocio puede asignar.' };
  if (!claveValida(clave)) return { ok: false, error: 'Esa pieza no existe.' };
  if (!Number.isInteger(funnelId) || funnelId <= 0) return { ok: false, error: 'Ese CRM no existe.' };
  try {
    return { ok: true, asignadas: await asignarPieza(clave, funnelId, prendido === true) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar' };
  }
}
