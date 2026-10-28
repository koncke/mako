'use server';

// =============================================================================
// En qué automatizaciones está un lead, y frenarlo — las acciones que usa el CRM (22/10/2026)
// =============================================================================
// Martín: «en el CRM debería indicar en la tarjeta o en algún lugar que esos leads están en una automatización activa, y que
// desde el CRM también se pueda frenar». La pantalla es del CRM; el núcleo, lib/automatizaciones-del-lead.ts. Leer: cualquier
// sesión del negocio. Frenar: sólo su admin (como `sacar_lead_de_secuencia` en la API de MaKo).
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md): el tipo vive en el núcleo.
// =============================================================================

import { requireSesion } from '@/lib/tab-access';
import { getUsuarioActual } from '@/lib/auth';
import { enAutomatizaciones, frenarEnAutomatizacion, frenarLeadsEnAutomatizaciones, empezarDeNuevoEnAutomatizacion, volverAProbarEnAutomatizacion, detalleDelLead, type EnAutomatizacion } from '@/lib/automatizaciones-del-lead';
import type { AutomatizacionesDelLead } from '@/lib/automatizaciones-del-lead-reglas';
import { textoDeFrenarLote } from '@/lib/automatizaciones-del-lead-reglas';

const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/** Las automatizaciones vivas de varios leads (un tablero). null = sin sesión o no se pudo leer (no es «ninguna»). */
export async function enAutomatizacionesAction(leadIds: number[]): Promise<Record<number, EnAutomatizacion[]> | null> {
  await requireSesion();
  if (!Array.isArray(leadIds)) return null;
  try {
    return Object.fromEntries(await enAutomatizaciones(leadIds.filter(idValido)));
  } catch {
    return null;
  }
}

/** Las de UN lead (la ficha). null = sin sesión o no se pudo leer. */
export async function automatizacionesDelLeadAction(leadId: number): Promise<EnAutomatizacion[] | null> {
  if (!idValido(leadId)) return null;
  const r = await enAutomatizacionesAction([leadId]);
  return r ? r[leadId] ?? [] : null;
}

/**
 * El bloque «Automatizaciones» de la ficha (23/10/2026): todo lo de sus automatizaciones (`detalleDelLead`). Cualquier sesión
 * del negocio, como leer. null = sin sesión o no se pudo leer (no es «ninguna»).
 */
export async function automatizacionesDelLeadDetalleAction(leadId: number): Promise<AutomatizacionesDelLead | null> {
  await requireSesion();
  if (!idValido(leadId)) return null;
  try {
    return await detalleDelLead(leadId);
  } catch (e) {
    console.error(`[automatizaciones-del-lead] el detalle del lead ${leadId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Saca al lead de UNA automatización: no le sale nada más. Sólo el admin del negocio. */
export async function frenarEnAutomatizacionAction(leadId: number, secuenciaId: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Sólo el administrador puede frenarlo.' };
  if (!idValido(leadId) || !idValido(secuenciaId)) return { ok: false, error: 'Falta el lead o la automatización.' };
  try {
    return await frenarEnAutomatizacion(leadId, secuenciaId);
  } catch (e) {
    return { ok: false, error: `No pude frenarlo: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * «Empezar de nuevo» UNA automatización del lead (23/10/2026): vuelve al primer paso. Sólo el admin del negocio, como frenar.
 * Firma el historial con el email de quien lo pidió (como el CRM, `autorActual`).
 */
export async function empezarDeNuevoEnAutomatizacionAction(leadId: number, secuenciaId: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Sólo el administrador puede hacerlo empezar de nuevo.' };
  if (!idValido(leadId) || !idValido(secuenciaId)) return { ok: false, error: 'Falta el lead o la automatización.' };
  try {
    const autor = (await getUsuarioActual().catch(() => null))?.email?.trim() || 'CRM';
    return await empezarDeNuevoEnAutomatizacion(leadId, secuenciaId, autor);
  } catch (e) {
    return { ok: false, error: `No pude hacerlo empezar de nuevo: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * «Volver a probar» UNA automatización que el lead ya terminó (28/10/2026, ticket #19): entra de nuevo con lo próximo que la
 * arranca, una vez. Sólo el admin del negocio, como frenar; firma el historial con quien lo pidió.
 */
export async function volverAProbarEnAutomatizacionAction(leadId: number, secuenciaId: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Sólo el administrador puede hacerlo volver a probar.' };
  if (!idValido(leadId) || !idValido(secuenciaId)) return { ok: false, error: 'Falta el lead o la automatización.' };
  try {
    const autor = (await getUsuarioActual().catch(() => null))?.email?.trim() || 'CRM';
    return await volverAProbarEnAutomatizacion(leadId, secuenciaId, autor);
  } catch (e) {
    return { ok: false, error: `No pude dejarlo para volver a probar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Frena a VARIOS leads de una (la barra de lote del CRM): de UNA automatización, o de todas sus automatizaciones vivas si no
 * se dice cuál. Sólo el admin del negocio. UNA escritura (lib/automatizaciones-del-lead.ts): no queda a medias.
 */
export async function frenarLeadsEnAutomatizacionesAction(leadIds: number[], secuenciaId?: number): Promise<{ ok: true; frenados: number; yaHabianSalido: number; resumen: string } | { ok: false; error: string }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Sólo el administrador puede frenarlos.' };
  if (!Array.isArray(leadIds) || !leadIds.some(idValido)) return { ok: false, error: 'No hay leads tildados.' };
  if (secuenciaId != null && !idValido(secuenciaId)) return { ok: false, error: 'Falta la automatización.' };
  try {
    const r = await frenarLeadsEnAutomatizaciones(leadIds.filter(idValido), secuenciaId ?? null);
    return { ok: true, frenados: r.frenados, yaHabianSalido: r.pedidos - r.frenados, resumen: textoDeFrenarLote(r) };
  } catch (e) {
    return { ok: false, error: `No pude frenarlos: ${e instanceof Error ? e.message : String(e)}` };
  }
}
