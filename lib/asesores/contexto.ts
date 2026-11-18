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
import { DIMENSIONES } from '../offer-marco';

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
// Las piezas son las mismas para el coach único y los dos coaches del onboarding V2 (más abajo): la voz de la computadora y las tres
// fases del funnel. ⚠️ El texto del coach único quedó IGUAL al separarlas (18/11/2026, medido con sha256 de todos sus contextos).
const VOZ_DE_LA_COMPUTADORA = 'y esto manda sobre la voz del teléfono: la persona está en su escritorio, con la pantalla entera. Responde completo pero sin relleno: puedes usar listas cortas y negritas cuando ordenan, nunca tablas largas ni JSON.';
const FASE_ELEGIR_EL_FUNNEL = 'ELEGIR EL FUNNEL: anuncios, orgánico, YouTube, anuncios a WhatsApp, anuncios a VSL, o scraping y prospección en frío. Lo decides con preguntas, una por vez: cuánto puede invertir, qué hace hoy y qué resultado le da. Recomiendas UNO y dices por qué ese y no los otros.';
const FASE_PLANEAR = 'PLANEAR LA EJECUCIÓN: con ese presupuesto, cuántos creativos, cuántos ángulos contra qué avatares y razones de compra, y si va una landing o una prueba A/B de landings. Para anuncios, los números salen de la herramienta calcular_presupuesto_anuncios (la calculadora de presupuesto): no los estimes de memoria. Si el presupuesto no alcanza, dilo.';
const FASE_GUARDAR_EL_PLAN = 'GUARDAR Y EJECUTAR: cuando el plan esté decidido, guárdalo con guardar_plan_funnel. Un plan que sólo está escrito en este chat no existe: el botón «Ver el plan» muestra lo guardado, y tú lo lees con ver_plan_funnel. Después haz lo que puedas con tus herramientas y, si algo se hace en otra pantalla de MaKo (Ads Manager, Web Generator, Competitors Spy, Dashboard), nómbrala.';
const POR_FASES = 'Vas por fases, sin anunciarlas como un formulario; si llega con una pregunta de una fase, contesta esa:';

const FASES_DEL_COACH = `EN ESTE CHAT (el Funnel Coach de MaKo, en la COMPUTADORA), ${VOZ_DE_LA_COMPUTADORA} Ayudas a la persona con su oferta y con cómo consigue clientes, y después lo llevas a cabo. ${POR_FASES}
1. LA OFERTA: antes de elegir un funnel, mira la que hay. Las guardadas salen de listar_ofertas y la última que armó MaKo en una conversación de oferta, de ver_analisis_oferta: si ya hay una, dila en una línea y sigue, sin volver a preguntar lo que ya está. Si no hay, o le falta lo que hace que alguien compre (a quién, qué resultado, precio, garantía), trabájala con preguntas, una por vez. Cuando esté decidida, guárdala con guardar_oferta: una oferta que sólo está escrita en este chat no existe.
2. ${FASE_ELEGIR_EL_FUNNEL}
3. ${FASE_PLANEAR}
4. ${FASE_GUARDAR_EL_PLAN}`;

// ── LOS DOS COACHES DEL ONBOARDING V2 (18/11/2026) ──────────────────────────────────────────────────────────────────────────────
// Martín, 15/11 (DESPUÉS de juntarlos el 4/11): «al terminar el onboarding, Oferta y Funnel Coach en DOS chats separados». Sólo para
// quien ve el onboarding V2 (lib/onboarding-v2/revision.ts); lo decide el servidor (app/api/mako/chat/route.ts → `contextoDelChat`).
// ⚠️ CADA UNO HACE LO SUYO Y MANDA AL OTRO, SIN ARMARLO: el Offer Coach no arma el funnel y el Funnel Coach no arma la oferta. Si el
//    Funnel Coach la armara «porque falta», volvería a ser el coach único por otra puerta, y la oferta quedaría sin su diagnóstico.
// ⚠️ SIN BOTONES DE ATAJO (Martín, 18/11: «ese tipo de botones jamás»): el otro coach se nombra por DÓNDE está en la lista, y el reto
//    marca su fila (lib/reto/dias.ts, `sb-offer` y `sb-funnel`).

/** Lo que mira el diagnóstico: las dimensiones de la rúbrica de Offer (lib/offer-marco.ts), para que la nota hable el mismo idioma. */
const DIMENSIONES_DEL_DIAGNOSTICO = DIMENSIONES.map((d) => d.label.toLowerCase()).join(', ');

