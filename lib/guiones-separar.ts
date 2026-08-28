// =============================================================================
// guiones-separar — de un pegote de texto a guiones sueltos
// =============================================================================
// SIN `server-only`: es todo determinista y necesita test. Un separador que se
// equivoca no rompe nada visible —guarda algo, y ese algo parece un guion—, así
// que el único modo de saber que funciona es probarlo.
//
// ── Por qué esto existe ─────────────────────────────────────────────────────
// El dueño trae sus guiones en un .md que escribió a mano, con cinco adentro y
// dos de ellos DUPLICADOS. Y lo dijo como regla, no como excepción: «cualquier
// usuario puede hacer eso, cargar algo así de desordenado, MaKo lo tiene que
// ordenar y separar los guiones».
//
// ⚠️ Esto NO usa IA a propósito. Separar por encabezados es determinista, se
// testea, y no puede alucinar un guion que no estaba ni perder uno que sí. Un
// modelo haría lo mismo peor, más lento y sin garantías — y para lo único donde
// un modelo sí aportaría (juzgar si el guion le sirve al negocio) está el camino
// de REVISIÓN, que es otra cosa y todavía no existe.

/** Un guion encontrado adentro del pegote. */
export type GuionSeparado = {
  titulo: string;
  texto: string;
  palabras: number;
  /**
   * `true` si su texto ya apareció antes en el mismo pegote.
   *
   * NO se descarta solo: se marca. Que dos guiones sean iguales puede ser un
   * copy-paste al armar el archivo —lo más probable— o dos versiones que el
   * dueño quiere tener. Quien decide es él; lo que no puede pasar es que se
   * cargue dos veces sin que nadie se entere.
   */
  duplicado: boolean;
};

/**
 * Los encabezados que abren un guion.
 *
 * Se aceptan tres formas porque las tres aparecen cuando alguien escribe a mano:
 * markdown (`# Guion 1: …`), numeración suelta (`Guion 3 —`) y separadores de
 * línea (`---`). Lo que NO se hace es partir por líneas en blanco: un guion tiene
 * párrafos, y eso lo haría pedazos.
 */
const ENCABEZADO = /^\s{0,3}(?:#{1,6}\s+|\*\*)?\s*gui[oó]n\s*\.?\s*\d*\s*[:.\-–—]?\s*(.*?)\s*\**\s*$/i;
const SOLO_MARKDOWN = /^\s{0,3}#{1,6}\s+(.+?)\s*$/;
const SEPARADOR = /^\s*(?:-{3,}|_{3,}|\*{3,}|={3,})\s*$/;

/** Normaliza para COMPARAR, nunca para guardar. */
function huella(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // sin acentos: «guion» y «guión» son el mismo
    .replace(/[^\p{L}\p{N}]+/gu, ' ')                   // sin puntuación ni markdown
    .trim();
}

function contar(texto: string): number {
  return texto.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}

/**
 * Parte un texto en los guiones que tenga adentro.
 *
 * Si no encuentra ninguna marca de separación, devuelve UN solo guion con todo:
 * un texto sin encabezados es un guion, no un error. Devolver vacío ahí sería
 * decirle a alguien que su guion no existe.
 *
 * @param minPalabras piso para que un bloque cuente como guion. Un encabezado
 *   suelto con dos líneas debajo no es un guion, es un título huérfano.
 */
export function separarGuiones(crudo: string, minPalabras = 25): GuionSeparado[] {
  const texto = crudo.replace(/\r\n?/g, '\n').trim();
  if (!texto) return [];

  const lineas = texto.split('\n');

  // Primero se busca dónde ARRANCA cada guion. Se prefiere el encabezado que dice
  // «guion» explícito; si no hay ninguno, se cae a cualquier encabezado markdown.
  const conGuion: number[] = [];
  const conMarkdown: number[] = [];
  const separadores: number[] = [];
  const titulos = new Map<number, string>();

  lineas.forEach((l, i) => {
    const g = ENCABEZADO.exec(l);
    if (g) { conGuion.push(i); titulos.set(i, (g[1] || '').trim()); return; }
    const m = SOLO_MARKDOWN.exec(l);
    if (m) { conMarkdown.push(i); titulos.set(i, (m[1] || '').trim()); return; }
    if (SEPARADOR.test(l)) separadores.push(i);
  });

  const cortes = conGuion.length >= 2 ? conGuion
    : conMarkdown.length >= 2 ? conMarkdown
      : separadores.length >= 1 ? separadores
        : [];

  // Sin cortes: todo el pegote es UN guion.
  if (cortes.length === 0) {
    const t = texto.trim();
    return contar(t) >= minPalabras
      ? [{ titulo: '', texto: t, palabras: contar(t), duplicado: false }]
      : [];
  }

  // Lo que hay ANTES del primer corte también puede ser un guion (un archivo que
  // arranca sin encabezado y recién después los usa).
  const inicios = cortes[0] > 0 ? [-1, ...cortes] : cortes;

  const vistos = new Set<string>();
  const out: GuionSeparado[] = [];

  for (let k = 0; k < inicios.length; k++) {
    const desde = inicios[k];
    const hasta = k + 1 < inicios.length ? inicios[k + 1] : lineas.length;

    // La línea del encabezado no va en el cuerpo; la de un separador tampoco.
    const cuerpo = lineas.slice(desde + 1, hasta).join('\n').trim();
    if (!cuerpo) continue;

    const palabras = contar(cuerpo);
    if (palabras < minPalabras) continue;

    const h = huella(cuerpo);
    const duplicado = vistos.has(h);
    vistos.add(h);

    out.push({
      titulo: desde >= 0 ? (titulos.get(desde) ?? '') : '',
      texto: cuerpo,
      palabras,
      duplicado,
    });
  }

  return out;
}
