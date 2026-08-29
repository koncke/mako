// =============================================================================
// Cuántas cosas pidió el dueño en un mensaje
// =============================================================================
// El caso (9/8/2026): mandó seis puntos numerados sobre monitorear el uso de la app
// —detectar bugs solos, alimentar a la IA, mensajes por inactividad, saber qué se usa
// más, medir picos de uso, y un dashboard en SuperAdmin— y cerró con «todo esto podría
// ser más de una sola idea/tarea». MaKo armó **UNA** tarea.
//
// No se truncó: la llamada gastó 933 tokens de los 2500 disponibles. El modelo
// simplemente resumió. Y el prompt no ayudaba: explicaba con detalle cómo agrupar las
// tareas en PROYECTOS por tema, y no decía nada sobre cuántas TAREAS salen de un
// mensaje. El único que sabía que eran seis era el dueño.
//
// Contar es trabajo de código, no de un LLM. Esto cuenta los puntos y el prompt se lo
// dice al modelo como un hecho, no como una intuición que tiene que tener. Es la misma
// idea que `lib/link-borrador.ts`: un dato exacto no lo transporta el modelo.
//
// Sin `server-only`: se testea sola.

/** Un punto enumerado del mensaje, ya sin su marca. */
export type Punto = { marca: string; texto: string };

// «1.» «2)» «3 -» al principio de la línea. El número tiene que ser chico (1-99): un
// año («2026 fue…») o un monto no son una enumeración.
const NUMERADO = /^\s{0,3}(\d{1,2})\s*[.)\-–]\s+(.+)$/;
// «- » «· » «• » «* ». Pide el espacio a propósito: «-5%» no es un ítem.
const VINETA = /^\s{0,3}([-·•*])\s+(.+)$/;

/**
 * Los puntos que el dueño enumeró EXPLÍCITAMENTE en su mensaje.
 *
 * Solo cuenta enumeraciones de verdad —numeradas o con viñeta, al principio de la
 * línea— y pide al menos DOS para considerar que hay una lista. Un guion suelto en
 * medio de un párrafo no es un ítem, y tratarlo como tal haría que MaKo parta en dos
 * un pedido que era uno solo: el error opuesto, y peor, porque ensucia el tablero.
 *
 * Los numerados le ganan a las viñetas: si el mensaje tiene «1. … 2. …» y adentro de
 * cada uno hay guiones, los puntos son dos, no ocho.
 */
export function puntosDelMensaje(texto: string): Punto[] {
  const lineas = (texto ?? '').split('\n');
  const num: Punto[] = [];
  const vin: Punto[] = [];
  for (const l of lineas) {
    const mn = NUMERADO.exec(l);
    if (mn) { num.push({ marca: mn[1], texto: mn[2].trim() }); continue; }
    const mv = VINETA.exec(l);
    if (mv) vin.push({ marca: mv[1], texto: mv[2].trim() });
  }
  const elegidos = num.length >= 2 ? num : vin;
  return elegidos.length >= 2 ? elegidos : [];
}

/** El dueño avisó, con palabras, que esto es más de una cosa. */
const AVISA_VARIAS = /\b(m[áa]s de una|varias?|distintas?|separad[ao]s?|cada una|una por cada)\b.{0,24}\b(tarea|idea|cosa)s?\b|\b(tarea|idea|cosa)s?\b.{0,24}\b(separad[ao]s?|distintas?)\b/i;

export const avisaQueSonVarias = (texto: string): boolean => AVISA_VARIAS.test(texto ?? '');

/**
 * La línea que se le agrega al prompt cuando el mensaje trae una lista. Vacía si no
 * hay nada que contar — no se le inventa presión al modelo sobre un mensaje suelto.
 */
export function avisoDePuntos(texto: string): string {
  const puntos = puntosDelMensaje(texto);
  const aviso = avisaQueSonVarias(texto);
  if (!puntos.length && !aviso) return '';
  const partes: string[] = [];
  if (puntos.length) {
    partes.push(
      `⚠️ ESTE MENSAJE ENUMERA ${puntos.length} PUNTOS. Cada punto es AL MENOS una tarea, ` +
      `salvo que dos digan literalmente lo mismo. Si armas menos de ${puntos.length}, estás ` +
      `resumiendo — y resumir aquí le pierde trabajo al dueño, que ya se tomó el trabajo de separarlo. ` +
      `Los puntos son: ${puntos.map((p, i) => `(${i + 1}) ${p.texto.slice(0, 90)}`).join(' · ')}`,
    );
  }
  if (aviso) {
    partes.push('⚠️ El dueño DIJO que esto es más de una tarea. Separalo: es una instrucción, no una sugerencia.');
  }
  return partes.join('\n');
}
