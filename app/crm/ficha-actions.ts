'use server';

// =============================================================================
// ficha-actions — leer y cambiar la ficha del lead de UN funnel (la ficha por bloques)
// =============================================================================
// Pedido de Martín (14/10/2026, 03:06): «Todas las personalizables, no los hagas con un modal diferente...
// Que replique la edición que tenemos en "Dashboard" y "Landing Generator", que sea un constructor por
// bloques... con templates... y que ahí mismo se configure qué datos sin marcar notifica». El diseño es
// docs/diseno-ficha-bloques.md; el motor, lib/ficha/.
//
// ⚠️ SIN SESIÓN NO SE HACE NADA (tests/acciones-sin-sesion.test.ts): la ficha se abre desde el tablero y
//    sin cookie `getWorkspaceActual()` cae al ws1, que es un cliente. El funnel se lee con getTenantDb, así
//    que uno de otro workspace no existe acá.
// ⚠️ LEER es de cualquier rol del workspace (la ficha la ve todo el equipo); CAMBIAR es del admin: es la
//    ficha y los avisos de TODOS los leads del funnel.
// ⚠️ Un cambio es UN parche (CambioFicha, lib/ficha/config.ts) que se aplica sobre lo de hoy con
//    compare-and-set (lib/ficha/config-server.ts): dos admins que cambian cosas distintas no se pisan. La
//    respuesta trae `antes`, para «Deshacer» con `{ op: 'restaurar', ficha: antes }`.
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md): los tipos viven en lib/ficha.
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { TAG } from '@/lib/cache';
import { leerFichaDeFunnel, cambiarFichaDeFunnel, type FichaDelFunnel } from '@/lib/ficha/config-server';
import { sanearCambio, describirCambio, type FichaGuardada } from '@/lib/ficha/config';

async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}

const funnelValido = (x: unknown): x is number | null => x === null || (typeof x === 'number' && Number.isInteger(x) && x > 0);

/**
 * La ficha de un funnel: la plantilla y por qué, lo guardado, la ficha que se dibuja y si quien mira la
 * puede cambiar. `funnelId` null = el producto del negocio (la casa NULL de un lead).
 */
export async function leerFichaFunnelAction(funnelId: number | null): Promise<{ ok: true; ficha: FichaDelFunnel; puedeEditar: boolean } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    if (!funnelValido(funnelId)) return { ok: false, error: 'Funnel inválido.' };
    const [ficha, rol] = await Promise.all([leerFichaDeFunnel(funnelId), getRolWsEfectivo().catch(() => null)]);
    if (!ficha) return { ok: false, error: 'Ese funnel no es de esta cuenta.' };
    return { ok: true, ficha, puedeEditar: rol === 'admin' };
  } catch (e) {
    console.error('[ficha] leerFichaFunnelAction:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo leer la ficha.' };
  }
}

/**
 * Aplica UN cambio a la ficha de un funnel. Sólo el admin. `cambio: false` = ya estaba así. `antes` es lo
 * guardado justo antes, para deshacer.
 *
 * El historial: el funnel no tiene uno (no hay tabla de cambios de configuración), así que el cambio queda
 * en el log del server con su autor. Ver docs/diseno-ficha-bloques.md y los pendientes de la tanda.
 */
export async function cambiarFichaFunnelAction(funnelId: number | null, cambio: unknown): Promise<
  { ok: true; ficha: FichaDelFunnel; antes: FichaGuardada; cambio: boolean } | { ok: false; error: string }
> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador puede cambiar la ficha.' };
    if (!funnelValido(funnelId)) return { ok: false, error: 'Funnel inválido.' };
    const c = sanearCambio(cambio);
    if ('error' in c) return { ok: false, error: c.error };
    const r = await cambiarFichaDeFunnel(funnelId, c);
    if (!r.ok) return r;
    if (r.cambio) {
      const quien = (await getUsuarioActual().catch(() => null))?.email ?? 'CRM';
      console.info(`[ficha] funnel #${r.ficha.funnel.id}: ${describirCambio(c)} (${quien})`);
      // Los avisos de la ficha cambian lo que cuenta «Datos sin marcar» (worklist, «A revisar», el badge).
      try { updateTag(TAG.leads); } catch { /* la caché vence sola por su TTL */ }
      revalidatePath('/crm');
    }
    return r;
  } catch (e) {
    console.error('[ficha] cambiarFichaFunnelAction:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar la ficha.' };
  }
}
