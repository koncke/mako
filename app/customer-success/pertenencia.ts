// =============================================================================
// pertenencia — de qué productos es cada cliente (puro)
// =============================================================================
// Sin 'use client' ni 'server-only' a propósito: la CASA la calcula el server
// (./entrega.ts) y la pertenencia la pregunta el navegador sobre lo movido en la sesión.
// Y lo ejecuta un test (tests/cs-pertenencia.test.ts).
//
// Pedido de Martín (06/10/2026), al preguntarle si un cliente vive en un solo producto:
// «Un cliente puede estar en varios productos, lo mismo que el CRM… Pero en el producto de
// PRUEBA debería estar vacío, elimina a los clientes de allí».
//
// ⚠️ HASTA ACÁ CADA KANBAN DIBUJABA A LA CARTERA ENTERA. La regla «un cliente sin fila está
// en la primera etapa» (`repartirEnEtapas`) no preguntaba DE QUÉ producto era: los 14
// clientes de Negocio que Escala aparecían también en «Prueba», en Bienvenida, sin que
// nadie los hubiera puesto ahí. Ahora un cliente es de un producto por DOS caminos, y
// ninguno se deduce del otro:
//
//   1. su CASA: el producto de su embudo del CRM (`leads.funnel_id`; NULL = el embudo
//      principal, igual que en el CRM). Es lo que hace que la cartera de siempre siga
//      apareciendo en su producto sin escribir una sola fila.
//   2. una FILA en `cliente_entrega` para ese producto: alguien lo agregó a mano, o lo
//      movió de etapa ahí. Es lo que permite estar en varios.
//
// ⚠️ Y SE PREGUNTA SOBRE LA ASIGNACIÓN CON LO MOVIDO ENCIMA (`asignacionDe` de ClientesApp),
// no sobre las filas del server: «Agregar a este producto» tiene que meterlo al tablero en
// el acto, y su deshacer sacarlo, sin esperar al `revalidatePath`.

import { repartirEnEtapas, type EtapaEntrega } from '../../lib/servicio-etapas';

/**
 * El producto de su CASA, o `null` si no tiene una que se pueda ofrecer.
 *
 * ⚠️ SIN CASA RESUELTA Y SIN NINGUNA FILA, CAE AL PRIMER PRODUCTO OFRECIDO. Medido el
 * 06/10/2026 en Código Inmobiliario: su embudo principal no está atado a ningún producto,
 * así que la casa de sus clientes no se resuelve. Sin este respaldo esos clientes no
 * aparecerían en NINGÚN tablero — desaparecer es peor que estar en el primero, y de ahí
 * se los mueve. Pero si ya tiene filas, vive donde lo pusieron: el respaldo existe para
 * que nadie se pierda, no para inventarle un producto a quien ya tiene uno.
 */
export function casaDeCliente(opts: {
  /** `leads.funnel_id`. `null` = el embudo principal. */
  funnelId: number | null;
  /** El embudo principal del negocio, si se pudo leer. */
  funnelDefault: number | null;
  /** embudo → producto (`v_funnel_productos`). */
  productoDeFunnel: ReadonlyMap<number, number>;
  /** Los productos que la pantalla ofrece, en su orden. */
  ofrecidos: readonly number[];
  /** ¿Tiene alguna fila de entrega en un producto ofrecido? */
  tieneFilas: boolean;
  /**
   * Los productos de los que alguien lo SACÓ (`cliente_entrega_fuera`, mig 0196). «Quitar de
   * este producto» sobre su casa no puede borrar nada —la casa se deriva— así que deja una
   * fila ahí, y la casa deja de valer. Tampoco cuentan para el respaldo del primer producto:
   * lo sacaron de ése a propósito.
   */
  fuera?: readonly number[];
}): number | null {
  const fuera = opts.fuera ?? [];
  const f = opts.funnelId ?? opts.funnelDefault;
  const p = f != null ? opts.productoDeFunnel.get(f) : undefined;
  if (p != null && opts.ofrecidos.includes(p) && !fuera.includes(p)) return p;
  if (opts.tieneFilas) return null;
  return opts.ofrecidos.find((x) => !fuera.includes(x)) ?? null;
}

/**
 * ¿Este cliente es de este producto?
 *
 * `asignacion` es la de ESE producto, con lo movido en la sesión encima: una clave
 * presente es una fila (aunque esté en la primera etapa), una ausente es «no la tiene».
 */
export function esDelProducto(
  leadId: number,
  productoId: number,
  casa: Readonly<Record<number, number | null>>,
  asignacion: Readonly<Record<number, unknown>>,
): boolean {
  return casa[leadId] === productoId || Object.prototype.hasOwnProperty.call(asignacion, leadId);
}

