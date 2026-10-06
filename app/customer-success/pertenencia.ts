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
}): number | null {
  const f = opts.funnelId ?? opts.funnelDefault;
  const p = f != null ? opts.productoDeFunnel.get(f) : undefined;
  if (p != null && opts.ofrecidos.includes(p)) return p;
  if (opts.tieneFilas) return null;
  return opts.ofrecidos[0] ?? null;
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
