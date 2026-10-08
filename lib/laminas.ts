// =============================================================================
// laminas — las portadas DISEÑADAS de un módulo: qué diseños hay y qué se guarda
// =============================================================================
// Pedido de Martín (07/10/2026), item 5 de los 19 del curso tipo Skool: «Las portadas de 01 .
// Bienvenida que están diseñadas por nosotros, deberían aparecer también en la selección de
// portadas, sino, cambio la portada de 1, y luego ya no aparecen… Y se debería poder editar el
// texto que aparece debajo del número, por defecto es igual que el título… Para que puedan elegir,
// que todos tengan la misma lógica, que se pueda editar los colores y el texto. Ten cuidado de
// poner un límite de caracteres, para que no rompan el diseño de la portada.»
//
// Una lámina es UN string, en la misma columna que el resto de las portadas (lib/portadas.ts:
// `grad:<id>` o una foto), con un prefijo propio:
//
//     lam:<diseño>:<A>:<B>:<texto>
//
//   diseño  un id del catálogo CERRADO de acá abajo (`DISENOS_LAMINA`).
//   A, B    dos colores, en seis cifras hex MAYÚSCULAS y SIN el «#». A es el protagonista del
//           diseño (el pizarrón, la nota, el plano) y B el acento (la tiza, la chinche, la cinta).
//           Qué pinta cada uno lo dice el catálogo (`colorA` / `colorB`), y es lo que rotula el
//           selector.
//   texto   lo que va debajo del número, con `encodeURIComponent`: UNA línea, con el tope del
//           diseño. VACÍO = el nombre del módulo, que es el default que pidió Martín («por defecto
//           es igual que el título»). Vacío y no una copia del nombre a propósito: renombrar el
//           módulo tiene que cambiar la lámina, y una copia se quedaría con el nombre viejo.
//
// ⚠️ LOS COLORES SE GUARDAN COMO SE ELIGIERON, y la legibilidad se resuelve AL DIBUJAR
//    (app/_cursos/laminas/comun.tsx, `tintaSobre`): cada diseño elige la tinta del texto según el
//    fondo que le tocó. Guardarlos ya «corregidos» ataría las filas a la regla del día en que se
//    eligieron; así, si la regla cambia, cambia para todas sin migrar nada.
//
// ⚠️ SIN `server-only` A PROPÓSITO: la importan el selector (navegador), el saneo de lo que se
//    guarda (lib/curso-estilo.ts, server) y los tests. Sólo sabe de FORMA: el dibujo vive en
//    app/_cursos/laminas/, y esta lib no lo importa (lo que dibuja depende de React; lo que se
//    guarda no puede depender de eso).
//
// ⚠️ Y NO IMPORTA lib/curso-estilo.ts, que la importa a ella para sanear: el ciclo se cerraría
//    solo. Por eso el normalizador de un hex vive acá (`hexLamina`) y no se reusa `hexValido`.

/** Lo que dice una lámina, ya saneado. `a` y `b` van con «#» (`#RRGGBB`), listos para pintar. */
export type ValorLamina = { diseno: string; a: string; b: string; texto: string };

/** Un diseño del catálogo: lo que hace falta para guardarlo y para ofrecerlo, sin el dibujo. */
export type DisenoLamina = {
  /** Lo que se guarda en el valor. Minúsculas, sin `:` (es el separador). */
  id: string;
  /** El nombre que se lee en el `title` del selector. */
  nombre: string;
  /**
   * El tope del texto, en caracteres (puntos de código, no unidades UTF-16: una «ñ» es una).
   * Medido para cada diseño con el texto MÁS LARGO permitido (tests/laminas.test.ts): con este
   * tope el reparto en renglones entra en la caja del diseño sin bajar del piso de lectura.
   */
  tope: number;
  /** El color A por default, `#RRGGBB`. */
  a: string;
  /** El color B por default, `#RRGGBB`. */
  b: string;
  /** Qué pinta A, para el rótulo del selector (una o dos palabras). */
  colorA: string;
  /** Qué pinta B. */
  colorB: string;
};

export const PREFIJO_LAMINA = 'lam:';

/** El cuaderno de siempre: es lo que se ve cuando nadie eligió otra portada. */
export const DISENO_DEFAULT = 'cuaderno';

