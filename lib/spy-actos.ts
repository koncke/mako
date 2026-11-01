// =============================================================================
// Los pasos del catálogo de Competitor Spy los marca EL ACTO, no una pantalla
// =============================================================================
// La tab se quedó sin wizard (Martín, 31/10/2026), pero `market-an` sigue en
// lib/tab-onboarding-catalogo.ts porque ese estado es lo que MaKo lee para no aconsejar sobre una tab
// sin usar. Lo que cambia es quién lo marca: agregar a alguien marca `spy_primero`, tener un canal
// marca `spy_canales`, y la primera lectura buena marca `spy_lectura`.
//
// ⚠️ `marcarPasoTab` VALIDA EL ORDEN EN EL SERVER y tira si se saltea un paso. Por eso se marcan en
// secuencia y se relee el estado, para que repetir el acto no reescriba la fecha del paso.
//
// ⚠️ NUNCA TIRA. Es una anotación al costado del acto: si la base hipa, el competidor igual se agregó,
// y hacerle ver un error a la persona por no poder anotar eso sería mentirle sobre lo que pasó.

import 'server-only';
import { getEstadoTab, marcarPasoTab } from './tab-onboarding-state';

const TAB = 'market-an';

export type PasoSpy = 'spy_primero' | 'spy_canales' | 'spy_lectura';

export async function marcarActosSpy(pasos: readonly PasoSpy[]): Promise<void> {
  try {
    const estado = await getEstadoTab(TAB);
    for (const paso of pasos) {
      if (!estado.steps[paso]?.done) await marcarPasoTab(TAB, paso);
    }
  } catch (e) {
    console.warn('[spy] no se pudo anotar el paso:', e instanceof Error ? e.message : String(e));
  }
}
