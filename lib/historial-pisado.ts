// =============================================================================
// historial-pisado — ¿el «Deshacer» del historial va a pisar lo que cambió otra persona?
// =============================================================================
// Módulo PURO (lo ejecuta el test). Lo usan `revertMoveAction` y `revertAuditChangeAction`
// (app/crm/actions.ts) ANTES de escribir.
//
// Deshacer una línea del historial escribe su `valor_anterior`. Hasta el 17/10/2026 lo hacía a
// ciegas: si después de esa línea otra persona (o MaKo, o el plan de pagos, que escribe sin
// auditar) había cambiado el mismo dato, el deshacer le pisaba ese cambio sin avisar. Es la misma
// regla que ya tenía el «Deshacer» de un campo de la ficha (`deshacerCampoLeadAction`, YA_LO_CAMBIARON):
// se deshace sólo si el dato SIGUE diciendo lo que esa línea escribió (`valor_nuevo`).
//
// La ETAPA no se compara acá: la que se ve es DERIVADA (fechas, asistencias) y cambia sola con el
// tiempo, así que la comparación daría falsos «ya lo cambiaron». Para la etapa y el estado ya manda
// otra regla, la de sólo deshacer el ÚLTIMO cambio de estado (revertMoveAction, `STATUS`).
// =============================================================================

/** La línea de la etapa: su valor se calcula, no se guarda en una columna (lib/etapa-historial.ts). */
export const CAMPO_ETAPA_HISTORIAL = 'Etapa';

/**
 * Los campos de `filas` cuyo valor de HOY ya no es el que la línea escribió. `valorHoy(campo)` devuelve
 * el valor guardado con el MISMO formato del historial (`auditVal`, lib/leads.ts), o `undefined` si ese
 * campo no se puede comparar (no es una columna del historial). Sin repetidos, en el orden de las filas.
 */
export function camposPisados(
  filas: ReadonlyArray<{ campo: string; valor_nuevo: string | null }>,
  valorHoy: (campo: string) => string | null | undefined,
): string[] {
  const out: string[] = [];
  for (const f of filas) {
    if (f.campo === CAMPO_ETAPA_HISTORIAL || out.includes(f.campo)) continue;
    const hoy = valorHoy(f.campo);
    if (hoy === undefined) continue;
    if (hoy !== (f.valor_nuevo ?? null)) out.push(f.campo);
  }
  return out;
}

// =============================================================================
// El «Deshacer» del toast: QUÉ movimiento deshace y qué líneas son suyas (17/10/2026)
// =============================================================================
// Hasta el 17/10 el toast volvía a mover el lead y después borraba TODO el historial del lead de los
// últimos 90 segundos: también lo que había escrito otra persona en ese rato, y la línea «Monto de
// cierre 3000 → —» que dejaba el propio deshacer al vaciar la venta. Ahora deshace UN movimiento —su
// grupo de líneas, el que escribió `setPipelineStage` de una vez— por el mismo camino que «Restaurar»
// (`revertMoveAction`), y borra sólo eso y lo que el movimiento escribió atrás suyo (EVENTOS_DEL_MOVIMIENTO).

/** Eventos que un movimiento deja DESPUÉS de su grupo y que sólo hablan de él: lo que le falta en la etapa a la que
 *  llegó (`registrarPendientes`) y la frase de «¿Qué hacer ahora?» (`resolverQueHacerAction`). */
export const EVENTOS_DEL_MOVIMIENTO: readonly string[] = ['Datos pendientes', 'Datos sin marcar'];

/**
 * El movimiento que deshace el toast: la línea de la Etapa MÁS NUEVA que salió de `desde` dentro de la ventana
 * (`ventanaMs`, epoch ms; lo de antes no es de este toast). Devuelve su instante —el grupo que revierte
 * `revertMoveAction`— y los ids de los EVENTOS_DEL_MOVIMIENTO que el mismo autor escribió desde ese instante.
 * null = no hay movimiento que deshacer: el que llama no escribe nada (nunca mueve a ciegas).
 */
export function movimientoADeshacer(
  filas: ReadonlyArray<{ id: number; campo: string; valor_anterior: string | null; autor: string; created_at: string }>,
  desde: string,
  ventanaMs: number,
): { createdAt: string; eventos: number[] } | null {
  let linea: (typeof filas)[number] | null = null;
  for (const f of filas) {
    if (f.campo !== CAMPO_ETAPA_HISTORIAL || f.valor_anterior !== desde || !(Date.parse(f.created_at) >= ventanaMs)) continue;
    if (!linea || Date.parse(f.created_at) > Date.parse(linea.created_at)) linea = f;
  }
  if (!linea) return null;
  const { autor, created_at } = linea;
  const t = Date.parse(created_at);
  const eventos = filas
    .filter((f) => EVENTOS_DEL_MOVIMIENTO.includes(f.campo) && f.autor === autor && Date.parse(f.created_at) >= t)
    .map((f) => f.id);
  return { createdAt: created_at, eventos };
}
