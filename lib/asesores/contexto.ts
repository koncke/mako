// =============================================================================
// Lo que el turno lee de un referente y del Funnel Coach (1/11/2026; desde el 4/11, el único coach: la oferta y el funnel)
// =============================================================================
// El contexto de cada coach, en el system del turno (lib/mako-turno-app.ts → `entrada.contexto`) y en el de Offer
// (lib/offer-ia.ts → `turnoOffer`). Pesa: por eso se arma en el servidor y una ficha no viaja al navegador.
//
// ⚠️ LA REGLA QUE PROTEGE A MARTÍN Y AL CLIENTE: MaKo aconseja INSPIRADO en el referente, no es él. Nunca dice ser esa persona, ni
//    que la conoce, ni que respalda nada, y nunca le inventa una cita, una anécdota o un número. Lo que la ficha no cubre lo dice
//    como criterio de MaKo, sin ponérselo en la boca a nadie.

import { asesorPorId, ASESORES, type Asesor, type IdAsesor } from './catalogo';
import { FICHAS } from './fichas';

/** Cómo se usa una ficha, con cualquier referente. */
function reglasDe(a: Asesor): string {
  return `CON QUÉ AVISAS (no lo repitas en cada mensaje): este chat está inspirado en ${a.completo}. Eres MaKo usando sus marcos: no eres ${a.completo}, no hablas en su nombre y no participa ni respalda este producto. Si te preguntan, lo dices así. Nunca le inventes una cita, una anécdota, un caso ni un número.
ATRIBUYE SIEMPRE: cuando uses un marco, di de quién es y de dónde sale («esto es la ... de ${a.nombre}, de ${a.curso}»). Lo que la ficha no cubre lo dices como tu criterio, sin atribuírselo.
LO QUE NO ACONSEJAS AUNQUE SE ENSEÑE EN ESOS CURSOS: escasez o cupos inventados, reseñas, testimonios o seguidores falsos, promesas de ingresos, presión para decidir hoy, ni saltarse las reglas de una plataforma.
ATERRIZA: un marco suelto no sirve. Bájalo a los números y a la oferta de este negocio, y haz una sola pregunta por vez.`;
}

/** El bloque de un referente: sus reglas y su ficha, destilada de su curso. */
export function contextoDeReferente(id: IdAsesor | null): string {
  const a = asesorPorId(id);
  return a ? `EL REFERENTE DE ESTE CHAT: ${a.completo}, experto en ${a.especialidad}.\n${reglasDe(a)}\n\nSU FICHA (destilada de su curso «${a.curso}»):\n${FICHAS[a.id]}` : '';
}

// ⚠️ LA PRIMERA FRASE MANDA SOBRE LA VOZ DEL TELÉFONO: el turno es el mismo del celular (VOZ_APP, lib/mako-turno-app.ts: «2-5 líneas»), y `CONTEXTO_SECOND_BRAIN` lo anula
//    en el Ops Center. Como este contexto lo reemplaza, sin esta frase el coach armaba un plan en cinco líneas.
// ⚠️ UN SOLO COACH DESDE EL 4/11/2026 (Martín: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga
//    ambas funcionalidades dentro»). EL ORDEN ES LA OFERTA Y DESPUÉS EL FUNNEL, y no al revés: un funnel lleva gente a una oferta, y
//    con una oferta floja cualquier presupuesto se quema (era la razón por la que el Funnel Coach sin oferta mandaba al Offer Coach).
//    Pero no es un formulario: quien ya tiene la oferta, o llega con una pregunta del funnel, no pasa por la primera fase.
const FASES_DEL_COACH = `EN ESTE CHAT (el Funnel Coach de MaKo, en la COMPUTADORA), y esto manda sobre la voz del teléfono: la persona está en su escritorio, con la pantalla entera. Responde completo pero sin relleno: puedes usar listas cortas y negritas cuando ordenan, nunca tablas largas ni JSON. Ayudas a la persona con su oferta y con cómo consigue clientes, y después lo llevas a cabo. Vas por fases, sin anunciarlas como un formulario; si llega con una pregunta de una fase, contesta esa:
1. LA OFERTA: antes de elegir un funnel, mira la que hay. Las guardadas salen de listar_ofertas y la última que armó MaKo en una conversación de oferta, de ver_analisis_oferta: si ya hay una, dila en una línea y sigue, sin volver a preguntar lo que ya está. Si no hay, o le falta lo que hace que alguien compre (a quién, qué resultado, precio, garantía), trabájala con preguntas, una por vez. Cuando esté decidida, guárdala con guardar_oferta: una oferta que sólo está escrita en este chat no existe.
2. ELEGIR EL FUNNEL: anuncios, orgánico, YouTube, anuncios a WhatsApp, anuncios a VSL, o scraping y prospección en frío. Lo decides con preguntas, una por vez: cuánto puede invertir, qué hace hoy y qué resultado le da. Recomiendas UNO y dices por qué ese y no los otros.
3. PLANEAR LA EJECUCIÓN: con ese presupuesto, cuántos creativos, cuántos ángulos contra qué avatares y razones de compra, y si va una landing o una prueba A/B de landings. Para anuncios, los números salen de la herramienta calcular_presupuesto_anuncios (la calculadora de presupuesto): no los estimes de memoria. Si el presupuesto no alcanza, dilo.
4. GUARDAR Y EJECUTAR: cuando el plan esté decidido, guárdalo con guardar_plan_funnel. Un plan que sólo está escrito en este chat no existe: el botón «Ver el plan» muestra lo guardado, y tú lo lees con ver_plan_funnel. Después haz lo que puedas con tus herramientas y, si algo se hace en otra pantalla de MaKo (Ads Manager, Web Generator, Competitors Spy, Dashboard), nómbrala.`;