/**
 * EL CATÁLOGO, cerrado. Agregar un diseño es una fila acá Y su dibujo en
 * app/_cursos/laminas/index.tsx; el test falla si una de las dos mitades falta.
 *
 * ⚠️ Los dos colores del cuaderno son los limas que se MIDIERON en las láminas del origen y viven
 *    en app/conocimientos/PortadaModulo.tsx (`LIMA_BROCHA`, `LIMA_STICKER`). Están copiados acá
 *    porque una lib no importa un componente; el test compara las dos copias.
 */
export const DISENOS_LAMINA: readonly DisenoLamina[] = [
  { id: 'cuaderno', nombre: 'Cuaderno', tope: 36, a: '#DCF35F', b: '#D5F240', colorA: 'Resaltador', colorB: 'Sticker' },
  { id: 'pizarra', nombre: 'Pizarra', tope: 34, a: '#2E4A3B', b: '#F4D35E', colorA: 'Pizarrón', colorB: 'Tiza' },
  { id: 'nota', nombre: 'Nota adhesiva', tope: 30, a: '#FFE66D', b: '#E4572E', colorA: 'Nota', colorB: 'Chinche' },
  { id: 'kraft', nombre: 'Cinta y kraft', tope: 32, a: '#C29B6D', b: '#7FB7BE', colorA: 'Cartón', colorB: 'Cinta' },
  { id: 'plano', nombre: 'Plano', tope: 34, a: '#1D4E89', b: '#FFD166', colorA: 'Plano', colorB: 'Marcador' },
  { id: 'poster', nombre: 'Póster', tope: 36, a: '#FF5A36', b: '#141414', colorA: 'Fondo', colorB: 'Número' },
  { id: 'entrada', nombre: 'Entrada', tope: 30, a: '#F6E7C8', b: '#C2412D', colorA: 'Entrada', colorB: 'Sello' },
];

/**
 * ⚠️ UN `Map`, NUNCA un objeto indexado con lo que llega: `porId['constructor']` en un objeto común
 *    devuelve la función `Object`, y `'__proto__'` el prototipo — los dos «existen» sin estar en el
 *    catálogo. Es el mismo bug que lib/curso-estilo.ts encontró con una etapa llamada «Constructor».
 */
const POR_ID: ReadonlyMap<string, DisenoLamina> = new Map(DISENOS_LAMINA.map((d) => [d.id, d]));

/** El diseño de un id, o `null` si no es uno del catálogo. */
export function disenoLamina(id: unknown): DisenoLamina | null {
  return typeof id === 'string' ? POR_ID.get(id) ?? null : null;
}

/** ¿Este valor de portada es una lámina? (sólo la forma: si está bien, lo dice `leerLamina`). */
export const esLamina = (v: unknown): boolean => typeof v === 'string' && v.startsWith(PREFIJO_LAMINA);

