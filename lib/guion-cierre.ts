// =============================================================================
// guion-cierre — qué parte del guion NO se puede tocar
// =============================================================================
// SIN `server-only`: determinista y con test.
//
// ── La distinción que hace falta ────────────────────────────────────────────
// El dueño, sobre el plan que salió reescrito: *«si me gusta que le puso el
// acento de Mauricio y sus muletillas, eso sí está muy bien, pero que le cambie
// el CTA, para nada»*.
//
// O sea: adaptar la FORMA es una feature —el guion lo dice una persona real a
// cámara, y suena falso si está escrito como se escribe—; cambiar el FONDO no.
// Y dentro del fondo hay una parte que no admite ni un matiz: **el cierre**.
// Un CTA cambiado manda a la gente a un paso del embudo que puede no existir
// —«te mando los detalles por el formulario» cuando el negocio manda a un
// video—, y eso no se nota leyendo el guion: se nota cuando nadie llega.
//
// Este módulo contesta una sola pregunta: ¿dónde empieza el cierre?

/** Los rótulos que abren el bloque de cierre en el catálogo de estructuras. */
const ROTULOS_CIERRE = new Set(['CTA', 'ACCION', 'ACCIÓN', 'LLAMADO', 'CIERRE']);

const esRotulo = (l: string) => l.length > 0 && l.length <= 24 && /\p{L}/u.test(l) && l === l.toUpperCase();

/**
 * El texto del CIERRE de un guion.
 *
 * Dos caminos, y el orden importa:
 *
 *  1. **Por rótulo.** Si el guion pasó por MaKo tiene sus bloques marcados
 *     (`lib/guion-estructuras.ts`) y el cierre está declarado. Es el camino
 *     bueno: lo dice el guion, no lo adivina nadie.
 *  2. **Por la última frase.** Un guion sin rótulos igual tiene cierre — es la
 *     última cosa que se dice. Se toman las últimas oraciones mientras entren en
 *     `minPalabras`, porque un CTA suele ser dos frases («te explico cómo… / da
 *     click en el enlace») y quedarse con una sola dejaría la mitad adaptable.
 *
 * Devuelve '' cuando no hay nada que proteger (guion vacío).
 */
export function cierreDeGuion(texto: string, minPalabras = 12): string {
  const lineas = (texto || '').replace(/\r\n?/g, '\n').split('\n');

  // ── 1. Por rótulo ─────────────────────────────────────────────────────────
  let desde = -1;
  lineas.forEach((l, i) => {
    const t = l.trim();
    if (esRotulo(t) && ROTULOS_CIERRE.has(t.replace(/[:：]$/, ''))) desde = i;
  });
  if (desde >= 0) {
    const cuerpo = lineas.slice(desde + 1).filter((l) => !esRotulo(l.trim())).join(' ').replace(/\s+/g, ' ').trim();
    if (cuerpo) return cuerpo;
  }

  // ── 2. Por la última frase ────────────────────────────────────────────────
  const plano = lineas.filter((l) => !esRotulo(l.trim())).join(' ').replace(/\s+/g, ' ').trim();
  if (!plano) return '';

  const frases = plano.split(/(?<=[.!?…]["»”')\]]?)\s+/).filter(Boolean);
  const salida: string[] = [];
  let palabras = 0;
  for (let i = frases.length - 1; i >= 0; i--) {
    salida.unshift(frases[i]);
    palabras += frases[i].split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
    if (palabras >= minPalabras) break;
  }
  return salida.join(' ');
}

/**
 * Qué tomas del reparto caen dentro del cierre.
 *
 * Se resuelve CONTANDO PALABRAS desde el final y no buscando el texto, porque el
 * reparto ya garantiza que las tomas son el guion partido en orden y sin perder
 * nada: las últimas N palabras están, por construcción, en las últimas tomas.
 * Buscar por texto fallaría justo cuando el cierre queda partido entre dos.
 *
 * Devuelve los índices (0-based) de las tomas que hay que dejar LITERALES.
 * Siempre incluye la última: un guion sin cierre reconocible igual termina en
 * algún lado, y esa última frase es lo que la persona dice antes de que corte.
 */
export function tomasDelCierre(tomas: { palabras: number }[], palabrasDelCierre: number): Set<number> {
  const out = new Set<number>();
  if (tomas.length === 0) return out;

  out.add(tomas.length - 1);
  let acumulado = tomas[tomas.length - 1].palabras;

  for (let i = tomas.length - 2; i >= 0 && acumulado < palabrasDelCierre; i--) {
    out.add(i);
    acumulado += tomas[i].palabras;
  }
  return out;
}

/** Palabras con contenido: sin artículos, preposiciones ni muletillas. */
const VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'a', 'al',
  'en', 'y', 'o', 'que', 'se', 'lo', 'le', 'les', 'su', 'sus', 'por', 'para',
  'con', 'sin', 'no', 'si', 'ya', 'es', 'ser', 'esta', 'este', 'esto', 'esa',
  'ese', 'eso', 'te', 'tu', 'tus', 'me', 'mi', 'mis', 'pero', 'como', 'mas',
  'muy', 'todo', 'toda', 'todos', 'todas', 'hay', 'ha', 'he', 'mira', 'pues',
  'entonces', 'ver', 'bien', 'verdad', 'nomas', 'ahi', 'asi', 'cuando', 'donde',
]);

const contenido = (t: string): Set<string> => new Set(
  t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !VACIAS.has(w)),
);

/**
 * Cuánto se alejó una toma adaptada de lo que decía el guion, de 0 a 1.
 *
 * Mide solo palabras con CONTENIDO: agregar «mira», «pues» o «la verdad» es
 * justamente la adaptación que se quiere, y no puede contar como desvío. Lo que
 * sí cuenta es que desaparezcan los sustantivos y verbos del original.
 *
 * 1 = dice lo mismo. 0 = no quedó nada en común.
 */
export function fidelidad(original: string, adaptada: string): number {
  const A = contenido(original);
  const B = contenido(adaptada);
  if (A.size === 0) return 1;
  let juntas = 0;
  for (const w of A) if (B.has(w)) juntas++;
  return juntas / A.size;
}
