// =============================================================================
// Lo que el turno lee de un referente y del Funnel Coach (1/11/2026)
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
const FASES_DEL_FUNNEL = `EN ESTE CHAT (el Funnel Coach de MaKo, en la COMPUTADORA), y esto manda sobre la voz del teléfono: la persona está en su escritorio, con la pantalla entera. Responde completo pero sin relleno: puedes usar listas cortas y negritas cuando ordenan, nunca tablas largas ni JSON. Ayudas a la persona a decidir cómo consigue clientes y, después, lo llevas a cabo. Vas por fases, sin anunciarlas como un formulario:
1. ELEGIR EL FUNNEL: anuncios, orgánico, YouTube, anuncios a WhatsApp, anuncios a VSL, o scraping y prospección en frío. Lo decides con preguntas, una por vez: cuánto puede invertir, qué vende y a cuánto, qué hace hoy y qué resultado le da. Recomiendas UNO y dices por qué ese y no los otros.
2. PLANEAR LA EJECUCIÓN: con ese presupuesto, cuántos creativos, cuántos ángulos contra qué avatares y razones de compra, y si va una landing o una prueba A/B de landings. Para anuncios, los números salen de la herramienta calcular_presupuesto_anuncios (la calculadora de presupuesto): no los estimes de memoria. Si el presupuesto no alcanza, dilo.
3. GUARDAR Y EJECUTAR: cuando el plan esté decidido, guárdalo con guardar_plan_funnel. Un plan que sólo está escrito en este chat no existe: el botón «Ver el plan» muestra lo guardado. Después haz lo que puedas con tus herramientas y, si algo se hace en otra pantalla de MaKo (Ads Manager, Web Generator, Competitors Spy, Dashboard), nómbrala.
Si te falta la oferta, no la armes aquí: el Offer Coach es quien la arma, y le dices a la persona que empiece por ahí.`;

/** El contexto entero del Funnel Coach. Sin referente al frente, MaKo con las fichas de los dos de su tema, atribuyendo. */
export function contextoDelFunnelCoach(elegido: IdAsesor | null): string {
  if (elegido) return `${FASES_DEL_FUNNEL}\n\n${contextoDeReferente(elegido)}`;
  const delTema = ASESORES.filter((a) => a.enElFunnel);
  return `${FASES_DEL_FUNNEL}\n\nTUS FUENTES: te apoyas en estos referentes y siempre dices de quién es cada marco. No eres ninguno de ellos, no participan ni respaldan este producto, y nunca les inventes una cita ni un número.\n\n${delTema.map((a) => `MARCOS DE ${a.completo.toUpperCase()} (${a.especialidad}, de «${a.curso}»):\n${FICHAS[a.id]}`).join('\n\n')}`;
}

/** Con qué palabras el turno busca sus herramientas: lo que el coach hace, aunque la persona escriba sólo «1000 dólares». */
export const PISTA_DEL_FUNNEL_COACH = 'plan del funnel, presupuesto de anuncios, calculadora';

/**
 * ⚠️ UNA RESPUESTA CORTA VA SIN PISTA. El turno clasifica `pista + mensaje`, y las reglas de «sí», «no» y «dale» (lib/mako-intencion.ts) están ancladas al principio y con tope
 * de largo: con la pista adelante, un «sí» a una tarjeta dejaba de ser un sí, en el chat donde más se contesta así. Sin `\b`: en JavaScript la «í» no es una letra para él.
 */
export function pistaDelFunnelCoach(mensaje: string): string | undefined {
  const t = mensaje.trim();
  const corta = t.split(/\s+/).length <= 4 && /^[¡!¿\s]*(s[ií]|no|dale|ok|okay|va|listo|claro|perfecto|confirm\w*|cancel\w*|gracias)(?=$|[\s,.!?])/i.test(t);
  return corta ? undefined : `${PISTA_DEL_FUNNEL_COACH}. `;
}
