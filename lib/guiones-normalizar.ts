// =============================================================================
// guiones-normalizar — sacarle el formato de archivo a un guion pegado
// =============================================================================
// SIN `server-only`: es determinista y necesita test. Va aparte de
// `guiones-separar` porque son dos preguntas distintas —«¿cuántos guiones hay
// aquí?» y «¿cómo se ve cada uno?»— y mezclarlas haría que tocar una rompa la
// otra.
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// El dueño cargó sus guiones desde un .md y quedaron guardados TAL CUAL venían:
// con `**negrita**` en el medio del texto, una línea en blanco entre cada frase
// y viñetas de markdown. Textual: «no normalizó y formateó el texto, eso es
// importante».
//
// Y no es solo estética. Ese texto se le manda al modelo que arma el plan de
// tomas: los asteriscos entran al prompt como si fueran parte de lo que hay que
// decir a cámara, y lo que se dice a cámara es lo que termina en el audio.
//
// ── Lo que NO hace ──────────────────────────────────────────────────────────
// No junta las frases en párrafos. En un guion los cortes de línea son el RITMO
// con el que se lee a cámara: unirlos sería reescribir cómo se dice, no cómo se
// ve. Se sacan las líneas en blanco de más, no las de menos.
//
// Tampoco toca comillas tipográficas ni puntos suspensivos: son español correcto
// y quien los escribió los eligió.

/** Caracteres invisibles que viajan pegados a un copy-paste de Word o de la web. */
const INVISIBLES = /[​-‍﻿⁠]/g;

/**
 * Le saca a un guion todo lo que era formato de ARCHIVO y no texto del guion.
 *
 * El orden importa: primero las líneas (encabezados, viñetas, citas), después lo
 * que está adentro de una línea (negritas, links, código), y al final los
 * espacios. Al revés, un `**` al principio de una línea se confundiría con una
 * viñeta.
 */
export function normalizarGuion(crudo: string): string {
  if (!crudo) return '';

  let t = crudo.replace(/\r\n?/g, '\n').replace(INVISIBLES, '');

  t = t
    .split('\n')
    .map((linea) => {
      let l = linea;
      // Encabezado markdown suelto adentro del cuerpo.
      l = l.replace(/^\s{0,3}#{1,6}\s+/, '');
      // Cita. Puede venir anidada («> > »).
      l = l.replace(/^\s{0,3}(?:>\s?)+/, '');
      // Viñeta o numeración. La numeración solo si va seguida de espacio: «2024.»
      // al principio de una frase no es una lista.
      l = l.replace(/^\s{0,3}[-*+•]\s+/, '');
      l = l.replace(/^\s{0,3}\d{1,3}[.)]\s+/, '');
      // Regla horizontal: era un separador del archivo, no una línea del guion.
      if (/^\s*(?:-{3,}|_{3,}|\*{3,}|={3,})\s*$/.test(l)) return '';
      return l;
    })
    .join('\n');

  // Imágenes primero: `![alt](url)` empieza igual que un link y si va después
  // queda el `!` colgado.
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Énfasis. Los dobles antes que los simples, o `**x**` queda como `*x*`.
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  t = t.replace(/__([^_\n]+)__/g, '$1');
  t = t.replace(/(?<![\p{L}\p{N}])\*([^*\n]+)\*(?![\p{L}\p{N}])/gu, '$1');
  t = t.replace(/(?<![\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])/gu, '$1');
  // Tachado y código en línea.
  t = t.replace(/~~([^~\n]+)~~/g, '$1');
  t = t.replace(/`([^`\n]+)`/g, '$1');
  // Escapes de markdown que quedaron sueltos: `\*` era un asterisco literal.
  t = t.replace(/\\([*_`~[\]()#>\\])/g, '$1');

  return t
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/, ''))
    .join('\n')
    // Tres o más saltos = una línea en blanco. Una sola línea en blanco separa
    // frases; tres son el archivo respirando, no el guion.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * La huella de lo que un guion DICE.
 *
 * Ignora mayúsculas, acentos, puntuación, saltos de línea y —esto es lo que la
 * hace útil— los rótulos de sección. Dos guiones con el mismo texto tienen la
 * misma huella aunque uno esté sin formatear y el otro ya ordenado por MaKo en
 * GANCHO / HISTORIA / CTA.
 *
 * Por eso se puede comparar un guion recién pegado contra uno que ya se grabó:
 * lo que se grabó fueron las palabras, no el formato.
 *
 * ⚠️ Se usa SOLO para comparar, nunca para guardar ni para mostrar.
 */
export function huellaGuion(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => {
      const s = l.trim();
      if (!s) return false;
      // Mismo criterio que `soloHablado` de puestas-data: un rótulo es corto y
      // está entero en mayúscula. Si los dos criterios se separan, un guion
      // ordenado dejaría de reconocerse contra el mismo guion sin ordenar.
      return !(s.length <= 24 && /\p{L}/u.test(s) && s === s.toUpperCase());
    })
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
