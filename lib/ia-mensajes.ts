// =============================================================================
// ia-mensajes — QUÉ le decimos al usuario cuando la cascada de IA no pudo
// =============================================================================
// Un solo lugar, y sin `server-only` para que se pueda testear (misma razón que
// `lib/model-catalogo.ts`).
//
// ⚠️ EL CASO QUE LO OBLIGÓ. Una clienta con TRES cuentas de Gemini conectadas vio
// «No hay IA para generar las razones. Conecta tu API key de Gemini (gratis) en
// Integraciones.» La frase era falsa en las dos mitades: había IA, y pegar otra key
// de Gemini no arreglaba nada. La causa no fue que nadie hubiera pensado el
// problema —`avatares.ts` y `entregable.ts` YA distinguían «no hay key» de «hay key
// y falló»— sino que la corrección se aplicó A MANO en dos de los cuatro
// call-sites, y los dos que quedaron afuera incluían el que ella usa.
//
// Por eso el texto vive acá y no en cada archivo: mientras sea una frase que cada
// call-site escribe, la mitad va a quedar vieja. `tests/ia-mensajes.test.ts` falla
// si alguien vuelve a escribir el literal suelto.

/** El literal prohibido: si aparece fuera de este módulo, es un mensaje que miente. */
export const FRASE_PROHIBIDA = 'Conecta tu API key de Gemini';

/**
 * Traduce los errores CRUDOS que dejó la cascada en un motivo legible para una persona.
 *
 * ⚠️ VIVE ACÁ Y NO EN `lib/ai-cheap.ts` POR UNA RAZÓN QUE YA SE PAGÓ. Es una función
 * PURA que decide qué lee el usuario, y estaba encerrada adentro de un módulo con
 * `server-only`: ningún test la podía importar. O sea que lo único sin red era
 * justamente lo que le habla a la persona — la misma regla de la casa que sacó a
 * `exigirClienteDePrueba` y a `model-catalogo` de sus módulos server-only.
 *
 * El precio de no tenerla testeada, cobrado el 16/08 con un cliente esperando: un 503
 * de saturación se reportaba como «te quedaste sin cuota», y ese mensaje mandó a buscar
 * una cuota agotada que no existía. La misma key contestaba 200 minutos después.
 *
 * null = ninguna pista clara; el caller cae al genérico.
 */
export function motivoDeErroresCascada(errores: string[]): string | null {
  if (!errores.length) return null;
  const todo = errores.join(' | ').toLowerCase();
  // ⚠️ SATURACIÓN ANTES QUE CUOTA, Y ESE ORDEN ES EL ARREGLO. Un 503 «high demand» es el
  // proveedor caído para todo el mundo: no gastaste nada, tu key está perfecta, y en dos
  // minutos anda. Decirle a alguien «te quedaste sin cuota» lo manda a comprar créditos o
  // a cargar otra key por un problema que no es suyo y que se arregla solo.
  //
  // Va PRIMERO porque un 503 y un 429 aparecen juntos en la misma tanda —cuatro
  // documentos seguidos contra un proveedor que se está cayendo dan las dos cosas— y el
  // que manda es el que explica la tanda, no el que aparece primero en la lista.
  if (/\b50[234]\b|unavailable|overloaded|high demand|service_unavailable/.test(todo)) {
    return 'El proveedor de IA está saturado en este momento (no es tu cuota ni tu key). Reintentá en un par de minutos.';
  }
  if (/resource_exhausted|insufficient_quota|quota|\b429\b|rate limit|rate_limit/.test(todo)) {
    return 'Se quedó sin cuota / límite de uso alcanzado por ahora.';
  }
  if (/\b401\b|\b403\b|invalid.*key|api key not valid|unauthorized/.test(todo)) {
    return 'La API key parece inválida o vencida.';
  }
  if (/timeout|abort|etimedout/i.test(todo)) {
    return 'No respondió a tiempo — puede ser una falla momentánea de conexión.';
  }
  return null;
}

export type MotivoIA = { hayIA: boolean; motivo: string | null; errores?: string[]; tema?: string };

/**
 * Los errores CRUDOS de la cascada, resumidos para que se puedan leer en pantalla.
 *
 * Existe porque el reporte que originó todo esto era una captura sin una sola pista:
 * ni qué proveedor, ni qué cuenta, ni qué contestó. Los `console.warn` que sí tenían
 * el dato viven en los logs de Vercel, que nadie mira y que a los 60 minutos no
 * existen — la misma regla que ya está escrita en AGENTS.md: **si el que se tiene
 * que enterar es el usuario, el aviso va donde él mira.**
 *
 * Se queda con el proveedor·cuenta y el núcleo del error, sin URLs ni JSON crudo.
 */
export function resumirErrores(errores: string[], max = 3): string {
  const vistos = new Set<string>();
  const partes: string[] = [];
  for (const e of errores) {
    const i = e.indexOf(':');
    const quien = (i > 0 ? e.slice(0, i) : e).trim();
    const que = (i > 0 ? e.slice(i + 1) : '').trim()
      .replace(/^chatCheap\w*\([^)]*\)\s*:?\s*/i, '')  // el prefijo ya está en `quien`
      .replace(/\s*·\s*modelos disponibles:.*$/i, '')  // la lista de modelos no le dice nada a nadie
      .replace(/https?:\/\/\S+/g, '')
      .trim();
    const linea = que ? `${quien}: ${que.slice(0, 90)}` : quien;
    if (vistos.has(linea)) continue;
    vistos.add(linea);
    partes.push(linea);
    if (partes.length >= max) break;
  }
  const resto = errores.length - partes.length;
  return partes.join(' · ') + (resto > 0 ? ` (+${resto} más)` : '');
}

/**
 * El mensaje honesto. `tema` es lo que se estaba haciendo ("generar las razones"),
 * en infinitivo o sustantivo — va adentro de la frase.
 *
 * La regla que ordena las variantes: **la salida propuesta tiene que coincidir con
 * la causa.** A una key vencida no la arregla esperar, y a una cuota agotada no la
 * arregla pegar otra key del mismo proveedor si ya tenés varias.
 */
export function mensajeIAFallo({ hayIA, motivo, errores = [], tema = 'esto' }: MotivoIA): string {
  const detalle = errores.length ? ` (${resumirErrores(errores)})` : '';

  // Nada conectado: es el ÚNICO caso donde pedir una key es la respuesta correcta.
  if (!hayIA) {
    return `No hay ninguna IA conectada, así que MaKo no puede ${tema}. Conectá una IA gratis para empezar — con Gemini alcanza.`;
  }
  if (motivo?.startsWith('Se quedó sin cuota')) {
    return `${motivo} Vuelve a andar cuando se reinicie (el free de Gemini reinicia cada día). Si no querés esperar: sumá otra cuenta del mismo proveedor o conectá otra IA gratis.${detalle}`;
  }
  if (motivo?.startsWith('La API key')) {
    return `${motivo} Pegá una nueva.${detalle}`;
  }
  if (motivo) {
    return `${motivo} Probá de nuevo en un momento.${detalle}`;
  }
  // Hay IA conectada y falló sin un motivo reconocible. Lo peor que se puede hacer
  // acá es decir "no hay IA": el usuario va a ir a conectar lo que ya tenía puesto.
  return `Tu IA está conectada pero no pudo ${tema} ahora mismo. Probá de nuevo en un momento.${detalle}`;
}
