// =============================================================================
// nombre-partes — con qué nombre se saluda a un contacto (31/10/2026)
// =============================================================================
// Llamada con Leila (30/10): guarda sus contactos como «[ciudad/país] Nombre Apellido» («MX Nadia Calderón», «Kun Fabiola Pedraza») y el
// saludo salía «Hola MX» o «Hola Kun». Martín: «yo voy a poner una opción»: primer, segundo, tercer nombre o nombre completo. Y la regla
// del producto: SI NO SE PUEDE SABER, NO SE INVENTA. Mejor un mensaje sin nombre que «Hola MX» o «Hola 5491155550002».
//
// MEDIDO el 31/10/2026 en la base de Leila (494 leads con nombre): 143 son sólo un teléfono; 21 empiezan con un código en mayúsculas (MX,
// PERÚ, COL, ARG, ECU); una palabra se repite adelante hasta 20 veces y no se puede saber sola si es un nombre o un lugar.
//
// Por eso tres capas:
//   1. `{{nombre}}` salta lo que SEGURO no es un nombre: sin letras, con dígitos, entre corchetes, códigos de país o ciudad, títulos.
//   2. Lo que sólo el negocio sabe («Kun»): la lista de palabras que no son nombre (`noSon`, el setting `crm.nombres.no_son`).
//   3. `{{segundo_nombre}}` y `{{tercer_nombre}}`: la palabra en ESA posición, tal como está guardada. Es la opción que pidió Martín, y
//      sirve para una base entera con la misma forma.
//
// Sin React ni base: lo usan el motor, el editor y el test.
// =============================================================================

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Códigos de país y de ciudad con que la gente agenda. Con otra palabra al lado, no son un nombre. */
const CODIGOS = new Set([
  'mx', 'mex', 'ar', 'arg', 'co', 'col', 'colm', 'pe', 'per', 'peru', 'ec', 'ecu', 'cl', 'chi', 'uy', 'uru', 'py', 'par', 'bo', 'bol', 've', 'ven', 'br', 'bra',
  'us', 'usa', 'es', 'esp', 'rd', 'dom', 'cr', 'pa', 'pan', 'gt', 'gua', 'hn', 'hon', 'sv', 'ni', 'nic', 'cu', 'pr', 'cdmx', 'gdl', 'mty', 'qro', 'bog', 'mde', 'caba', 'bsas',
]);
/** Títulos: «Dra. Paula» se saluda Paula. */
const TITULOS = new Set(['dr', 'dra', 'sr', 'sra', 'srta', 'lic', 'ing', 'prof', 'profe', 'mtro', 'mtra', 'coach', 'don', 'dona', 'arq', 'cp', 'abog']);
/** Nombres cortos que alguien puede escribir en mayúsculas: «ANA Lopez» es Ana. */
const NOMBRES_CORTOS = new Set(['ana', 'eva', 'ema', 'ada', 'ida', 'ines', 'luz', 'pia', 'sol', 'mar', 'rosa', 'lola', 'lula', 'nora', 'vera', 'alma', 'elsa', 'irma', 'gema', 'juan', 'jose', 'luis', 'raul', 'saul', 'ivan', 'omar', 'beto', 'tito', 'hugo', 'blas', 'axel', 'noel', 'joel', 'leo', 'max', 'teo', 'gus', 'pau', 'nico', 'dani', 'caro', 'vale', 'sofi', 'lau']);

export type ParteDelNombre = {
  /** Con qué se saluda. null = no se puede saber: el mensaje sale sin nombre. */
  nombre: string | null;
  apellido: string | null;
  /** Sin lo que no es nombre («Nadia Calderón»). null si no quedó nada. */
  completo: string | null;
  /** La segunda y la tercera palabra, tal como están guardadas (con letras). */
  segunda: string | null;
  tercera: string | null;
};

