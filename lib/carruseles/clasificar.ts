// =============================================================================
// carruseles/clasificar — qué TIPO de carrusel es y si parece CONTENIDO, sin IA y sin inventar (4/11/2026)
// =============================================================================
// Pedido del Cerebro, con lo medido en la primera carga de la biblioteca (4/11/2026, ~21:20 UTC):
//   «142 de los 160 quedaron "sin tipo" (87 de temas, 55 de cuentas). El filtro por tipo casi no sirve así: mira por qué el
//   texto no alcanza y clasifícalos mejor, sin inventar» y «El orden por outlier sube publicaciones personales. El primero de
//   @leilahormozi es una foto de su embarazo ("Anytime now…."). Busca una forma medible de bajarlas sin esconder lo que
//   funciona, y deja dicho qué cubre y qué no».
//
// POR QUÉ EL TEXTO NO ALCANZABA (leyendo el clasificador de Spy, `formatoPorTexto`, lib/spy-detalle.ts):
//   · sus frases fuertes son casi todas en español, y las cuentas de la lista (Hormozi y compañía) escriben en inglés;
//   · la lista sólo se reconoce con un número pegado a uno de doce sustantivos («7 errores»): «5 formas», «3 lessons» o
//     «7 simple ways» no entraban;
//   · y lo más importante: en un carrusel el formato está en las LÁMINAS, no en el pie. El pie suele ser un «Guárdalo 📌».
//     Por eso se lee también el texto de la PORTADA que Instagram escribe para las personas ciegas («May be an image of text
//     that says '5 errores…'», el `alt` del actor de Apify), cuando viene.
//
// SIN INVENTAR: una regla nueva es una frase o una forma que DICE el tipo (un número con un sustantivo contable, «cómo» al
// arrancar el gancho, «antes / después»). Lo que no dice nada queda «sin tipo», que es la verdad. Nunca se adivina por el
// largo, el creador o el tema.
//
// «PARECE CONTENIDO» (para el orden, nunca para esconder): una señal MEDIBLE con tres valores.
//   · true: dice algo de contenido — tiene tipo, pide algo al final (guardar, comentar, compartir…), o Instagram dice que la
//     portada tiene texto;
//   · false: Instagram dice que la portada es de personas y no tiene texto, o el pie es corto (menos de 8 palabras) y no tiene
//     ni tipo, ni cierre, ni un número («Anytime now….»);
//   · null: no se puede decir.
// QUÉ CUBRE: la foto personal con un pie corto, y (con el texto de la portada) la portada de personas sin texto.
// QUÉ NO CUBRE: un pie personal LARGO sin el texto de la portada (un cumpleaños contado en tres párrafos sale null y queda
// donde lo pone su outlier), ni un carrusel de contenido con un pie de una palabra y sin portada leída (sale false y baja:
// se sigue viendo, más abajo). Por eso baja, no esconde.
// =============================================================================

import { formatoPorTexto, type Formato } from '../spy-detalle';
import { textoComparable } from '../spy-funnel-tipo';
import type { Cierre } from './texto';

/**
 * El texto de la portada que escribió Instagram, sacado de su texto alternativo: lo que va entre comillas después de
 * «that says» (o «que dice»). Sin esa frase, null: el resto («Photo by X on …») no es del creador.
 */
