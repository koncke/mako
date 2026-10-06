// =============================================================================
// ¿El lead está repitiendo la MISMA objeción?
// =============================================================================
// Pedido del dueño, con sus palabras: «lo entiendo 1, 2, incluso 3 veces rebatir
// la objeción, pero que luego siga insistiendo con lo mismo no es el
// comportamiento normal de un lead».
//
// Esto NO se le delega al modelo, y el motivo está medido: se le pidió en el
// prompt que cerrara a la tercera repetición y siguió rebatiendo las cuatro. Un
// modelo no lleva la cuenta de nada — el que cuenta es el servidor.
//
// La comparación es por PALABRAS, no por texto exacto: «está muy caro», «igual
// me parece caro» y «sigue caro» son el mismo mensaje dicho de tres formas, y
// una comparación literal no vería ninguna coincidencia.
//
// Sin 'server-only': es una función pura y tiene tests.

/** Normaliza para comparar: sin tildes, sin puntuación, sin mayúsculas. */
function palabras(texto: string): Set<string> {
  const limpio = texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ');
  // Las palabras de UNA letra y las muletillas más comunes no distinguen nada:
  // dejarlas hace que dos mensajes cualesquiera se parezcan.
  const VACIAS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'y', 'o', 'que', 'es', 'me', 'mi', 'te', 'se', 'lo', 'en', 'no', 'si', 'a', 'al', 'por', 'para', 'con', 'muy', 'mas', 'pero', 'igual', 'ya', 'sigue', 'esta', 'este']);
  return new Set(limpio.split(/\s+/).filter((p) => p.length > 2 && !VACIAS.has(p)));
}

/** Cuánto se parecen dos mensajes: 0 = nada, 1 = las mismas palabras. */
export function parecido(a: string, b: string): number {
  const A = palabras(a);
  const B = palabras(b);
  if (!A.size || !B.size) return 0;
  let comunes = 0;
  for (const p of A) if (B.has(p)) comunes += 1;
  // Jaccard: comunes sobre el total de palabras distintas entre los dos.
  return comunes / (A.size + B.size - comunes);
}

/** Desde qué parecido dos mensajes cuentan como "lo mismo dicho distinto". */
export const UMBRAL_REPETICION = 0.34;

/**
 * ¿El ÚLTIMO mensaje del lead es una objeción que ya dijo `veces` veces?
 *
 * Se cuenta cuántos mensajes anteriores se parecen al último, y NO se exige que
 * sean consecutivos: un lead que objeta el precio, pregunta otra cosa y vuelve
 * al precio está insistiendo igual.
 *
 * `veces` es 3 a propósito: el dueño acepta rebatir dos. La TERCERA aparición es
 * la señal de que no hay nada nuevo que decir. Con dos todavía es una
 * conversación normal, así que acá devuelve false.
 */
export function insisteConLoMismo(mensajesDelLead: string[], veces = 3): boolean {
  const dichos = mensajesDelLead.filter((m) => m.trim());
  const ultimo = dichos[dichos.length - 1];
  if (!ultimo || dichos.length < veces) return false;
  const iguales = dichos.filter((m) => parecido(ultimo, m) >= UMBRAL_REPETICION).length;
  return iguales >= veces;
}

/** Un turno de una charla, como lo arma el setter. */
type Turno = { de: 'lead' | 'negocio'; texto: string };

/** Lo que el sistema pone en lugar de un mensaje sin texto: «(mandó un audio)», «(le mandamos…)». */
const RELLENO = /^\([\s\S]*\)$/;

/** Palabras que no son una objeción: un «gracias» repetido no es insistir con lo mismo. */
const CORTESIA = new Set(['gracias', 'muchas', 'okay', 'vale', 'perfecto', 'perfecta', 'listo', 'lista', 'sale', 'genial', 'excelente', 'bien', 'dale', 'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'claro', 'sip', 'entendido', 'enterado', 'super', 'saludos', 'igualmente']);

function soloCortesia(texto: string): boolean {
  const limpio = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ');
  const sueltas = limpio.split(/\s+/).filter((p) => p.length > 2);
  return sueltas.every((p) => CORTESIA.has(p));
}

/**
 * ¿El lead repite la MISMA objeción después de que el negocio ya se la respondió dos veces?
 *
 * Es `insisteConLoMismo` contado por RONDAS y no por mensajes (revisión del 06/10/2026, con la
 * charla real del modo asistido). Por mensajes, tres mensajes seguidos del lead que nadie
 * contestó todavía —«está caro» / «muy caro» / «carísimo», en ráfaga— ya contaban como
 * «insiste por tercera vez»: MaKo redactaba una despedida y cerraba la charla de alguien que
 * sólo escribe en varios mensajes. Una ronda es lo que el lead dijo entre dos respuestas del
 * negocio, junto; tres rondas parecidas exigen dos respuestas en el medio, que es lo que pidió
 * el dueño («lo entiendo 1, 2, incluso 3 veces rebatir la objeción»).
 *
 * Fuera de la cuenta: lo que el sistema pone por un mensaje sin texto («(mandó un audio)») y
 * las rondas que son pura cortesía (un «gracias» repetido no es una objeción).
 */
export function insistenciaRebatida(turnos: Turno[], veces = 3): boolean {
  const rondas: string[] = [];
  let actual: string[] = [];
  const cerrar = () => { if (actual.length) { rondas.push(actual.join(' ')); actual = []; } };
  for (const t of turnos) {
    if (t.de === 'negocio') { cerrar(); continue; }
    const texto = t.texto.trim();
    if (!texto || RELLENO.test(texto)) continue;
    actual.push(texto);
  }
  cerrar();
  return insisteConLoMismo(rondas.filter((r) => !soloCortesia(r)), veces);
}