/** `#rgb` o `#rrggbb` (con o sin «#») a `#RRGGBB`; `null` si no es un color. */
export function hexLamina(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toUpperCase()}` : null;
}

/**
 * Lo que no se puede dibujar en una línea de una portada: los pictogramas (sale tofu en la tipografía
 * del diseño y su ancho no se puede estimar, que es de lo que depende que el texto no se salga) y los
 * caracteres de control. Va con escapes y no con los bytes crudos (AGENTS.md: un byte invisible en el
 * fuente hace que ripgrep declare el archivo binario).
 *
 * ⚠️ Y LOS SURROGATES SUELTOS (`\p{Cs}`), que no se dibujan y además hacen TIRAR a
 *    `encodeURIComponent` («URI malformed»). Sin esto `valorDeLamina` —que promete no fallar
 *    nunca— tiraba, y con él `sanearAjuste` en el server (un `lam:` armado a mano con medio emoji)
 *    y el efecto del selector que arma lo pendiente: el árbol entero se desmontaba. Medido en la
 *    revisión del 08/10/2026 con un arnés en Chrome: el campo con medio emoji dejaba la pantalla
 *    sin selector. Llega así cuando se pega un texto cortado a la mitad de un emoji.
 */
const NO_DIBUJABLE = /[\p{Extended_Pictographic}\uFE0F\u200D\p{Cc}\p{Cf}\p{Cs}]/gu;

/**
 * El texto de una lámina: una línea, sin lo que no se dibuja, y con el tope en PUNTOS DE CÓDIGO.
 * `''` = usar el nombre del módulo.
 *
 * ⚠️ El tope se cuenta con `Array.from` y no con `.length`: «Ñandú» son 5 caracteres para quien lo
 *    escribe, y una tilde en NFD serían dos unidades. Por eso también va `normalize('NFC')` antes.
 */
export function textoLamina(v: unknown, tope: number): string {
  if (typeof v !== 'string') return '';
  // Los blancos PRIMERO: un salto de línea es un carácter de control, y borrado antes de volverlo
  // espacio pegaría «Hola\nmundo» en «Holamundo».
  const limpio = v.normalize('NFC').replace(/\s+/g, ' ').replace(NO_DIBUJABLE, '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(limpio);
  return chars.length > tope ? chars.slice(0, tope).join('').trim() : limpio;
}

/**
 * Una lámina que llega como objeto (de la pantalla o de `leerLamina`), saneada; `null` si el diseño
 * no es del catálogo o un color no es un color. Un texto de más se RECORTA, no se rechaza: el tope
 * puede bajar el día que se rediseñe una lámina, y una fila vieja con un texto largo tiene que
 * seguir dibujándose, no desaparecer.
 */
export function sanearLamina(x: unknown): ValorLamina | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const d = disenoLamina(o.diseno);
  if (!d) return null;
  const a = hexLamina(o.a);
  const b = hexLamina(o.b);
  if (!a || !b) return null;
  return { diseno: d.id, a, b, texto: textoLamina(o.texto, d.tope) };
}

/** El largo que se acepta leer. Muy por encima de lo que arma `valorDeLamina` (~500 con un texto de 40 tildes). */
const LARGO_MAX = 1200;

/**
 * Una lámina guardada, leída y saneada; `null` si no es una lámina válida.
 *
 * ⚠️ ES ESTRICTA: lo que llega de la base o del navegador no se «arregla» con defaults. Un diseño
 *    que no existe, un color roto o un `%` mal formado devuelven `null`, y quien sanea una portada
 *    trata `null` como «volver al default» — igual que un `grad:` inventado en lib/portadas.ts.
 * ⚠️ EL TEXTO PUEDE TRAER `:` (lo que se guarda va codificado, pero una fila escrita a mano no): todo
 *    lo que sigue al cuarto separador es el texto, no un campo más.
 */
export function leerLamina(v: unknown): ValorLamina | null {
  if (typeof v !== 'string' || !v.startsWith(PREFIJO_LAMINA) || v.length > LARGO_MAX) return null;
  const partes = v.slice(PREFIJO_LAMINA.length).split(':');
  if (partes.length < 4) return null;
  const [diseno, a, b] = partes;
  // Los colores del valor van SIN «#» y en seis cifras: un `#` o un `abc` no los escribe nadie
  // que no sea a mano, y la forma canónica es lo único que hace que dos láminas iguales sean el
  // mismo string (el selector marca la elegida comparando strings).
  if (!/^[0-9A-Fa-f]{6}$/.test(a) || !/^[0-9A-Fa-f]{6}$/.test(b)) return null;
  let texto: string;
  try {
    texto = decodeURIComponent(partes.slice(3).join(':'));
  } catch {
    return null;
  }
  return sanearLamina({ diseno, a, b, texto });
}

/**
 * El string que se guarda. CANÓNICO: dos láminas iguales dan el mismo string, y
 * `leerLamina(valorDeLamina(l))` devuelve `l` saneada.
 *
 * ⚠️ NUNCA FALLA, y es a propósito: esto lo arma la PANTALLA con lo que la persona eligió, así que a
 *    un diseño desconocido le pone el default y a un color roto el del diseño. Lo que llega de afuera
 *    no pasa por acá sin pasar antes por `leerLamina`, que sí es estricta.
 */
export function valorDeLamina(l: ValorLamina): string {
  const d = disenoLamina(l?.diseno) ?? (POR_ID.get(DISENO_DEFAULT) as DisenoLamina);
  const a = (hexLamina(l?.a) ?? d.a).slice(1);
  const b = (hexLamina(l?.b) ?? d.b).slice(1);
  return `${PREFIJO_LAMINA}${d.id}:${a}:${b}:${encodeURIComponent(textoLamina(l?.texto, d.tope))}`;
}
