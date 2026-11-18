// =============================================================================
// Lo que se subió para un mensaje y nunca se usó: cuándo se borra. PURO (sin base ni `server-only`)
// =============================================================================
// F96, 18/11/2026. Dos carpetas guardan lo que una pantalla sube ANTES de usarlo, y lo borra al usarlo:
//   · `operaciones/<ref>` (bucket del chat): un adjunto de la caja del Ops Center. Se borra cuando su trabajo FIRMADO termina, se
//     cancela o vence (lib/operaciones-adjuntos.ts). Si la pestaña se cerró entre subir y firmar, nadie lo nombra y queda.
//   · `<ws>/chat-leer/<uuid>` (bucket archivero): lo que un chat de MaKo sube para LEER. `/api/chat/leer-archivo` lo borra al
//     leerlo; si la pestaña se cerró antes, queda (docs/hallazgos-second-brain.md: «no hay purga»).
// El barrido nocturno (/api/cron/limpieza-colgados) borra lo de más de un día que nadie usó. Lo prueba
// tests/api-mako-nucleo-1811.test.ts.
// ⚠️ UN DÍA, no dos horas: la URL de subida vale 2 horas, pero un trabajo firmado puede esperar en la cola con su chat cerrado
//    («el limbo») y su adjunto tiene que seguir ahí. Por eso un adjunto del Ops Center se borra SÓLO si ningún trabajo lo nombra,
//    no por la edad sola.
// =============================================================================

import { UUID_RE } from './operaciones-reglas';

/** Cuánto tiene que tener lo subido para que el barrido lo considere. */
export const SUBIDA_SIN_USAR_TRAS_MS = 24 * 60 * 60_000;

/** Los nombres (un uuid, como los arma quien sube) de los objetos de una carpeta con más de `edadMs`. */
export function viejosDeLaCarpeta(
  objetos: ReadonlyArray<{ name?: string | null; created_at?: string | null }>,
  ahora: number,
  edadMs = SUBIDA_SIN_USAR_TRAS_MS,
): string[] {
  return objetos.flatMap((o) => {
    const t = o.created_at ? Date.parse(o.created_at) : NaN;
    return o.name && UUID_RE.test(o.name) && Number.isFinite(t) && ahora - t > edadMs ? [o.name] : [];
  });
}

/** De los viejos, los que ningún trabajo firmado nombra (`nombrados`: los `ref` de los trabajos que los mencionan). */
export function sinTrabajoQueLosNombre(viejos: readonly string[], nombrados: Iterable<string>): string[] {
  const usados = new Set(nombrados);
  return viejos.filter((r) => !usados.has(r));
}