/**
 * Los estados de Customer Success (`cs_clientes.estado`, mig 0129) con los que un cliente YA NO
 * está en la entrega: se fue antes de terminar o terminó. Son DECISIONES de Mauricio (o de MaKo
 * por `marcar_estado_cliente_cs`) que se escriben SÓLO en `cs_clientes`: el lead sigue
 * `ganado`, porque ahí «ganado» habla de la VENTA. Es el mismo par que la cartera de MaKo
 * llama «cerrados» (lib/api-mako/areas/cs.run.ts).
 *
 * `pausado` NO está: suspendido, vuelve. Si una secuencia tiene que esperar también a los
 * pausados es una decisión de producto, no un arreglo (docs/hallazgos-customer-success.md).
 */
export const ESTADOS_FUERA_DE_LA_ENTREGA: ReadonlySet<string> = new Set(['baja', 'graduado']);

/** ¿Este estado de Customer Success lo saca de la entrega? Sin fila (`undefined`) = activo. */
export function salioDeLaEntrega(estado: string | null | undefined): boolean {
  return ESTADOS_FUERA_DE_LA_ENTREGA.has(String(estado ?? '').trim());
}

/**
 * Los clientes que HOY están en una etapa de la entrega de un producto: la COHORTE de una
 * secuencia `entrega_actual` (lib/nutricion.ts → `leadsDeCohorte`).
 *
 * ⚠️ Y SIN LOS QUE YA SALIERON (`estadoCs`, 06/10/2026). El universo son los leads `ganado`, y
 * dar de baja o graduar a un cliente no toca `leads.estado_lead`: si nadie lo había movido,
 * seguía en la PRIMERA etapa. Crear una secuencia en «Bienvenida» del ws1 —con el envío
 * prendido— le habría mandado la bienvenida por WhatsApp también a los dados de baja. El
 * kanban sí los dibuja (es dónde quedaron); la cohorte decide a quién se le ESCRIBE, y a
 * ésos no. El parámetro es OBLIGATORIO a propósito: un llamador nuevo no se lo puede olvidar.
 *
 * ⚠️ UNA SECUENCIA EN UNA ETAPA CON CLASES SE SUMA AL MENSAJE DEL CURSO, no lo reemplaza. El
 * paso automático del curso (lib/curso-avance.ts → `avisarEntradaAEtapa`) ya le escribe al
 * cliente cuando entra a una etapa con clases, y también mueve por el choke point que dispara
 * el evento de entrega: con una secuencia colgada de esa misma etapa le llegan los DOS.
 *
 * ⚠️ ES LA REGLA DEL KANBAN, COMPUESTA ACÁ Y EN NINGÚN OTRO LADO: de quién es el producto
 * (`esDelProducto`) y en qué columna cae (`repartirEnEtapas`, «sin fila = la primera»).
 * Hasta el 06/10/2026 la cohorte leía SÓLO las filas de `cliente_entrega` con esa etapa, y
 * un cliente sin fila —que el kanban dibuja en la primera columna— no estaba en ninguna:
 * en el ws1 eran 13 de 14. Una secuencia colgada de «Bienvenida» no le llegaba nunca a
 * nadie que no hubieran movido a mano, porque sin movimiento tampoco hay evento.
 *
 * ⚠️ `clientes` ES EL UNIVERSO (los leads ganados), NUNCA las filas. Pasarle las filas es
 * el mismo cero plausible de siempre: el que cuenta filas cuenta de menos.
 *
 * `etapas: null` = el producto no se ofrece en Customer Success (dado de baja, o con todos
 * sus embudos archivados): no hay tablero, así que no hay «primera columna» que derivar y
 * entra sólo quien tiene una fila con ESA etapa — el hecho que alguien escribió.
 *
 * Los huérfanos (fila con una etapa que el catálogo ya no tiene) no caen en ninguna: el
 * kanban los lista aparte y acá tampoco se les inventa una.
 */
export function clientesEnEtapa(o: {
  productoId: number;
  etapa: string;
  etapas: readonly EtapaEntrega[] | null;
  clientes: readonly number[];
  casa: Readonly<Record<number, number | null>>;
  /** Las filas de ESE producto: lead → su etapa guardada. */
  asignacion: Readonly<Record<number, { etapa: string }>>;
  /** lead → `cs_clientes.estado`. Sin clave = sin fila = activo. Ver `salioDeLaEntrega`. */
  estadoCs: Readonly<Record<number, string | null | undefined>>;
}): number[] {
  const key = o.etapa.trim();
  if (!key) return [];
  const delProducto = o.clientes.filter((id) => !salioDeLaEntrega(o.estadoCs[id]) && esDelProducto(id, o.productoId, o.casa, o.asignacion));
  if (o.etapas == null) return delProducto.filter((id) => (o.asignacion[id]?.etapa ?? '').trim() === key);
  return repartirEnEtapas(o.etapas, delProducto, (id) => o.asignacion[id]?.etapa).porEtapa[key] ?? [];
}
