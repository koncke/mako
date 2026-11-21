// =============================================================================
// Regenerar una lámina con IA desde SU referencia: los prompts y la revisión del texto (PURO; 21/11/2026)
// =============================================================================
// Martín, 20/11/2026, sobre los 11 carruseles de ventas y los de Leila: «no salieron idénticos y tenían que salir realmente
// idénticos… eso lo tienes que hacer con inteligencia artificial, le tienes que pasar la referencia y pedirle a la IA que cambie
// al personaje o a los textos». La plancha (./plancha-local.ts: borrar las letras y escribir encima) no puede con un titular
// enorme sobre una foto ni con las poses: la IA de imagen sí. Medido el 21/11 con Nano Banana Pro por ApiMart: la portada de
// «9 YOUTUBE COURSES» salió con el mismo Hormozi, el edificio, el degradé y la pastilla violeta, y «9 AGENTES DE IA» con sus
// tildes, en 37 s y por US$0,02.
//
// Las reglas de la casa (memorias `una-referencia-prompt-simple` y `carruseles-replica-con-ia`):
//   · la BASE es la lámina original y el prompt dice lo ÚNICO que cambia: los textos (cada «original» por su «nuevo»);
//   · la persona es OTRO paso, con UNA referencia (la foto o el personaje del negocio), y hace lo mismo que la del original;
//   · nunca más de dos pasos seguidos sobre una lámina;
//   · el texto nuevo se LEE en la imagen que salió (`textoQueFalta`), y una lámina con una palabra mal escrita se vuelve a generar.
// =============================================================================

/** Un texto que cambia: lo que dice la lámina original y lo que tiene que decir. `despues` vacío = se saca. */
export type CambioDeTexto = { antes: string; despues: string };

/** Lo que se le pide a la IA para una lámina, y lo que tiene que quedar escrito en ella. */
export type PedidoDeLamina = {
  /** La lámina original (http(s) o data:image): la BASE, lo que se conserva. */
  base: string;
  cambios: readonly CambioDeTexto[];
  /** La persona del negocio que entra en lugar de la del original (la segunda referencia), o null (queda la del original). */
  persona: string | null;
};

const comillas = (s: string) => `«${s.replace(/\s+/g, ' ').trim()}»`;

/** Los cambios que de verdad cambian algo (uno igual a su original no se pide: la IA lo deja como está). */
export const cambiosReales = (cambios: readonly CambioDeTexto[]): CambioDeTexto[] =>
  cambios.filter((c) => c.antes.trim() && c.antes.replace(/\s+/g, ' ').trim() !== c.despues.replace(/\s+/g, ' ').trim());

/**
 * El prompt del paso de TEXTO: la imagen igual, y cada texto por el suyo, letra por letra, en el mismo lugar y con la misma letra.
 * `enOrden` (el segundo intento, cuando el primero no escribió bien): sin los originales, la lista de los textos nuevos de arriba
 * abajo (la IA principal a veces escribe el texto NUEVO en «original» y el par no se puede ubicar).
 */
export function promptDeTextos(cambios: readonly CambioDeTexto[], o: { enOrden?: readonly string[] } = {}): string {
  const conserva = 'Keep this exact image: the same people, their faces, poses and clothes, the objects, the background, the colors, the layout and the typography.';
  const lugar = 'in the same places, with the same font, size and colors';
  if (o.enOrden?.length) {
    return `${conserva} Only replace its text, ${lugar}. From top to bottom, the text must read exactly, letter by letter: ${o.enOrden.map(comillas).join(', ')}. Everything else stays exactly the same.`;
  }
  const reales = cambiosReales(cambios);
  const cambia = reales.filter((c) => c.despues.trim()).map((c) => `${comillas(c.antes)} becomes ${comillas(c.despues)}`);
  const saca = reales.filter((c) => !c.despues.trim()).map((c) => comillas(c.antes));
  return [
    conserva,
    cambia.length ? `Only change the text, letter by letter, ${lugar}: ${cambia.join('; ')}.` : '',
    saca.length ? `Remove the text ${saca.join(', ')} and continue the background where it was.` : '',
    'Everything else stays exactly the same.',
  ].filter(Boolean).join(' ');
}

