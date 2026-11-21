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
  /**
   * Esta lámina usa una base que ya usó otra (un copy con más partes que láminas tiene el original): después del texto, un paso
   * aparte cambia la foto por ESTA escena (21/11/2026, la prueba del copy de Leila en producción: la 3 y la 8, la 4 y la 9 salían
   * con la misma). ⚠️ Pedirlo dentro del paso de texto («otra foto del mismo estilo») no sirvió: la IA conservó la escena.
   */
  otraFoto?: string | null;
};

/**
 * Las escenas para la foto de una lámina que repite base, en orden: neutras, de negocio y de ciudad, como las de los carruseles que
 * más se replican. Se elige por el número de la lámina.
 */
export const ESCENAS_OTRA_FOTO = [
  'a quiet city street at dusk with warm shop lights',
  'a wooden desk by a large window with a laptop and a coffee cup',
  'a modern office corner with plants and soft daylight',
  'a seaside promenade on a cloudy afternoon',
  'a calm café terrace with empty tables',
] as const;

/** El paso de la OTRA FOTO: la misma lámina con otra escena de fondo; el texto, la persona y la composición, iguales. */
export const promptDeOtraFoto = (escena: string): string =>
  `Replace only the background photo of this image with a different scene: ${escena}, with the same style, light, colors and mood, and the same darkening behind the text. Keep every text exactly as it is, letter by letter, in the same place, and keep any person in the same place and pose.`;

// Comillas RECTAS para marcar cada texto en el pedido: con «» la IA las dibujaba, y se confundía con las «» del propio copy (el de
// Leila trae «Publica todos los días»): salían «EL EFECTO PÉNDULO» y «PROTOCOLO ANTI-PÉNDULO» (21/11/2026).
const comillas = (s: string) => `"${s.replace(/\s+/g, ' ').trim()}"`;

/** Los cambios que de verdad cambian algo (uno igual a su original no se pide: la IA lo deja como está). */
export const cambiosReales = (cambios: readonly CambioDeTexto[]): CambioDeTexto[] =>
  cambios.filter((c) => c.antes.trim() && c.antes.replace(/\s+/g, ' ').trim() !== c.despues.replace(/\s+/g, ' ').trim());

/**
 * El prompt del paso de TEXTO: la imagen igual, y cada texto por el suyo, letra por letra, en el mismo lugar y con la misma letra.
 * `enOrden` (el segundo intento, cuando el primero no escribió bien): sin los originales, la lista de los textos nuevos de arriba
 * abajo (la IA principal a veces escribe el texto NUEVO en «original» y el par no se puede ubicar).
 */
