// =============================================================================
// La suscripción MANUAL: lo puro de cancelarla y reactivarla (14/10/2026)
// =============================================================================
// La escritura vive en `cambiarEstadoSuscripcionManual` (lib/pagos.ts) y la reversión desde el historial en
// app/crm/actions.ts; acá sólo las reglas, para que un test las fije sin la base.
//
// ⚠️ CANCELAR PISA EL PLAZO. Para que el MRR deje de contarla, cancelar escribe en `suscripcion_meses` los meses
// transcurridos (como la de la pasarela). El plazo de ANTES queda en `suscripcion_meses_antes` y vuelve al
// reactivar. Mientras esté cancelada, el plazo no se toca desde el historial: ver `plazoSeRevierte`.

/** Un plazo válido: un entero de 1 a 120 meses (el tope de la API, crm.def.ts). Lo demás es «sin plazo». */
function plazoValido(v: unknown): number | null {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
}

/**
 * El plazo con que vuelve una suscripción al reactivarla: el que vino (el Deshacer de la pantalla manda el que
 * había) o, si no vino, el que se guardó al cancelar. Sin ninguno, null: mes a mes.
 *
 * ⚠️ «NO VINO» NO ES «MES A MES». La API reactiva sin plazo (`mesesAlReactivar: null`) y antes eso se escribía tal
 * cual: una suscripción de 12 meses volvía indefinida y el MRR la contaba para siempre (revisión del 14/10/2026).
 */
export function plazoAlReactivar(vino: unknown, guardado: unknown): number | null {
  return plazoValido(vino) ?? plazoValido(guardado);
}

/**
 * ¿Se puede revertir desde el historial la línea «Plazo de la suscripción»? No mientras esté cancelada.
 *
 * ⚠️ REVERTIR EL PLAZO DE UNA CANCELADA LA DEJABA A MEDIAS (revisión del 14/10/2026): «Plazo 12 → 3» (lo que escribe
 * cancelar) volvía a 12 pero `suscripcion_cancelada_at` seguía puesta: la ficha decía «Cancelada» y el MRR la volvía
 * a contar. Una cancelada se REACTIVA (Pagos o la API), que devuelve el plazo y borra la fecha juntos.
 */
export function plazoSeRevierte(suscripcionCanceladaAt: unknown): boolean {
  return suscripcionCanceladaAt == null || suscripcionCanceladaAt === '';
}

/** Lo que dice la ficha cuando no deja revertir el plazo. */
export const PLAZO_DE_CANCELADA = 'La suscripción está cancelada: reactívala desde Pagos y el plazo vuelve solo.';