/**
 * El prompt del paso de la PERSONA (con la persona del negocio como segunda imagen): la misma pose, la misma acción y el mismo
 * lugar que la del original; su cara, su pelo y su ropa como en la segunda imagen; el texto y todo lo demás, igual.
 */
export const PROMPT_DE_PERSONA = 'Replace the person in the first image with the person in the second image, doing exactly the same pose and action, in the same place, at the same size and with the same light. Their face, hair and clothes are exactly as in the second image. Keep all the text and everything else exactly the same.';

/** Lo que tiene que quedar escrito: los textos nuevos (sin los que se sacan). */
export const textosEsperados = (cambios: readonly CambioDeTexto[]): string[] =>
  cambios.map((c) => c.despues.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Para comparar lo leído: sin mayúsculas, sin signos ni espacios de más; las tildes y la ñ CUENTAN (una tilde que falta es un error). */
const comparable = (s: string) => s.normalize('NFC').toLocaleLowerCase('es').replace(/[«»"“”'‘’.,:;!¡?¿()…\-–—*_/\\|]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Los textos esperados que NO aparecen en lo que se leyó de la imagen (vacío = está todo bien escrito). Se busca cada texto entero
 * en todo lo leído junto (la IA de imagen corta los renglones donde quiere), sin mayúsculas ni signos, con las tildes.
 */
export function textoQueFalta(leido: string, esperados: readonly string[]): string[] {
  const todo = ` ${comparable(leido)} `;
  return esperados.filter((e) => {
    const x = comparable(e);
    return x && !todo.includes(` ${x} `);
  });
}

/** El prompt para LEER el texto de la imagen generada (la IA del negocio, con visión): todo, tal cual, renglón por renglón. */
export const PROMPT_LEER_TEXTO = 'Transcribe EXACTLY every piece of text you see in this image, letter by letter, keeping accents and capital letters, from top to bottom. Do not fix spelling and do not translate. Return ONLY this JSON: {"lineas":["…","…"]}';

/** Lo que devolvió la lectura, como un texto (las líneas juntas); vacío si no se entiende. */
export function leidoDe(crudo: string): string {
  const m = /\{[\s\S]*\}/.exec(crudo ?? '');
  if (!m) return '';
  try {
    const j = JSON.parse(m[0]) as { lineas?: unknown };
    return Array.isArray(j.lineas) ? j.lineas.filter((x) => typeof x === 'string').join('\n') : '';
  } catch { return ''; }
}

/** Cuántas veces se genera una lámina como mucho para que quede bien escrita (el primero y dos más). */
export const INTENTOS_POR_LAMINA = 3;

/**
 * El diseño de un carrusel regenerado: una página por lámina, con la imagen que salió de fondo (el texto va DENTRO de la imagen,
 * como en la referencia: Martín, 20/11). En las notas de la primera, de dónde salió (como toda réplica: `doc.pages[0].notes`).
 */
export function documentoRegenerado(o: { srcs: readonly string[]; ancho: number; alto: number; notas?: string; nuevoId: () => string }): Record<string, unknown> {
  const n = o.srcs.length;
  return {
    schemaVersion: 1, width: o.ancho, height: o.alto, unit: 'px',
    pages: o.srcs.map((src, i) => ({
      id: o.nuevoId(), name: n === 1 ? 'Lámina' : i === 0 ? 'Portada' : i === n - 1 ? 'Cierre' : `Lámina ${i + 1}`,
      background: { type: 'image', src, fit: 'cover' }, objects: [],
      ...(i === 0 && o.notas ? { notes: o.notas } : {}),
    })),
  };
}

/** El aviso de las láminas que no quedaron bien escritas después de los reintentos (nunca se entregan calladas). */
export function avisoDeTextoQueFalta(faltan: ReadonlyArray<{ lamina: number; faltan: readonly string[] }>): string | null {
  const malas = faltan.filter((x) => x.faltan.length);
  if (!malas.length) return null;
  const una = (x: { lamina: number; faltan: readonly string[] }) => `en la lámina ${x.lamina}, «${x.faltan[0].slice(0, 60)}»`;
  return `La IA de imagen no escribió bien ${malas.length === 1 ? 'un texto' : 'unos textos'} (${malas.slice(0, 3).map(una).join('; ')}): vuelve a generar ${malas.length === 1 ? 'esa lámina' : 'esas láminas'} antes de publicar.`;
}
