// =============================================================================
// cierre-tarjeta — la prueba de un cierre, y el renglón que deja en el historial (puro)
// =============================================================================
// SIN `server-only` a propósito: lo importan el saneo del borrador (lib/plan-propuesta.ts),
// los dos escritores del renglón (el tablero del super admin en lib/plan-board.ts y el de cada
// cliente en lib/plan-propuesta.ts), la definición de la API de MaKo
// (lib/api-mako/areas/plan.def.ts, que no puede importar nada con `server-only`) y el test.
//
// ⚠️ HABÍA DOS TOPES Y NINGUNO DECÍA QUE CORTABA (medido el 06/10/2026). El borrador aceptaba
// una prueba de hasta 400 caracteres, y el cierre escribía `MaKo la marcó hecha: <prueba>` y
// cortaba el renglón ENTERO en 240 —con el prefijo adentro, 219 para la prueba—. Una prueba de
// 220 a 400 pasaba el saneo, se aplicaba sin error y quedaba partida a la mitad en la tarjeta:
// en el borrador del Chatbot eran 3 de 16. Y el 240 no protegía nada: ningún mapper recorta el
// texto de un renglón y la pantalla lo dibuja entero, con salto de línea.
//
// Ahora es UN tope, el que la persona vio al confirmar: lo que aparece en /plan/revisar es lo
// que queda en el historial, letra por letra. Y si algo pasa del tope —un modelo que escribió
// de más—, el corte se VE: termina en «…», no a mitad de palabra como si estuviera completo.

/** Lo más largo que puede ser la prueba de un cierre, en el borrador y en el historial. */
export const TOPE_PRUEBA_CIERRE = 400;

/** La prueba, dentro del tope. Si hubo que cortarla, termina en «…». */
export function recortarPrueba(prueba: string): string {
  const t = (prueba ?? '').trim();
  if (t.length <= TOPE_PRUEBA_CIERRE) return t;
  return `${t.slice(0, TOPE_PRUEBA_CIERRE - 1).trimEnd()}…`;
}

/**
 * El renglón del historial de un cierre. El prefijo NO le come lugar a la prueba: se recorta la
 * prueba, nunca el renglón entero.
 *
 * ⚠️ El texto del prefijo lo leen otros: `MARCA_AUTO` en lib/todo-seeds.ts busca «MaKo la marcó
 * hecha» para reconocer los cierres automáticos.
 */
export function renglonDeCierre(prueba: string, parcial: boolean): string {
  return `${parcial ? 'MaKo la dejó a medias' : 'MaKo la marcó hecha'}: ${recortarPrueba(prueba)}`;
}
