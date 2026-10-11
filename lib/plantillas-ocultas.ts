// =============================================================================
// plantillas-ocultas — «Eliminar» un Mensaje de MaKo = OCULTARLO de la lista de ESE negocio, y apagarlo
// =============================================================================
// Novena tanda (Martín, 10/10/2026), textual: «No aparecen los 3 puntos para eliminar una automatización de
// "MaKo en WhatsApp"... Las cosas de "MaKo en WhatsApp" deben ser EXACTAMENTE igual al resto, no tienen
// diferencia... Revisa eso.» Y del «Reporte semanal»: «yo lo elimino cuando agregues los tres puntos».
//
// QUÉ ES ELIMINAR UN MENSAJE. Una automatización no se borra: se ARCHIVA y se recupera
// (`archivarSecuencias`). Un mensaje de fábrica tampoco se puede borrar —es del catálogo, y lo leen los
// emisores por su id—, así que «Eliminar» lo saca de la lista de ESTE negocio y lo apaga, y se recupera
// desde «Nueva automatización» (app/automations/GaleriaPlantillas.tsx). Uno propio, lo mismo: por paridad
// con la automatización, que archiva, el «Eliminar» de /automations no destruye nada. El borrado de verdad
// (`borrarPlantilla`, lib/plantillas.ts) queda para el catálogo de la agencia en /mensajes.
//
// LA REGLA QUE ESTE MÓDULO SOSTIENE: OCULTO ⇒ APAGADO. Un mensaje que sale y no está en la lista es un mensaje
// que nadie puede encontrar para pausarlo. Por eso las tres escrituras viven acá, juntas:
//   · `ocultar` escribe las dos marcas en la MISMA escritura;
//   · `restaurar` saca la marca y lo prende (decidido así: recuperarlo es volver a quererlo);
//   · `conInterruptor` (el «Activar» de siempre): PRENDER uno oculto lo restaura. Si no, en /mensajes (la
//     vista de la agencia, que sí lo lista con su marca) el interruptor de un oculto no haría nada.
// Y la lectura la cierra `estaPrendida` (lib/plantillas.ts): un oculto está apagado aunque una escritura
// vieja le haya dejado `enabled: true`.
//
// SIN `server-only`: lo ejecutan los tests (tests/plantillas-ocultas.test.ts). lib/plantillas.ts, que sí lo
// es, lo usa para escribir el store y para filtrar la lista. El tipo de la entrada viene de allá con
// `import type`, que se borra al compilar.
// =============================================================================

import type { EntradaStore } from './plantillas';

/**
 * El parámetro del GET que lista los ocultos (`?ocultos=1`). Desde el 11/10/2026 lo lee SÓLO la ruta de la
 * agencia (/mensajes, app/api/admin/plantillas/route.ts): «MaKo en WhatsApp» pasó a ser automatizaciones de la
 * tab Automations (docs/diseno-mako-en-whatsapp-unificado.md), y el negocio ya no oculta ni recupera mensajes.
 * Vivía en lib/chatbot-mensajes-mako.ts, que se borró con la lista vieja.
 */
export const PARAM_OCULTOS = 'ocultos';

/** ¿Este negocio lo eliminó de su lista? */
export const estaOculta = (e: Pick<EntradaStore, 'oculto'> | undefined): boolean => e?.oculto === true;

/** «Eliminar»: fuera de la lista Y apagado, en la misma escritura (la regla de la cabecera). */
export function ocultar(e: EntradaStore): EntradaStore {
  return { ...e, enabled: false, oculto: true };
}

/** «Recuperar»: vuelve a la lista, prendido. */
export function restaurar(e: EntradaStore): EntradaStore {
  const { oculto: _vuelveALaLista, ...resto } = e;
  return { ...resto, enabled: true };
}

/**
 * El interruptor de siempre (`setEnabledPlantilla`). Apagar no toca la marca; PRENDER uno oculto lo restaura,
 * porque «prendido y fuera de la lista» es justo el estado que la regla de la cabecera prohíbe.
 */
export function conInterruptor(e: EntradaStore, enabled: boolean): EntradaStore {
  return enabled ? restaurar(e) : { ...e, enabled: false };
}

/**
 * Qué parte de la lista contesta cada pedido:
 *   · la del NEGOCIO (`vista: 'cliente'`, /automations y Configuraciones) no lista lo que eliminó;
 *   · la de la AGENCIA (/mensajes, y `getPlantilla`, que usa el RUNTIME) lista todo, con la marca: un aviso
 *     que se está emitiendo tiene que encontrar su plantilla para saber que está apagado;
 *   · `soloOcultos` es lo que se recupera (el GET `?ocultos=1` de las dos rutas).
 */
export type QueOcultos = 'visibles' | 'ocultos' | 'todos';
export function queOcultos(vista: 'cliente' | 'agencia', soloOcultos: boolean): QueOcultos {
  if (soloOcultos) return 'ocultos';
  return vista === 'agencia' ? 'todos' : 'visibles';
}

/** La lista recortada según `queOcultos`. */
export function porOculto<T extends { oculto: boolean }>(vistas: readonly T[], que: QueOcultos): T[] {
  if (que === 'todos') return [...vistas];
  return vistas.filter((v) => (que === 'ocultos' ? v.oculto : !v.oculto));
}
