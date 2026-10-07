import 'server-only';

// =============================================================================
// onboarding-sync — escribe en `onboarding.tab.cs-curso` lo que los datos ya dicen
// =============================================================================
// La regla (qué dato cierra qué paso) está en ./onboarding-curso.ts y es pura. Acá están las dos
// cosas que tocan la base: leer las señales del portal y anotar los pasos. Lo anotado es lo que
// lee MaKo (`resumenOnboardingTabs`, lib/tab-onboarding-state.ts) y la pantalla final del
// onboarding global (`tabsPorConfigurar`): por eso se ESCRIBE y no sólo se calcula al dibujar.
//
// ⚠️ NADA DE ACÁ MANDA NADA NI CREA ACCESOS. Sólo lee `curso_accesos` (contar, nunca upsert) y
// escribe `app_settings` por `marcarPasoTab`. Invitar a un cliente manda un email real por Resend
// y no depende de `envio_whatsapp_enabled`: eso lo dispara una persona desde Avance, nunca esto.

import { getTenantDb } from '@/lib/workspace';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { TAB_CURSO, cambiosDeOnboarding, type HechosCurso } from './onboarding-curso';

type Steps = Record<string, { done: boolean; at?: string }>;

/**
 * Cuántos clientes ya entraron a su portal y a cuántos se invitó. `null` = no se pudo leer (no
 * es cero: ver la cabecera de ./onboarding-curso.ts).
 */
export async function senalesDelPortal(): Promise<Pick<HechosCurso, 'entraron' | 'invitados'>> {
  try {
    const db = await getTenantDb();
    // ⚠️ `area is null`: se cuentan CLIENTES. Un líder de área (#665, mig 0212) tiene su propia
    // fila, y contado acá cada líder invitado sería un cliente más.
    const [e, i] = await Promise.all([
      db.from('curso_accesos').select('lead_id', { count: 'exact', head: true }).is('area', null).gt('ingresos', 0),
      db.from('curso_accesos').select('lead_id', { count: 'exact', head: true }).is('area', null).not('invitacion_enviada_at', 'is', null),
    ]);
    return {
      entraron: e.error || e.count == null ? null : e.count,
      invitados: i.error || i.count == null ? null : i.count,
    };
  } catch {
    return { entraron: null, invitados: null };
  }
}

/**
 * Deja el estado guardado igual a lo que dicen los datos y devuelve los pasos como quedaron.
 * Best-effort: si `app_settings` falla, devuelve lo que pudo leer (o `null`) y la página se
 * dibuja igual — anotar un paso es accesorio a mostrar el curso.
 *
 * ⚠️ UN PASO QUE TODAVÍA NO SE PUEDE MARCAR SE SALTEA, no corta los demás: `marcarPasoTab` tira
 * si falta uno obligatorio anterior (un cliente invitado en un curso que nadie miró todavía), y
 * eso se resuelve solo en la carga en que el anterior se cumpla.
 */
export async function sincronizarOnboardingCurso(h: HechosCurso): Promise<Steps | null> {
  let steps: Steps;
  try { steps = (await getEstadoTab(TAB_CURSO)).steps; } catch { return null; }
  for (const c of cambiosDeOnboarding(steps, h)) {
    try { steps = (await marcarPasoTab(TAB_CURSO, c.paso, c.done)).steps; } catch { /* ver arriba */ }
  }
  return steps;
}

/**
 * El ensayo: alguien del equipo abrió la vista del alumno. Antes se anota «Tu programa» si hay
 * clases (puede haber llegado directo, sin pasar por la tab), porque es el paso obligatorio que
 * va antes y sin él `marcarPasoTab` rechaza el ensayo.
 */
export async function anotarVistaAbierta(): Promise<Steps | null> {
  let clases: number | null = null;
  try {
    const { count, error } = await (await getTenantDb()).from('curso_clases').select('id', { count: 'exact', head: true });
    clases = error || count == null ? null : count;
  } catch { /* sin el conteo, el ensayo se intenta igual */ }
  return sincronizarOnboardingCurso({ clases, conVideo: null, entraron: null, invitados: null, vistaAbierta: true });
}