export function textoDePortada(alt: string | null | undefined): string | null {
  const t = String(alt ?? '');
  const m = /(?:text that says|que dice)\s*['"‘“«]([\s\S]+?)['"’”»]\s*(?:\.|$)/i.exec(t);
  const dentro = m?.[1]?.replace(/\s+/g, ' ').trim();
  return dentro ? dentro.slice(0, 500) : null;
}

/**
 * Lo que Instagram dice de la portada en su texto alternativo: si tiene texto, si es de personas sin texto, o nada.
 * «May be an image of text» / «…and text…» → texto; «May be an image of 1 person…» sin «text» → personas.
 */
export function portadaDice(alt: string | null | undefined): 'texto' | 'personas' | null {
  const t = String(alt ?? '').toLowerCase();
  if (!/may be an image of|puede ser una imagen de/.test(t)) return null;
  if (/\btext\b|\btexto\b/.test(t)) return 'texto';
  if (/\b(?:person|people|persona|personas|child|children|baby|niño|niña|bebé)\b/.test(t)) return 'personas';
  return null;
}

// Una lista dice cuántas cosas trae: un número (2 a 30) y, a lo sumo una palabra después, un sustantivo contable.
const SUSTANTIVOS_DE_LISTA = [
  'errores', 'tips', 'consejos', 'claves', 'pasos', 'razones', 'cosas', 'habitos', 'herramientas', 'senales', 'formas', 'maneras',
  'ideas', 'lecciones', 'reglas', 'libros', 'preguntas', 'frases', 'apps', 'estrategias', 'secretos', 'trucos', 'hacks', 'ejemplos',
  'plantillas', 'prompts', 'ganchos', 'hooks', 'mitos', 'verdades', 'aprendizajes', 'principios', 'tipos', 'metodos', 'recursos',
  'ways', 'things', 'lessons', 'rules', 'books', 'steps', 'mistakes', 'habits', 'reasons', 'signs', 'tools', 'questions', 'strategies',
  'secrets', 'tricks', 'examples', 'templates', 'frameworks', 'principles', 'myths', 'truths', 'types', 'methods', 'resources', 'lies',
];
const LISTA_AMPLIA = new RegExp(`(?<![\\p{L}\\p{N}])(?:[2-9]|[12]\\d|30)\\s+(?:\\p{L}+\\s+)?(?:${SUSTANTIVOS_DE_LISTA.join('|')})(?![\\p{L}\\p{N}])`, 'u');

// Frases que dicen el tipo y el catálogo de Spy no tiene en inglés (sus equivalentes en español sí están allá).
const FRASES_EN: ReadonlyArray<readonly [Formato, RegExp]> = [
  ['tutorial', /(?<![\p{L}\p{N}])(?:here'?s how to|a guide to|the guide to|step\s*1)(?![\p{L}\p{N}])/u],
  ['storytime', /(?<![\p{L}\p{N}])(?:story time|let me tell you about|the day i)(?![\p{L}\p{N}])/u],
  ['opinion', /(?<![\p{L}\p{N}])(?:nobody tells you|no one tells you|controversial opinion)(?![\p{L}\p{N}])/u],
  ['caso-de-exito', /(?<![\p{L}\p{N}])(?:how we helped|how i helped)(?![\p{L}\p{N}])/u],
  ['preguntas', /(?<![\p{L}\p{N}])(?:you asked|faq)(?![\p{L}\p{N}])/u],
  ['antes-despues', /(?<![\p{L}\p{N}])(?:antes\s*[/|→-]+\s*despues|before\s*[/|→-]+\s*after|before vs\.? after)(?![\p{L}\p{N}])/u],
];

/** El gancho: la primera línea con letras (en un carrusel, lo que dice arriba del pie). */
function primeraLinea(texto: string): string {
  return texto.split(/\n+/).map((l) => l.trim()).find((l) => /\p{L}/u.test(l)) ?? '';
}

/** Lo que dice el tipo en UN texto (la portada o el pie). '' = no dice nada. */
function tipoEn(texto: string | null): Formato | '' {
  if (!texto?.trim()) return '';
  const deSpy = formatoPorTexto(texto);
  if (deSpy) return deSpy;
  const n = textoComparable(texto);
  if (LISTA_AMPLIA.test(n)) return 'lista';
  for (const [f, re] of FRASES_EN) if (re.test(n)) return f;
  // «Cómo vender…», «How I…» no; «Cómo» con tilde, al ARRANCAR el gancho, es un tutorial («como emprendedora…» no lo es:
  // por eso se mira el texto original, con su tilde, y sólo la primera línea).
  const gancho = primeraLinea(texto);
  if (/^(?:¿\s*)?c[óÓ]mo\s+\p{L}/iu.test(gancho) && !/\?\s*$/.test(gancho)) return 'tutorial';
  if (/^(?:gu[íi]a\s+(?:para|de|r[áa]pida)|aprende\s+a\s)/iu.test(gancho)) return 'tutorial';
  return '';
}

/**
 * El tipo de un carrusel: primero lo que dice su PORTADA (el texto que escribió Instagram), después su pie. Con el mismo
 * vocabulario de Spy (`Formato`), así el filtro por tipo es uno solo.
 */
export function tipoDeCarrusel(o: { texto: string | null; portada?: string | null }): Formato | '' {
  return tipoEn(o.portada ?? null) || tipoEn(o.texto);
}

const PALABRAS_MINIMAS = 8;

/** ¿Parece contenido? true / false / null (no se puede decir). El porqué, arriba de todo. */
export function pareceContenido(o: { texto: string | null; formato: string | null; cierre: Cierre | string | null; portada?: 'texto' | 'personas' | null }): boolean | null {
  if (o.portada === 'texto') return true;
  if (o.formato || o.cierre) return true;
  if (o.portada === 'personas') return false;
  const t = (o.texto ?? '').trim();
  if (!t) return null;
  const palabras = t.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  if (palabras < PALABRAS_MINIMAS && !/\p{N}/u.test(t)) return false;
  return null;
}

/** El texto alternativo de un ítem del actor de Apify: el de la publicación o, si no, el de su primera lámina. */
export function altDelItem(item: unknown): string | null {
  const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
  if (!o) return null;
  if (typeof o.alt === 'string' && o.alt.trim()) return o.alt;
  const hijos = Array.isArray(o.childPosts) ? o.childPosts : [];
  const primera = hijos[0] && typeof hijos[0] === 'object' ? (hijos[0] as Record<string, unknown>) : null;
  return typeof primera?.alt === 'string' && primera.alt.trim() ? primera.alt : null;
}
