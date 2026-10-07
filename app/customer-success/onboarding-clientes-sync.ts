import 'server-only';

// =============================================================================
// onboarding-clientes-sync — escribe en `onboarding.tab.customer-success` lo que los datos ya dicen
// =============================================================================
// La regla (qué dato cierra qué paso) está en ./onboarding-clientes.ts y es pura. Acá está lo único
// que toca la base: anotar los pasos. Lo anotado es lo que lee MaKo (`resumenOnboardingTabs`,
// lib/tab-onboarding-state.ts) y la pantalla final del onboarding global (`tabsPorConfigurar`):
// por eso se ESCRIBE y no sólo se calcula al dibujar. Molde: ./curso/onboarding-sync.ts.
//
// ⚠️ NADA DE ACÁ MANDA NADA NI MUEVE CLIENTES. Sólo escribe `app_settings` por `marcarPasoTab`, y
// sólo cuando el dato dice otra cosa que lo anotado: una carga sin cambios son dos lecturas.

import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { TAB_CLIENTES, cambiosDeOnboarding, pasosParaDibujar, type HechosClientes, type OnboardingClientes } from './onboarding-clientes';

type Steps = Record<string, { done: boolean; at?: string }>;

/**
 * Deja el estado guardado igual a lo que dicen los datos y devuelve los pasos PARA DIBUJAR.
 * Best-effort: si `app_settings` falla devuelve `null` y la página se dibuja igual, sin lista —
 * anotar un paso es accesorio a mostrar la cartera.
 *
 * ⚠️ UN PASO QUE TODAVÍA NO SE PUEDE MARCAR SE SALTEA, no corta los demás: `marcarPasoTab` tira si
 * falta uno obligatorio anterior (clientes sin ningún servicio cargado), y eso se resuelve solo en
 * la carga en que el anterior se cumpla.
 *
 * ⚠️ Y LO QUE SE DEVUELVE NO ES LO ANOTADO (07/10/2026): es lo anotado MÁS lo que el dato leído ya
 * dice (`pasosParaDibujar`). Con lo anotado a secas, un workspace con 14 clientes y ningún servicio
 * veía «Carga uno» arriba de su cartera, porque el paso salteado de arriba quedaba en `false`. Lo
 * anotado —lo que lee MaKo— sigue respetando el orden.
 */
export async function sincronizarOnboardingClientes(h: HechosClientes): Promise<OnboardingClientes | null> {
  let steps: Steps;
  try { steps = (await getEstadoTab(TAB_CLIENTES)).steps; } catch { return null; }
  for (const c of cambiosDeOnboarding(steps, h)) {
    try { steps = (await marcarPasoTab(TAB_CLIENTES, c.paso, c.done)).steps; } catch { /* ver arriba */ }
  }
  return pasosParaDibujar(steps, h);
}

/**
 * El ensayo: alguien abrió la ficha de un cliente. Los demás hechos van en `null` («no los sé
 * desde acá»), así que esto sólo puede MARCAR la ficha — nunca desmarcar lo que la página anotó.
 *
 * Devuelve lo que se DIBUJA, así que `cs_ficha` vuelve `true` aunque el orden no haya dejado
 * anotarlo (sin servicio todavía): la persona acaba de abrir una ficha, y la lista no se lo vuelve
 * a pedir en esta sesión. En la carga siguiente se anota, si el paso anterior ya se cumplió.
 */
export async function anotarFichaAbierta(): Promise<OnboardingClientes | null> {
  return sincronizarOnboardingClientes({ servicios: null, clientes: null, movidos: null, fichaAbierta: true });
}