export function promptDeTextos(cambios: readonly CambioDeTexto[], o: { enOrden?: readonly string[] } = {}): string {
  // ⚠️ Lo que se vio en producción con el copy de Leila (21/11/2026): la IA DIBUJABA las comillas del pedido («EL GIRO»), dejaba
  // textos del original que el pedido no nombraba («The hardest way to grow.», «The lesson.») y le sumaba al título el número del
  // original («3. POR FUERA»). Se dice que las comillas sólo marcan y que ningún otro texto puede quedar.
  const conserva = 'Keep this exact image: the same people, their faces, poses and clothes, the objects, the background, the colors, the layout and the typography.';
  const lugar = 'in the same places, with the same font, size and colors';
  const marcas = 'The straight quotation marks only show where each text starts and ends: never draw them (draw « » only where they are inside a text).';
  const nadaMas = 'No other text may remain in the image: any text not listed here is removed and the background continues where it was.';
  if (o.enOrden?.length) {
    return `${conserva} Only replace its text, ${lugar}. From top to bottom, the text must read exactly, letter by letter: ${o.enOrden.map(comillas).join(', ')}. ${marcas} ${nadaMas} Everything else stays exactly the same.`;
  }
  const reales = cambiosReales(cambios);
  const cambia = reales.filter((c) => c.despues.trim()).map((c) => `${comillas(c.antes)} becomes ${comillas(c.despues)}`);
  const saca = reales.filter((c) => !c.despues.trim()).map((c) => comillas(c.antes));
  // Lo que no cambia se NOMBRA (el @, el contador): si no, «ningún otro texto» también se lo llevaría.
  const quedan = cambios.filter((c) => c.antes.trim() && c.despues.trim() && !reales.includes(c)).map((c) => comillas(c.despues));
  return [
    conserva,
    cambia.length ? `Only change the text, letter by letter, ${lugar}: ${cambia.join('; ')}.` : '',
    saca.length ? `Remove the text ${saca.join(', ')} and continue the background where it was.` : '',
    quedan.length && (cambia.length || saca.length) ? `These texts stay exactly as they are: ${quedan.join(', ')}.` : '',
    cambia.length || saca.length ? `${marcas} ${nadaMas}` : '',
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

/**
 * Lo que SOBRA en lo leído: renglones que no son parte de ningún texto esperado (21/11/2026, el copy de Leila en producción: quedaban
 * «The hardest way to grow.» y «The lesson.» del original, y «3.» delante de «POR FUERA», y la revisión sólo miraba lo que FALTA).
 * Un renglón cuenta si, sin mayúsculas ni signos, no está dentro de los esperados juntos; se ignoran los del marco (un contador, un
 * @, un ©) y los de menos de 3 letras. Vuelve cada uno como «sobra: …», para el aviso y para reintentar.
 */
export function textoQueSobra(leido: string, esperados: readonly string[]): string[] {
  if (!esperados.length) return [];
  const todo = ` ${comparable(esperados.join(' '))} `;
  return leido.split(/\r?\n/).map((l) => l.trim()).filter((l) => {
    const x = comparable(l);
    if (x.replace(/[^\p{L}]/gu, '').length < 3) return false;
    if (/^\s*(\d{1,2}\s*(\/|of|de)\s*\d{1,2}|@[\w.]+|©.*)\s*$/i.test(l)) return false;
    return !todo.includes(` ${x} `);
  }).map((l) => `sobra: ${l}`);
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

/**
 * Sin un par «original → nuevo» que cambie algo, ¿se escribe igual? Sí si la lectura de la original dice que falta un texto, y
 * TAMBIÉN si no se pudo leer (`null`): saltearla entregaba la referencia tal cual, sin aviso (21/11/2026, Hormozi 5 y 6 en inglés).
 */
export const escribirSinPares = (faltan: readonly string[] | null): boolean => faltan === null || faltan.length > 0;

/** Las láminas que no se pudieron leer para revisar su texto: se dicen, nunca se entregan como «bien escritas». */
export function avisoDeLaminasSinLeer(laminas: readonly number[]): string | null {
  if (!laminas.length) return null;
  const cuales = laminas.length === 1 ? `la lámina ${laminas[0]}` : `las láminas ${laminas.slice(0, -1).join(', ')} y ${laminas[laminas.length - 1]}`;
  return `No pude leer ${cuales} para revisar su texto: ${laminas.length === 1 ? 'mírala' : 'míralas'} antes de publicar.`;
}

/** El aviso de las láminas que no quedaron bien escritas después de los reintentos (nunca se entregan calladas). */
export function avisoDeTextoQueFalta(faltan: ReadonlyArray<{ lamina: number; faltan: readonly string[] }>): string | null {
  const malas = faltan.filter((x) => x.faltan.length);
  if (!malas.length) return null;
  const una = (x: { lamina: number; faltan: readonly string[] }) => (x.faltan[0].startsWith("sobra: ") ? `en la lámina ${x.lamina} quedó «${x.faltan[0].slice(7, 67)}», que no es de tu copy` : `en la lámina ${x.lamina}, «${x.faltan[0].slice(0, 60)}»`);
  return `La IA de imagen no escribió bien ${malas.length === 1 ? 'un texto' : 'unos textos'} (${malas.slice(0, 3).map(una).join('; ')}): vuelve a generar ${malas.length === 1 ? 'esa lámina' : 'esas láminas'} antes de publicar.`;
}

/**
 * ¿La lámina tiene una persona? (21/11/2026, el carrusel de Ramiro: los cuadros que lista la IA principal no la marcaron en ninguna
 * lámina y Ramiro quedó en vez de Martín). Se pregunta lámina por lámina, con la imagen sola: una foto o un dibujo de alguien.
 */
export const PROMPT_HAY_PERSONA = 'Is there a person in this image (a photo, a drawing or a 3D figure of someone: their face or body)? A written name or a logo does not count. Return ONLY this JSON: {"persona": true} or {"persona": false}';

/** Lo que contestó la pregunta de la persona: true sólo con un sí claro. */
export const hayPersonaEn = (crudo: string | null | undefined): boolean => /"persona"\s*:\s*true/i.test(crudo ?? '');
