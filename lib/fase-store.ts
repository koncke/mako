// =============================================================================
// fase-store — persistencia del diagnóstico de fase del negocio
// =============================================================================
// El diagnóstico (lib/fase-diagnostico.ts) es el "Norte" del cliente: en qué
// fase está y cuál es su cuello de botella. Se guarda por workspace en
// app_settings (patrón de mako.onboarding.answers) y alimenta el contexto de
// MaKo. Más adelante lo van a leer el Perro Guardián y la Retro.

import 'server-only';
import { getSetting, setSetting, getSettingEstricto, cambiarSettingSi } from './settings';
import { diagnosticar, faseContextoTexto, type CanalId, type Diagnostico } from './fase-diagnostico';

const FASE_KEY = 'negocio.fase.diagnostico';

/** El valor del setting, leído: el diagnóstico o null si no hay o no se entiende. Una sola regla. */
function parseFase(raw: string | null): Diagnostico | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Diagnostico;
    return p && typeof p === 'object' && Array.isArray(p.respuestas) ? p : null;
  } catch {
    return null;
  }
}

export async function getDiagnosticoFase(): Promise<Diagnostico | null> {
  return parseFase(await getSetting(FASE_KEY));
}

/** Guarda las respuestas crudas y el diagnóstico derivado (recomputado acá, no
 *  confiado del cliente). El canal de venta viaja junto al diagnóstico. Devuelve
 *  el diagnóstico. */
export async function setDiagnosticoFase(respuestas: number[], canal?: CanalId): Promise<Diagnostico> {
  const d = diagnosticar(respuestas, canal);
  await setSetting(FASE_KEY, JSON.stringify(d));
  return d;
}

/** Texto del Norte para inyectar en el contexto de MaKo (vacío si no hay diagnóstico). */
export async function faseNegocioTexto(): Promise<string> {
  return faseContextoTexto(await getDiagnosticoFase());
}

/**
 * Guarda el diagnóstico de fase del negocio **sólo si todavía no había uno**, y devuelve el que queda
 * vigente: el recién guardado, o el que ya estaba. `null` si no se pudo (la base no contesta).
 *
 * Existe porque hay DOS caminos que llegan al mismo dato: el onboarding, donde el dueño lo contesta a
 * propósito, y el chat de Offer, que lo deduce de la conversación. El segundo no puede pisar al primero.
 *
 * ⚠️ «Si no había uno» lo decide la BASE, no una lectura previa. `cambiarSettingSi(clave, null, …)` es un
 * insert-if-absent atómico. La primera versión releía con `getDiagnosticoFase` —que es TOLERANTE: un
 * error de Supabase devuelve null igual que «no hay»— y escribía con el upsert de `setDiagnosticoFase`,
 * que PISA: con la base intermitente se borraba el diagnóstico que el dueño acababa de rehacer en el
 * onboarding, y de dos pestañas guardando a la vez una perdía sin enterarse (revisión adversarial del
 * 11/10/2026). Por eso la relectura de acá es la ESTRICTA.
 *
 * ⚠️ El `canal` viaja adentro del diagnóstico y tiene que ser el del NEGOCIO. Quien llama decide cuál es:
 * el canal propio de un funnel secundario no es «dónde cierra la venta» de todo el negocio.
 *
 * Vivía en `app/api/offer/route.ts` con la clave del setting COPIADA, y un test tenía que vigilar que
 * las dos cadenas no se separaran. Una guarda que cuida una copia es la pista de que sobra la copia.
 */
export async function guardarFaseSiNoHay(d: Diagnostico): Promise<Diagnostico | null> {
  if (await cambiarSettingSi(FASE_KEY, null, JSON.stringify(d))) return d;
  const raw = await getSettingEstricto(FASE_KEY);
  const ya = parseFase(raw);
  if (ya) return ya;
  // La fila existe pero no trae un diagnóstico (vacía o ilegible): se reemplaza sólo si sigue así.
  if (raw != null && await cambiarSettingSi(FASE_KEY, raw, JSON.stringify(d))) return d;
  return null;
}