const CON_LETRA = /\p{L}/u;
/** La palabra sin emojis ni signos pegados. Vacía si no le queda una letra. */
function limpiar(p: string): string {
  const s = p.replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.'’]+$/gu, '').replace(/\.+$/, '');
  return CON_LETRA.test(s) ? s : '';
}
const enMayusculas = (p: string) => p === p.toLocaleUpperCase('es') && p !== p.toLocaleLowerCase('es');
/** «NADIA» y «nadia» se saludan «Nadia»; «McKenzie» queda como está. */
function presentable(p: string): string {
  if (enMayusculas(p) || p === p.toLocaleLowerCase('es')) {
    return p.toLocaleLowerCase('es').replace(/(^|[-'’])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase('es'));
  }
  return p;
}

/** Las palabras tal como están, cortando también en los separadores que no van en un nombre («MX|Nadia», «MX/Nadia»). */
function palabras(crudo: string): string[] {
  return crudo.trim().split(/[\s|/·•_,;]+/).filter(Boolean);
}
const entreSignos = (p: string) => /^[[({<].*[\])}>]:?$/.test(p);

/**
 * ¿Esta palabra seguro NO es un nombre? `hayMas`: hay otra palabra después. `todoEnMayusculas`: toda la fila está en mayúsculas, y ahí una
 * palabra corta en mayúsculas no dice nada («ANA LOPEZ»).
 */
function noEsNombre(cruda: string, hayMas: boolean, todoEnMayusculas: boolean, noSon: ReadonlySet<string>): boolean {
  const p = limpiar(cruda);
  if (!p || /\d/.test(p) || entreSignos(cruda) || p.length < 2) return true;
  const n = norm(p);
  if (noSon.has(n)) return true;
  if (CODIGOS.has(n)) return true;
  if (TITULOS.has(n)) return hayMas;
  // Una sigla: corta, en mayúsculas, con otra palabra normal al lado. Salvo un nombre corto conocido.
  return hayMas && !todoEnMayusculas && p.length <= 4 && enMayusculas(p) && !NOMBRES_CORTOS.has(n);
}

/** Las partes del nombre de un contacto. `noSon`: las palabras que el negocio dijo que no son un nombre, normalizadas (`normalizarNoSon`). */
export function partesDelNombre(crudo: string | null | undefined, noSon: ReadonlySet<string> = new Set()): ParteDelNombre {
  const todas = palabras(String(crudo ?? ''));
  const conLetra = todas.map(limpiar).filter(Boolean);
  const todoEnMayusculas = conLetra.length > 1 && conLetra.every(enMayusculas);
  const buenas = todas.filter((p, i) => !noEsNombre(p, i < todas.length - 1, todoEnMayusculas, noSon)).map(limpiar).map(presentable);
  // La posición cuenta las palabras con letras, como las ve una persona: en «🌸 MX Nadia», la segunda es Nadia.
  const posicion = (i: number) => (conLetra[i] && !/\d/.test(conLetra[i]) ? presentable(conLetra[i]) : null);
  return {
    nombre: buenas[0] ?? null,
    apellido: buenas.slice(1).join(' ') || null,
    completo: buenas.join(' ') || null,
    segunda: posicion(1),
    tercera: posicion(2),
  };
}

/** Las palabras que no son nombre, como se guardan y se comparan. */
export function normalizarNoSon(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter((x): x is string => typeof x === 'string').map((x) => norm(limpiar(x.trim()))).filter(Boolean))].slice(0, 200);
}

/** Lo que guarda el setting, leído. Sin leer o roto: ninguna. */
export function noSonDeSetting(crudo: string | null | undefined): ReadonlySet<string> {
  if (!crudo) return new Set();
  try { return new Set(normalizarNoSon(JSON.parse(crudo))); } catch { return new Set(); }
}

export const CLAVE_NO_SON = 'crm.nombres.no_son';

export type PalabraRepetida = { palabra: string; n: number; noEs: boolean; automatica: boolean; ejemploDe: string; ejemploA: string | null };
export type ResumenNombres = { total: number; sinNombre: number; repetidas: PalabraRepetida[] };

/**
 * Cómo saluda MaKo a esta base: cuántos quedan sin nombre, y las primeras palabras que se repiten (de ahí sale «Kun»). `automatica`: ya se
 * salta sola, no hace falta marcarla. Sólo las que se repiten: una sola vez no dice nada.
 */
export function resumenDeNombres(nombres: ReadonlyArray<string | null>, noSon: ReadonlySet<string>, minimo = 3, tope = 40): ResumenNombres {
  const porPalabra = new Map<string, { palabra: string; n: number; ejemplo: string }>();
  let total = 0, sinNombre = 0;
  for (const crudo of nombres) {
    total++;
    if (!partesDelNombre(crudo, noSon).nombre) sinNombre++;
    const ps = palabras(String(crudo ?? ''));
    const primera = limpiar(ps[0] ?? '');
    if (!primera || ps.length < 2) continue;
    const k = norm(primera);
    const fila = porPalabra.get(k);
    if (fila) fila.n++;
    else porPalabra.set(k, { palabra: primera, n: 1, ejemplo: String(crudo).trim() });
  }
  const repetidas = [...porPalabra.entries()].filter(([, f]) => f.n >= minimo).sort((a, b) => b[1].n - a[1].n).slice(0, tope).map(([k, f]) => {
    const automatica = !noSon.has(k) && partesDelNombre(f.ejemplo, new Set()).nombre !== presentable(f.palabra);
    return { palabra: f.palabra, n: f.n, noEs: noSon.has(k), automatica, ejemploDe: f.ejemplo, ejemploA: partesDelNombre(f.ejemplo, noSon).nombre };
  });
  return { total, sinNombre, repetidas };
}

const CLAVES_DE_NOMBRE = ['nombre', 'nombre_completo', 'apellido', 'segundo_nombre', 'tercer_nombre'] as const;

/**
 * UN NOMBRE QUE NO HAY NO DEJA EL MENSAJE COJO. «Hola {{nombre}}, ¿cómo estás?» sale «Hola, ¿cómo estás?», no «Hola , ¿cómo estás?», y
 * «{{nombre}}, te escribo» sale «Te escribo». Sólo para una clave puesta en vacío: una que falta sigue la regla del renglón opcional.
 */
export function sinNombresVacios(texto: string, vars: Record<string, string>): string {
  let out = texto;
  for (const clave of CLAVES_DE_NOMBRE) {
    if (vars[clave] !== '' || !out.includes(clave)) continue;
    const re = new RegExp(`([ \\t]*,)?[ \\t]*\\{\\{?\\s*${clave}\\s*\\}?\\}(,)?[ \\t]*`, 'gi');
    out = out.replace(re, (m: string, comaAntes: string | undefined, comaDespues: string | undefined, i: number, s: string) => {
      const inicio = i === 0 || s[i - 1] === '\n';
      const sigue = s[i + m.length];
      if (inicio) return '\u0001';
      if (sigue === undefined || sigue === '\n') return comaDespues || comaAntes ? '' : '';
      if (comaDespues) return ', ';
      if (/[.!?:;,)]/.test(sigue)) return '';
      return comaAntes ? ', ' : ' ';
    });
    // Lo que quedó al principio del renglón empieza con mayúscula; y un «¡!» sin nada adentro se va.
    out = out.replace(/\u0001(\s*)(\S?)/g, (_: string, e: string, c: string) => e + c.toLocaleUpperCase('es')).replace(/[¡¿][ \t]*[!?]/g, '');
  }
  return out;
}
