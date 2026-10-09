// =============================================================================
// «Es una reunión»: qué etapa del CRM puede serlo y qué cambia al marcarla
// =============================================================================
// Pedido de Martín (09/10/2026, punto 5 de su cuarta tanda sobre /chatbot, vía el chat de
// Chatbot): «dentro del editor de etapas en el CRM, debería poder seleccionarse qué etapas
// hacen referencia a una REUNIÓN». El Chatbot deja de decir «R1» y «R2» y tiene UNA condición,
// «Asistió / No asistió a la reunión», sobre las etapas que el negocio marque.
//
// Una reunión es `kind: 'reunion'` en el pipeline, y es lo ÚNICO que la marca
// (`reunionesDe`, lib/funnel-etapas.ts). Hasta el 09/10 sólo lo ponía `generateFunnel` al
// armar un embudo de plantilla: un negocio que armó el suyo a mano no tenía cómo decirlo.
//
// Puro (sin `server-only`): lo usan el pop-up de etapas (app/crm/EtapasModal.tsx) y la action
// que guarda (`editarEtapaAction`, op `reunion`), y se prueba ejecutándolo.
// =============================================================================

import { reunionesDe, slotPorIndice } from './funnel-etapas';
import { TERMINALES } from './pipeline';

type EtapaConTipo = { key: string; label?: string; kind?: string };

/**
 * ¿Esta etapa se puede marcar (o desmarcar) como reunión?
 *
 * Sólo las de paso y las que ya son reunión. La de ENTRADA es por donde llega el lead, la de
 * PAGO y la de CIERRE son de la venta, y las cuatro terminales están en todos los embudos: si
 * cualquiera de ellas pasara a ser una reunión, el embudo perdería ese tipo, y al desmarcarla
 * volvería como un paso cualquiera, no como lo que era. Una de `grupo` tampoco, por lo mismo.
 */
export function puedeSerReunion(e: EtapaConTipo): boolean {
  if ((TERMINALES as readonly string[]).includes(e.key)) return false;
  return e.kind == null || e.kind === 'paso' || e.kind === 'reunion';
}

/** El tipo con el que queda la etapa: apagada vuelve a ser un paso, como una etapa nueva. */
export const tipoAlMarcar = (es: boolean): 'reunion' | 'paso' => (es ? 'reunion' : 'paso');

export type CambioDeReuniones = {
  /** Las reuniones que CAMBIAN de número (y por eso de lugar donde se guarda su fecha). */
  corridas: Array<{ key: string; label: string; de: number; a: number }>;
  /** Las que quedan de la tercera en adelante: no tienen dónde guardar fecha ni asistencia. */
  sinLugar: string[];
};

/**
 * Qué pasa con las reuniones si `key` pasa a ser (o deja de ser) una.
 *
 * ⚠️ EL LUGAR DE LA FECHA VA POR ORDEN, NO POR ETAPA. La tabla `leads` tiene dos pares de
 * columnas (`fecha_junta_1`/`junta_1_at` y `fecha_junta_2`/`junta_2_at`) y la primera reunión
 * del embudo usa el primero (`slotPorIndice`). Marcar una etapa que va ANTES de una reunión
 * existente la corre al segundo lugar: los leads que ya tenían su fecha en el primero la
 * mostrarían en la etapa nueva. Por eso la pantalla pregunta antes cuando `corridas` no está
 * vacío, y dice en una frase cuando una queda sin lugar.
 */
export function cambioDeReuniones(etapas: readonly EtapaConTipo[], key: string, es: boolean): CambioDeReuniones {
  const antes = reunionesDe(etapas);
  const despues = reunionesDe(etapas.map((e) => (e.key === key ? { ...e, kind: tipoAlMarcar(es) } : e)));
  const nombre = (k: string) => etapas.find((e) => e.key === k)?.label ?? k;
  const corridas = antes
    .filter((k) => despues.includes(k) && despues.indexOf(k) !== antes.indexOf(k))
    .map((k) => ({ key: k, label: nombre(k), de: antes.indexOf(k) + 1, a: despues.indexOf(k) + 1 }));
  const sinLugar = despues.filter((_, i) => slotPorIndice(i) == null);
  return { corridas, sinLugar };
}

/** ¿Esta reunión tiene dónde guardar fecha y asistencia? (las dos primeras sí). */
export function reunionSinLugar(etapas: readonly EtapaConTipo[], key: string): boolean {
  const i = reunionesDe(etapas).indexOf(key);
  return i >= 0 && slotPorIndice(i) == null;
}