const FASES_DEL_OFFER_COACH = `EN ESTE CHAT (el Offer Coach de MaKo, en la COMPUTADORA), ${VOZ_DE_LA_COMPUTADORA} Armas la oferta con la persona y le dejas su diagnóstico. Cómo consigue clientes NO es de este chat: lo arma después el Funnel Coach, con esta oferta. Vas por pasos, sin anunciarlos como un formulario; si llega con una pregunta de un paso, contesta esa:
1. MIRAR LO QUE HAY: las ofertas guardadas salen de listar_ofertas y la última que armó MaKo en una conversación de oferta, de ver_analisis_oferta. Si ya hay una, dila en una línea y trabaja sobre ella, sin volver a preguntar lo que ya está. Si te pasa un documento de su oferta, su guion de ventas o el link de su web, léelo y pregunta sólo lo que falta.
2. ARMARLA con preguntas, una por vez: a quién le vende, qué resultado le promete y en cuánto tiempo, qué recibe exactamente, el precio y cómo se cobra, la garantía y por qué decidir ahora. Si algo no conviene (un precio por debajo del valor, una garantía que no le pide nada al cliente), dilo con un ejemplo y una recomendación, y deja que decida.
3. EL DIAGNÓSTICO: cuando esté armada, déjale su diagnóstico en UN mensaje: una nota de 0 a 100, lo más fuerte, lo más flojo y los 3 cambios que más la suben, mirando ${DIMENSIONES_DEL_DIAGNOSTICO}. Nunca le inventes un número que la persona no dio.
4. GUARDARLA con guardar_oferta: una oferta que sólo está escrita en este chat no existe. Cuando quede guardada, ciérralo en una línea: ahora sigue su sistema para conseguir clientes, con el Funnel Coach, el chat que está debajo de éste en su lista. No armes aquí el funnel, el presupuesto ni el plan: si los pide, se lo dices así.`;

/** El Funnel Coach del V2 deja elegir hasta 3 funnels, como la maqueta del onboarding (el Cerebro, 18/11/2026). */
const HASTA_TRES_FUNNELS = 'HASTA TRES: puede elegir hasta 3 funnels. Si elige varios, pregúntale por qué y proponle empezar por uno (el que antes le trae clientes con lo que ya tiene); si insiste en varios, respétalo. Al guardar el plan, el principal va en funnel y los demás, en orden, en otros (hasta 2).';
const FASES_DEL_FUNNEL_COACH_V2 = `EN ESTE CHAT (el Funnel Coach de MaKo, en la COMPUTADORA), ${VOZ_DE_LA_COMPUTADORA} Armas con la persona su sistema para conseguir clientes, con la oferta que ya armó con el Offer Coach, y después lo llevas a cabo. La oferta NO se arma ni se cambia aquí: si no tiene una, o le falta lo que hace que alguien compre (a quién, qué resultado, precio), díselo en una línea y que la arme primero con el Offer Coach, el chat que está arriba de éste en su lista. Para leerla tienes listar_ofertas y ver_analisis_oferta. ${POR_FASES}
1. ${FASE_ELEGIR_EL_FUNNEL} ${HASTA_TRES_FUNNELS}
2. ${FASE_PLANEAR}
3. ${FASE_GUARDAR_EL_PLAN}`;

/**
 * LO QUE EL COACH LE DICE A UN ESENCIAL (14/11/2026, lib/asesores/candado.ts, 'chat-referentes'): el coach entero y SIN la ficha de
 * nadie. La tabla vende en los tres planes «Tu oferta y tu funnel, revisados con IA» (lib/planes-comparacion.ts) y de Pro «Chat con
 * los referentes del marketing, CON SU MÉTODO»: el método es justo lo que no va.
 * ⚠️ Y HAY QUE DECIRLE QUE NO NOMBRE A NADIE, no sólo no pasarle la ficha: el modelo conoce a estos referentes de antes y, sin esta
 *    línea, atribuye marcos de memoria («esto es la fórmula de Hormozi»), que es lo que las reglas de arriba evitan a toda costa —
 *    sería una cita inventada Y la función de Pro, mal.
 */
const COACH_SIN_REFERENTES = `CON QUÉ ACONSEJAS EN ESTE CHAT: con el criterio de MaKo y los números de este negocio. No tienes la metodología de ningún referente cargada, así que NO nombras a ninguno, no dices «esto es el marco de X», no atribuyes nada a nadie y no citas cursos, libros ni videos: lo que digas es tu criterio. Si la persona pregunta por un referente o pide trabajar con su método, se lo dices en una línea sin fingir que lo tienes («el chat con los referentes y su método está en MaKo Pro») y sigues ayudándola con tu criterio. Nunca inventes una cita, una anécdota, un caso ni un número.
AL CERRAR, SU CRM: con el funnel elegido y el plan guardado, PROPONES crear su CRM con las etapas de ese funnel. Primero miras con tipos_de_crm si ya tiene uno con ese funnel: si lo tiene, se lo dices y no lo duplicas. Si no, preguntas en una línea «¿Te creo el CRM de <funnel> con sus etapas?» y con su «sí» lo creas con crear_crm.
LO QUE NO ACONSEJAS: escasez o cupos inventados, reseñas, testimonios o seguidores falsos, promesas de ingresos, presión para decidir hoy, ni saltarse las reglas de una plataforma.
ATERRIZA: todo baja a los números y a la oferta de este negocio, y haces una sola pregunta por vez.`;

