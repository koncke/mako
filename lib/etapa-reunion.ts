// =============================================================================
// «Es una reunión»: qué etapa del CRM puede serlo y qué cambia al marcarla
// =============================================================================
// Pedido de Martín (09/10/2026, punto 5 de su cuarta tanda sobre /automations, vía el chat de
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
//
// Desde el 12/10/2026 (punto 3 del feedback sobre el CRM) el botón «Reunión» es un DESPLEGABLE de
// tipo —Etapa / Reunión / Nutrición— y la subtab «Nutrición» del pop-up se fue: «las nutriciones
// deben tomarse como una etapa más... un desplegable para marcar "Reunión, Nutrición"». El tipo
// lo deciden `tipoDeEtapa` y `conTipo`, acá abajo; la op que lo guarda es `tipo`.
// =============================================================================

import { reunionesDe, slotPorIndice } from './funnel-etapas';
import { TERMINALES } from './pipeline';

type EtapaConTipo = { key: string; label?: string; kind?: string; marcadaComo?: string; band?: string };

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

/**
 * ¿Esta etapa lleva el desplegable de tipo (Etapa / Reunión / Nutrición)?
 *
 * Desde el 12/10/2026 (sexto feedback): «Revisa que Facturando y las etapas de nutrición no tienen el
 * desplegable... Todos deberían ser lo mismo, sin excepciones». Más ancha que `puedeSerReunion`: el
 * PAGO y un GRUPO también lo llevan (su tipo propio se conserva al pasar por Etapa o Nutrición, ver
 * `conTipo`). Quedan afuera sólo la entrada (por donde llega el lead), el cierre y las terminales,
 * que no se mueven de su lugar.
 */
