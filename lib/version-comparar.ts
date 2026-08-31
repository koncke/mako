// =============================================================================
// Comparar dos versiones «a.b.c»
// =============================================================================
// Módulo propio, sin React y sin `server-only`, por una razón concreta: la GEMELA
// de esta función vive en `extension/background.js` y decide si la extensión se
// reinicia sola. La extensión no tiene bundler, así que no puede importar de acá
// y la copia es inevitable — lo que no es inevitable es que se separen sin que
// nada avise.
//
// `tests/extension-version.test.ts` extrae la de la extensión del fuente REAL y
// corre las dos contra los mismos casos. Para eso esta tiene que ser importable
// desde un test, o sea vivir fuera de un componente cliente.

/**
 * ¿`a` es una versión anterior a `b`?
 *
 * ⚠️ Número por número, NUNCA como texto: `'0.10.0' < '0.6.0'` es TRUE en orden
 * alfabético. Es el error que aparece exactamente el día que la segunda cifra
 * pasa de un dígito a dos, o sea meses después de escribirlo y sobre una
 * comparación que venía funcionando.
 *
 * Y ORDENADA, no una igualdad. Un `!==` da verdadero TAMBIÉN cuando la instalada
 * va ADELANTE de lo que sirve producción —la máquina de desarrollo, los minutos
 * entre el push y el deploy, y para siempre si el build falló—, y del lado de la
 * extensión cada uno de esos casos es un reinicio que deja la pestaña muda.
 */
export function esMasVieja(a: string, b: string): boolean {
  const na = String(a || '').split('.').map((n) => Number(n) || 0);
  const nb = String(b || '').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const x = na[i] ?? 0;
    const y = nb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