/** El contexto entero del coach. Sin referente al frente (eligió «MaKo»), con las fichas de uno por tema que trabaja, atribuyendo. */
export function contextoDelFunnelCoach(elegido: IdAsesor | null): string {
  if (elegido) return `${FASES_DEL_COACH}\n\n${contextoDeReferente(elegido)}`;
  const delTema = ASESORES.filter((a) => a.enElCoach);
  return `${FASES_DEL_COACH}\n\nTUS FUENTES: te apoyas en estos referentes y siempre dices de quién es cada marco. No eres ninguno de ellos, no participan ni respaldan este producto, y nunca les inventes una cita ni un número.\n\n${delTema.map((a) => `MARCOS DE ${a.completo.toUpperCase()} (${a.especialidad}, de «${a.curso}»):\n${FICHAS[a.id]}`).join('\n\n')}`;
}

/**
 * Las herramientas del coach: las de la oferta (lo que hacía el Offer Coach) y las del funnel. Viajan en CADA turno del coach que
 * lleva herramientas, primero y DENTRO del presupuesto de 12.000 caracteres del registro (lib/doer-herramientas.ts → `propias`):
 * antes las traía el ranking por relevancia, y al juntar los dos coaches `guardar_oferta` no llegaba ni con «guarda esta oferta»
 * (medido el 4/11/2026). En una pregunta, las que escriben no viajan: se OFRECEN (`ofrecibles`), y con el «sí» viajan.
 * ⚠️ CADA UNA SE PAGA: juntas pesan 7.806 caracteres (en una pregunta, 3.858) y lo que queda es para todo lo demás que se pida en
 *    este chat. tests/coaches-ops-center.test.ts mide el margen; una más que no entra hace fallar ese test, nunca se cae en silencio.
 * ⚠️ Y POR ESO EL COACH YA NO LLEVA PISTA. Hasta el 4/11 cada mensaje se clasificaba con «plan del funnel, presupuesto de anuncios,
 *    calculadora» delante, para que la calculadora llegara aunque la persona escribiera sólo «1000 dólares». Con sus herramientas
 *    fijas, la pista sólo restaba: le regalaba el primer lugar a `proponer_presupuesto_campana` en cada pedido, y «crea una landing
 *    para mi oferta» se quedaba sin `crear_landing_desde_diseno` (medido el 4/11/2026).
 */
export const HERRAMIENTAS_DEL_COACH: readonly string[] = [
  'listar_ofertas', 'ver_analisis_oferta', 'guardar_oferta',
  'calcular_presupuesto_anuncios', 'ver_plan_funnel', 'guardar_plan_funnel',
];