export function puedeTenerTipo(e: EtapaConTipo): boolean {
  if ((TERMINALES as readonly string[]).includes(e.key)) return false;
  return e.kind !== 'entrada' && e.kind !== 'cierre';
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

/**
 * ¿El NOMBRE de esta etapa dice que es una reunión?
 *
 * Pedido de Martín (12/10/2026, punto 13): «sería bueno que detecte automático si es una etapa
 * de reunión con palabras clave, como "Reunión, R1, R2, agenda, llamada, etc..."». Sirve para
 * SUGERIR la marca al crear o renombrar una etapa, y para que una etapa vieja que se llama
 * «Agenda R1» cuente como reunión aunque nadie la haya marcado.
 *
 * Los límites van por Unicode (`(?<!\p{L})`) y no con `\b`, que en JavaScript es ASCII: hoy
 * ninguna palabra de la lista termina en vocal acentuada, pero la próxima que se sume puede.
 * ⚠️ Y LO QUE HABLA DE UNA REUNIÓN QUE NO PASÓ NO ES UNA: «No-show», «No asistió», «Post agenda»
 * nombran lo que viene DESPUÉS de una reunión, y marcarlas movería dónde se guarda la fecha.
 * Igual la llamada que no pasó (revisión del 12/10/2026): «No contestó la llamada», «Llamada
 * perdida», «Reagendar llamada», «Sin respuesta» dicen «llamada» y se marcaban solas — después de la
 * R1 eran la R2, con sus requisitos (Facturando pasaba de pedir nada a pedir fecha y asistencia de
 * la R2) y sus nutriciones de no-show.
 */
const PALABRAS_REUNION = /(?<!\p{L})(reuni[oó]n(es)?|r[1-9]|agenda(da|do|r)?|llamada|call|sesi[oó]n|meet(ing)?|zoom|junta|entrevista|demo|cita)(?!\p{L})/iu;
const NO_ES_REUNION = /(?<!\p{L})(no[\s-]?show|no\s+asisti[oó]|no\s+vino|no\s+(contest|atend|respond)|perdid[ao]|sin\s+respuesta|re-?agend|volver\s+a|post|despu[eé]s|cancel)/iu;

export function pareceReunion(label: string | null | undefined): boolean {
  const t = (label ?? '').trim();
  if (!t) return false;
  return PALABRAS_REUNION.test(t) && !NO_ES_REUNION.test(t);
}

/**
 * ¿Este funnel tiene alguna etapa de reunión? Marcada (`kind: 'reunion'`) o, si nadie la marcó,
 * con un nombre que lo dice (`pareceReunion`) — siempre que pueda serlo (`puedeSerReunion`).
 * Es lo que decide si la ficha del lead dibuja la pestaña «Reuniones» (punto 13).
 *
 * ⚠️ «SI NADIE LA MARCÓ» ES LITERAL (12/10/2026): una etapa a la que la persona le eligió un tipo
 * en el desplegable (`marcadaComo`: «Etapa» o «Nutrición») ya no cuenta por el nombre. Sin esto,
 * «Llamada de nutrición» marcada como Nutrición seguía abriendo la pestaña de reuniones, que es
 * contradecir en la ficha lo que la persona acaba de decir en el editor.
 *
 * ⚠️ Y POR EL NOMBRE CUENTAN SÓLO LAS DEL RECORRIDO (banda `pipeline`, o sin banda). Las etapas
 * GENERADAS de nutrición no traen `kind`, así que `puedeSerReunion` las deja pasar, y una se llama
 * «Reunión excepcional» (la que `generateFunnel` agrega a todo embudo con una etapa de pago): sin
 * este corte, pasarle `cfg.stages` abría la pestaña en un embudo sin una sola reunión.
 */
export function tieneEtapaDeReunion(etapas: readonly EtapaConTipo[] | null | undefined): boolean {
  return (etapas ?? []).some((e) => e.kind === 'reunion'
    || ((e.band == null || e.band === 'pipeline') && puedeSerReunion(e) && !e.marcadaComo && pareceReunion(e.label)));
}

// ── El TIPO de una etapa: Etapa / Reunión / Nutrición (punto 3 del feedback del 12/10/2026) ──

export type TipoEtapa = 'etapa' | 'reunion' | 'nutricion';

/** Los tres tipos, en el orden del desplegable. */
export const TIPOS_ETAPA: readonly TipoEtapa[] = ['etapa', 'reunion', 'nutricion'];

/** El tipo que se lee en el desplegable. Reunión es `kind: 'reunion'`; Nutrición, la marca aparte. */
export function tipoDeEtapa(e: EtapaConTipo): TipoEtapa {
  if (e.kind === 'reunion') return 'reunion';
  return e.marcadaComo === 'nutricion' ? 'nutricion' : 'etapa';
}

/**
 * La etapa con el tipo `tipo` puesto. Quien llama ya comprobó `puedeSerReunion` (la action, del
 * lado del server): la entrada, el pago, el cierre y las terminales no tienen tipo.
 *
 *   · Reunión  → `kind: 'reunion'` y sin marca (la marca es para lo que NO es reunión).
 *   · Etapa    → `kind: 'paso'` y `marcadaComo: 'etapa'`: dicho a mano, el nombre deja de contar.
 *   · Nutrición → `kind: 'paso'` y `marcadaComo: 'nutricion'`. Para todo lo que lee `kind`
 *     (transiciones, reuniones, requisitos, automatizaciones) es un paso, igual que antes.
 *
 * ⚠️ SALIR DE REUNIÓN ES `tipoAlMarcar(false)`, el mismo `'paso'` de siempre: nunca `undefined`.
 */
export function conTipo<T extends EtapaConTipo>(e: T, tipo: TipoEtapa): T {
  const sinMarca: EtapaConTipo = { ...e };
  delete sinMarca.marcadaComo;
  // ⚠️ EL PAGO Y EL GRUPO CONSERVAN SU TIPO al pasar por Etapa o Nutrición (12/10/2026: Facturando
  // también lleva el desplegable). Un arrastre de «Facturando» a la banda Nutrición y de vuelta no
  // puede dejarla como un paso cualquiera: perdería «No paga aún» y lo que pide al mover un lead.
  // Sólo «Reunión» se lo cambia, porque es lo que se eligió.
  const propio = e.kind === 'pago' || e.kind === 'grupo' ? e.kind : tipoAlMarcar(false);
  const out: EtapaConTipo = tipo === 'reunion'
    ? { ...sinMarca, kind: tipoAlMarcar(true) }
    : { ...sinMarca, kind: propio, marcadaComo: tipo };
  return out as T;
}

/**
 * ¿Al CREAR o RENOMBRAR la etapa `key` (que ya lleva su nombre nuevo en `etapas`), queda marcada
 * como Reunión sola? Punto 13 del feedback del 12/10/2026: «que detecte automático si es una etapa
 * de reunión con palabras clave».
 *
 * Sólo si TODO esto se cumple:
 *   · puede ser reunión (`puedeSerReunion`) y todavía no lo es;
 *   · nadie le eligió un tipo a mano (`marcadaComo`): lo que la persona dijo le gana al nombre;
 *   · el nombre lo dice (`pareceReunion`);
 *   · y marcarla NO corre de número otra reunión (`cambioDeReuniones` sin corridas). Las fechas de
 *     reunión de los leads van por ORDEN: marcar sola una etapa que va antes de la R1 mudaría las
 *     fechas ya cargadas a otra etapa sin que nadie lo decida. Ahí no se marca, y se elige a mano
 *     (el desplegable pregunta);
 *   · y, al RENOMBRAR, el nombre de antes (`labelAnterior`) NO lo decía. Lo que marca solo es que el
 *     nombre PASE a decir reunión. ⚠️ Revisión del 12/10/2026: la op vieja `reunion` con `es: false`
 *     (09/10 al 12/10) dejaba la etapa desmarcada como `kind: 'paso'` SIN `marcadaComo`. Renombrar
 *     «Agenda R2» a «Agenda R2 (no usamos)» la volvía a marcar: revertía en silencio una decisión
 *     explícita, con su lugar de fechas, sus requisitos y su nutrición de no-show.
 */
export function reunionPorNombre(etapas: readonly EtapaConTipo[], key: string, labelAnterior?: string | null): boolean {
  const e = etapas.find((x) => x.key === key);
  if (!e || e.kind === 'reunion' || e.marcadaComo || !puedeSerReunion(e)) return false;
  if (!pareceReunion(e.label)) return false;
  if (labelAnterior != null && pareceReunion(labelAnterior)) return false;
  return cambioDeReuniones(etapas, key, true).corridas.length === 0;
}