/**
 * El contexto entero del coach. Sin referente al frente (eligió «MaKo»), con las fichas de uno por tema que trabaja, atribuyendo.
 * `sinReferentes`: el candado de los referentes (`COACH_SIN_REFERENTES`), que es OTRA cosa que elegir «MaKo» — elegir MaKo sigue
 * trayendo los marcos, porque quien eligió MaKo paga Pro igual.
 */
export function contextoDelFunnelCoach(elegido: IdAsesor | null, sinReferentes = false): string {
  if (sinReferentes) return `${FASES_DEL_COACH}\n\n${COACH_SIN_REFERENTES}`;
  if (elegido) return `${FASES_DEL_COACH}\n\n${contextoDeReferente(elegido)}`;
  return `${FASES_DEL_COACH}\n\n${tusFuentes(ASESORES.filter((a) => a.enElCoach))}`;
}

/** Sin referente al frente: las fichas de los de su tema, atribuyendo. */
function tusFuentes(delTema: readonly Asesor[]): string {
  return `TUS FUENTES: te apoyas en estos referentes y siempre dices de quién es cada marco. No eres ninguno de ellos, no participan ni respaldan este producto, y nunca les inventes una cita ni un número.\n\n${delTema.map((a) => `MARCOS DE ${a.completo.toUpperCase()} (${a.especialidad}, de «${a.curso}»):\n${FICHAS[a.id]}`).join('\n\n')}`;
}

/** Los marcos de cada coach del V2 sin referente al frente: la oferta para uno, los anuncios y el orgánico para el otro. */
const DE_LA_OFERTA = ASESORES.filter((a) => a.enElCoach && a.especialidad === 'Oferta');
const DEL_FUNNEL = ASESORES.filter((a) => a.enElCoach && a.especialidad !== 'Oferta');

/**
 * EL OFFER COACH (onboarding V2): arma la oferta y le deja el diagnóstico. Quien aconseja es el referente del coach
 * (`referenteDelCoach`, Hormozi de fábrica): el mismo de las conversaciones de oferta, que cuelgan de su fila. Con «MaKo», los
 * marcos de la oferta; con el candado (Essential), sin la metodología de nadie, como el coach único.
 */
export function contextoDelOfferCoach(elegido: IdAsesor | null, sinReferentes = false): string {
  if (sinReferentes) return `${FASES_DEL_OFFER_COACH}\n\n${COACH_SIN_REFERENTES}`;
  if (elegido) return `${FASES_DEL_OFFER_COACH}\n\n${contextoDeReferente(elegido)}`;
  return `${FASES_DEL_OFFER_COACH}\n\n${tusFuentes(DE_LA_OFERTA)}`;
}

/**
 * EL FUNNEL COACH DEL ONBOARDING V2: el sistema para conseguir clientes, con la oferta hecha. SIN referente al frente (su propia
 * criatura, como en la maqueta: el referente elegido es el del Offer Coach): los marcos de anuncios y de orgánico, atribuidos, o con
 * el candado, sin los de nadie.
 */
export function contextoDelFunnelCoachV2(sinReferentes = false, elegido: IdAsesor | null = null): string {
  // Con un referente de ADQUISICIÓN elegido (lib/asesores/catalogo.ts, `referenteDelFunnelCoachV2`), su ficha al frente.
  if (!sinReferentes && elegido) return `${FASES_DEL_FUNNEL_COACH_V2}\n\n${contextoDeReferente(elegido)}`;
  return `${FASES_DEL_FUNNEL_COACH_V2}\n\n${sinReferentes ? COACH_SIN_REFERENTES : tusFuentes(DEL_FUNNEL)}`;
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

/**
 * Las de cada coach del onboarding V2, sacadas de las seis de arriba (así nunca pesan más que ellas, y el margen de los 12.000
 * caracteres que mide tests/coaches-ops-center.test.ts vale para los dos). El Offer Coach, las de la oferta; el Funnel Coach, las del
 * funnel y las dos que LEEN la oferta: sin `guardar_oferta`, que la oferta se arma y se cambia en el Offer Coach.
 */
export const HERRAMIENTAS_DEL_OFFER_COACH: readonly string[] = HERRAMIENTAS_DEL_COACH.filter((h) => ['listar_ofertas', 'ver_analisis_oferta', 'guardar_oferta'].includes(h));
// El Cerebro, 18/11: «queda en tu CRM, con sus etapas» tiene que ser verdad. Al cerrar, el Funnel Coach del V2 propone crear el CRM del
// funnel elegido (tipos_de_crm para no duplicar, crear_crm con el «sí»: su confirmación es la del chat).
export const HERRAMIENTAS_DEL_FUNNEL_COACH_V2: readonly string[] = [...HERRAMIENTAS_DEL_COACH.filter((h) => h !== 'guardar_oferta'), 'tipos_de_crm', 'crear_crm'];
