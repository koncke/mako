'use server';

// =============================================================================
// Las actions del onboarding de Competitor Spy (/competitor-spy)
// =============================================================================
// Molde: `app/ads-writer/onboarding-actions.ts`. El estado vive en `app_settings` vía
// lib/tab-onboarding-state.ts, con keys `spy_*` para no colisionar con los pasos compartidos de
// otras tabs (el gotcha de KEY_PASOS_COMPARTIDOS, documentado varias veces en el catálogo).
//
// La key de la tab es `market-an`, no `competitor-spy`: es la del nav y está escrita en la base.
//
// A diferencia del Copy Generator, acá el onboarding SÍ guarda datos: el primer competidor y sus
// canales son el contenido de la tab, no una configuración aparte. Por eso estas actions llaman a
// lib/spy.ts y no sólo anotan el paso.

import { agregarCompetidor, leerCompetidor, listarCompetidores, mirarCompetidor, type LecturaCanalSpy } from '@/lib/spy';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';

/**
 * El mismo piso que el resto de la tab: admin del workspace.
 *
 * ⚠️ Escrito acá y no importado de otro `use server`: exportar un guard desde un archivo
 * 'use server' lo convierte en una server action llamable desde el navegador, o sea publicar el
 * chequeo de permisos como endpoint. Es la misma nota que ya está en los gemelos del Copy
 * Generator y del Video Generator.
 */
async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede configurar esta tab.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo.' };
  return { ok: true, ws };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const TAB = 'market-an';

export type PasoSpy = 'spy_primero' | 'spy_canales' | 'spy_lectura' | 'spy_conectar';

/**
 * Marca un paso como hecho.
 *
 * Idempotente: se relee el estado antes de escribir, así volver atrás y avanzar otra vez no
 * reescribe la fecha del paso. El ORDEN lo hace valer `marcarPasoTab` contra el catálogo, en el
 * SERVER: no se puede cerrar el último paso sin haber pasado por los anteriores.
 */
export async function marcarPasoSpyAction(paso: PasoSpy): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const tab = await getEstadoTab(TAB);
    if (!tab.steps[paso]?.done) await marcarPasoTab(TAB, paso);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * El primer paso: UN campo. Se pega un @ de Instagram, el enlace de un canal de YouTube o el de un
 * sitio, y el código resuelve qué es. Nunca un formulario con cuatro campos vacíos: es la regla de
 * baja fricción de la skill `tab-onboarding` y el mismo patrón del link pegado del Web Generator.
 */
export async function sumarCompetidorAction(
  pegado: string,
  nombre?: string,
): Promise<{ ok: true; id: number; nombre: string; canales: string[] } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const r = await agregarCompetidor(pegado, nombre);
    if (!r.ok) return r;
    const c = r.competidor;
    return {
      ok: true, id: c.id, nombre: c.nombre,
      canales: [c.instagram ? 'instagram' : '', c.youtube_id ? 'youtube' : '', c.landing_url ? 'landing' : ''].filter(Boolean),
    };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Qué canales tiene cargado un competidor: lo lee el paso «Dónde mirarlo» para saber qué falta. */
export async function canalesDeCompetidorAction(
  id: number,
): Promise<{ ok: true; canales: string[] } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const c = await leerCompetidor(id);
    if (!c) return { ok: false, error: 'No encontré a ese competidor.' };
    return { ok: true, canales: [c.instagram ? 'instagram' : '', c.youtube_id ? 'youtube' : '', c.landing_url ? 'landing' : ''].filter(Boolean) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Agrega otro canal al competidor que ya está: se pega y listo, el mismo campo único. */
export async function sumarCanalAction(
  id: number,
  pegado: string,
): Promise<{ ok: true; canales: string[] } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const c = await leerCompetidor(id);
    if (!c) return { ok: false, error: 'No encontré a ese competidor.' };
    // Se reusa `agregarCompetidor` con el nombre que ya tiene: el upsert por
    // (workspace_id, nombre) le suma el canal a la MISMA fila en vez de crear otra.
    const r = await agregarCompetidor(pegado, c.nombre);
    if (!r.ok) return r;
    const d = r.competidor;
    return { ok: true, canales: [d.instagram ? 'instagram' : '', d.youtube_id ? 'youtube' : '', d.landing_url ? 'landing' : ''].filter(Boolean) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * El ensayo: LA PRIMERA LECTURA DE VERDAD.
 *
 * No es un simulacro. En una tab de conversación el ensayo necesita que MaKo haga de cliente; acá
 * la prueba de que la tab quedó lista es mirar al competidor que la persona acaba de cargar y
 * mostrarle lo que salió — incluido lo que NO se pudo leer, que es la mitad honesta del resultado.
 */
export async function primeraLecturaAction(
  id: number,
): Promise<{ ok: boolean; canales: LecturaCanalSpy[] } | { ok: false; error: string; canales: [] }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return { ...ctx, canales: [] };
  try {
    const r = await mirarCompetidor(id);
    if (r.error) return { ok: false, error: r.error, canales: [] };
    return { ok: r.ok, canales: r.canales };
  } catch (e) {
    return { ok: false, error: msg(e), canales: [] };
  }
}

/** Los competidores que ya hay: el wizard retoma donde quedó en vez de pedir el primero otra vez. */
export async function competidoresAction(): Promise<{ ok: true; competidores: Array<{ id: number; nombre: string }> } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const r = await listarCompetidores();
    if (!r.ok) return r;
    return { ok: true, competidores: r.competidores.map((c) => ({ id: c.id, nombre: c.nombre })) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
