// =============================================================================
// origen-negocio — de qué landing vino un negocio, y que el onboarding vaya directo a lo que buscaba (23/10/2026)
// =============================================================================
// Pedido (el Cerebro, 23/10, con el chat «Landings de MaKo en Web Generator»): la landing guarda de dónde vino la persona
// (avatar y funcionalidad); el onboarding lo lee y va directo a lo que buscaba.
//
// EL CAMINO (acordado con «Landings» el 23/10): el origen de una cuenta vive en UN lugar, `cuenta.origen` (app_settings del
// negocio nuevo), que escribe el alta (lib/origen-cuenta.ts del chat de Landings): de los parámetros que la landing le pone al
// link de /planes (`cobros.origen`, mig 0330) o, sin ellos, de la primera visita del lead. Si todavía no está, se lee el del
// cobro. Al abrirse el onboarding, `sembrarArranqueDesdeOrigen` deja contestadas en el chat de arranque las dos preguntas que el origen ya
// contesta: «¿cómo nos conociste?» (un anuncio, una recomendación) y «¿qué querés que MaKo resuelva primero?» (la
// funcionalidad de la landing). El cierre del chat ya ofrece empezar por ahí (`salidaDelOnboarding`).
//
// ⚠️ NUNCA PISA LO QUE LA PERSONA CONTESTÓ: sólo escribe un campo del arranque que está vacío.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { origenLimpio, type OrigenCompra } from './compra-plan-reglas';
import type { InteresId } from './onboarding-arranque';

/**
 * La funcionalidad de la landing → lo que el chat de arranque llama «interés» (lib/onboarding-arranque.ts, INTERESES).
 * Por palabra, para no depender de la lista exacta de la landing: una que no se reconoce no contesta nada (se pregunta).
 */
export function interesDeFuncionalidad(f: string | null | undefined): InteresId | null {
  const s = (f ?? '').toLowerCase();
  if (!s) return null;
  if (/anuncio|ads|meta|pauta|campan|creativ|video|vsl|landing|contenido|avatar/.test(s)) return 'anuncios';
  if (/whatsapp|chatbot|bot|automati|respond/.test(s)) return 'whatsapp';
  if (/crm|venta|seguimiento|closing|cierre|lead|cobr/.test(s)) return 'ventas';
  if (/plan|equipo|tarea|organiz|proyecto|perro/.test(s)) return 'organizar';
  return null;
}

/** «¿Cómo nos conociste?» con lo que dice el origen: un anuncio (campaña o fbclid) o una recomendación (código de partner). */
export function origenDeLlegada(o: OrigenCompra | null, refCodigo: string | null): string | null {
  if (refCodigo) return 'Me lo recomendaron';
  if (o?.fbclid || o?.utm_source || o?.utm_campaign) return 'Un anuncio';
  return null;
}

/** La clave del contrato con «Landings» (23/10/2026): `{ v, landing, avatar, funcionalidad, utm: {...}, … }`. */
export const CLAVE_ORIGEN_CUENTA = 'cuenta.origen';

/** `cuenta.origen` en la forma de este módulo (los utm vienen anidados). null si no hay o no se pudo leer. */
function deCuentaOrigen(crudo: string | null): OrigenCompra | null {
  try {
    const v = crudo ? (JSON.parse(crudo) as Record<string, unknown>) : null;
    if (!v || typeof v !== 'object') return null;
    const utm = (v.utm && typeof v.utm === 'object' ? v.utm : {}) as Record<string, unknown>;
    return origenLimpio({ landing: v.landing, avatar: v.avatar, funcionalidad: v.funcionalidad, utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign, utm_content: utm.content });
  } catch { return null; }
}

/** El origen del negocio: `cuenta.origen` si ya está, o el del cobro que lo dio de alta. Y el código de partner del cobro. */
export async function origenDelNegocio(ws: number): Promise<{ origen: OrigenCompra | null; ref: string | null }> {
  const db = getSupabaseServer();
  const { data: w } = await db.from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_ORIGEN_CUENTA).maybeSingle();
  const propio = deCuentaOrigen((w as { value?: string } | null)?.value ?? null);
  const plataforma = await wsSuperAdmin();
  const { data: c, error } = await db.from('cobros').select('origen, ref_codigo').eq('workspace_id', plataforma).eq('alta_ws', ws)
    .eq('alta_estado', 'hecha').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) return { origen: propio, ref: null };
  const fila = c as { origen?: unknown; ref_codigo?: string | null } | null;
  const delCobro = origenLimpio(fila?.origen);
  return { origen: propio ?? delCobro, ref: fila?.ref_codigo ?? null };
}

/**
 * Deja contestado en el chat de arranque lo que el origen ya sabe. Idempotente y sin pisar: sólo campos vacíos. Nunca
 * tira (el onboarding se abre igual). Corre adentro del workspace del negocio.
 */
export async function sembrarArranqueDesdeOrigen(ws: number): Promise<void> {
  try {
    const { origen, ref } = await origenDelNegocio(ws);
    const interes = interesDeFuncionalidad(origen?.funcionalidad);
    const llegada = origenDeLlegada(origen, ref);
    if (!interes && !llegada) return;
    const { leerEstadoArranque, guardarEstadoArranque } = await import('./onboarding-arranque-server');
    await runWithWorkspace(ws, async () => {
      const e = await leerEstadoArranque();
      const patch: { interes?: InteresId; origen?: string } = {};
      if (interes && !e.interes) patch.interes = interes;
      if (llegada && !e.origen) patch.origen = llegada;
      if (Object.keys(patch).length) await guardarEstadoArranque(patch);
    });
  } catch (e) {
    console.warn(`[origen] no pude sembrar el arranque del negocio ${ws}:`, e instanceof Error ? e.message : String(e));
  }
}
