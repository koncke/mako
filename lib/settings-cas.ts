// El compare-and-set de app_settings (`cambiarSettingSi`, lib/settings.ts) comparaba con `.eq('value', esperado)`, y PostgREST
// pone ese filtro en la URL del PATCH. Medido en producción el 12/10/2026: con 6 KB contesta 200; con 8 a 12 KB, «fetch
// failed»; con 16 a 32 KB, 400; con 64 KB, 414. Se lee como una caída de red y el valor deja de guardarse en silencio.
// ⚠️ 28/10/2026: con eso ya escrito en docs/hallazgos-infra.md y en lib/automatizacion-chat-db.ts, Copywriter volvió a caer
// (un guion de más de ~6 KB no se guardaba más), y medido ese día el historial del onboarding ya pasaba los 6 KB en cuatro
// negocios. La regla escrita no alcanzó: ahora `cambiarSettingSi` mismo, con un `esperado` largo, lee la fila, compara el
// valor en el server y escribe con la condición en `updated_at` (corta), uno estrictamente posterior al leído. Así sirve
// para todos los que lo llaman, sin que cada uno lo sepa. Puro: sin server-only, para probarlo sin base.

/** Lo máximo que `esperado`, ya codificado para la URL, viaja seguro en el filtro (el medido que dio 200). */
export const CAS_ESPERADO_MAX = 6 * 1024;

/** El largo con el que `esperado` sale en la URL (las comillas, llaves y acentos de un JSON se codifican). */
export const largoEnLaUrl = (esperado: string): number => encodeURIComponent(esperado).length;

/** ¿El valor esperado se puede comparar en la URL? (null siempre: es el upsert sin filtro). */
export const cabeEnLaUrl = (esperado: string | null): boolean => esperado === null || largoEnLaUrl(esperado) <= CAS_ESPERADO_MAX;

/**
 * La marca de tiempo que escribe el compare-and-set por fecha: la de ahora, o 1 ms después de la leída si el reloj no
 * avanzó (dos escritores que leyeron lo mismo no pueden ganar los dos). Igual que lib/automatizacion-chat-db.ts.
 */
export function despuesDe(leido: string | null, ahora = Date.now()): string {
  const antes = leido ? Date.parse(leido) : Number.NaN;
  return new Date(Number.isNaN(antes) ? ahora : Math.max(ahora, antes + 1)).toISOString();
}
