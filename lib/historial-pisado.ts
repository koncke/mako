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
