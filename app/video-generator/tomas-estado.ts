// =============================================================================
// En qué anda una toma — la regla PURA (sin 'use client')
// =============================================================================
// Vivía adentro de PasoTomas.tsx, que es 'use client': un page.tsx no la podía llamar (un valor
// importado de un módulo cliente llega al server como una referencia de cliente, que tira al
// llamarla) y el teléfono (app/m/video) se llevaba el componente entero de escritorio a su
// bundle sólo por esta función. Se mudó aquí el 11/10/2026; PasoTomas la importa y la re-exporta,
// así que nada de escritorio cambió de lugar.
//
// ⚠️ lib/api-mako/areas/video.helpers.ts tiene OTRA versión (`EstadoTomaLeido`) con un estado más
// (`sin_poder_leer`, la marca `ciego`): no es una copia de ésta, es la lectura para la API.
// =============================================================================

import type { PlanGuardado } from './video-datos';

/** En qué anda una toma. El orden importa: se evalúa de arriba abajo. */
export type EstadoToma = 'filmada' | 'generando' | 'fallada' | 'sin-texto' | 'pendiente';

export function estadoDeToma(item: Pick<PlanGuardado, 'video' | 'plan'>, n: number): EstadoToma {
  const v = item.video?.[String(n)];
  if (v?.url) return 'filmada';
  if (v?.error) return 'fallada';
  if (v?.trabajoId || v?.operacion) return 'generando';
  // ⚠️ Antes que `pendiente`: una toma sin texto no se puede filmar, y decir
  // «pendiente» sobre algo que el botón va a rechazar es prometer un camino que
  // no existe. Pasa con los clips que se agregan a mano, que nacen vacíos.
  if (!(item.plan.clips.find((c) => c.n === n)?.voz ?? '').trim()) return 'sin-texto';
  return 'pendiente';
}
