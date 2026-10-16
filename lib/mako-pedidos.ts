// =============================================================================
// mako-pedidos — los pedidos SUELTOS en los chats de MaKo
// =============================================================================
// Martín, 16/10/2026 (textual en docs/diseno-mako-pedidos.md): en cualquier chat de MaKo —el del Web Generator,
// el de Automations— la persona mezcla cosas. «Feedback sobre lo actual... Y luego y también quiero que me crees
// otra landing para mi otro producto...», o «Quiero eliminar la otra automatización que tengo porque podría
// unificarla...» sin nombrarla, o un mensaje que es de OTRA tab. El chat tiene que separar, saber de qué objeto
// habla cada pedido, ofrecer la acción si la API de MaKo la tiene y, si no es de acá, dejar el link.
//
// Este módulo es el núcleo, PURO a propósito (sin `server-only`, sin valores del registro):
//   · `partirPedidos(texto)` separa el mensaje con REGLAS y etiqueta cada pedido (verbo, área, la frase que
//     nombra el objeto);
//   · `resolverPedidos(crudos, ctx)` decide de cada uno: lo ACTUAL / OTRO objeto de esta tab (y cuál) / uno
//     NUEVO de esta tab / OTRA tab (con su link) — con la operación del registro y si confirma;
//   · `dudaDeLasReglas` dice cuándo las reglas no alcanzan, y `leerRespuestaIA` valida lo que etiquetó la IA;
//   · `interpretarCon(texto, ctx, pedirIA)` es el orden: reglas → IA sólo si dudan → resolver. La IA real la
//     pone lib/mako-pedidos-ia.ts (server-only); los tests le pasan un doble.
//
// ⚠️ NO VA AL REGISTRO DE LA API (AGENTS.md, «Una capacidad nueva de MaKo se DECLARA en el registro»): esto no es
// una capacidad del NEGOCIO —no lee ni escribe nada suyo— sino el RUTEO de un chat. Lo que sí sale del registro
// son las ACCIONES que se ofrecen: llegan como datos (`ctx.operaciones`, ya filtradas por `visible()` para esta
// persona en app/api/mako/pedidos/route.ts), nunca de una lista propia.
//
// ⚠️ LA IA SÓLO ETIQUETA (AGENTS.md, «Una regla en un prompt no es una regla»). Lo que decide —el objeto, la
// acción, si confirma, el link— es código. Lo que devuelve la IA pasa por `leerRespuestaIA`: un texto que no está
// en el mensaje la descarta entera; un verbo o un área que no existen caen a las reglas de ese pedido; un área que
// el texto no nombra (ni es la de la tab) no se acepta; y un id de objeto que mande, se ignora.
//
// ⚠️ NUNCA SE ELIGE EL PRIMERO DE UNA LISTA AMBIGUA (AGENTS.md, «Si hay que desempatar, todavía estás
// adivinando»): «la otra» con dos candidatos o más devuelve los DOS más recientes y una pregunta, y el objeto
// queda en null. Borrar SIEMPRE confirma, aunque el objeto esté claro.
//
// ⚠️ SIN `server-only` NO ES APTO PARA EL NAVEGADOR ENTERO: trae `AREA_KEYWORDS` (lib/mako-intencion.ts). Un
// `'use client'` importa de acá sólo TIPOS (`import type`): la interpretación la hace la ruta.

import { AREAS, AREA_INFO, type Area } from './api-mako/tipos';
import { AREA_KEYWORDS } from './mako-intencion';
import { conWs } from './ws-tab';

// ── El contrato ──────────────────────────────────────────────────────────────

/** Un objeto de la tab (una landing, una automatización). `tocadoAt` (ISO) ordena «la última que tocaste». */
export type ObjetoChat = { id: string; nombre: string; tocadoAt?: string | null };

/** Una operación del registro de la API de MaKo, como DATO (la ruta las arma desde `REGISTRO` + `visible()`). */
export type OperacionChat = { id: string; area: Area; tipo: 'lectura' | 'accion'; titulo?: string; descripcion: string };

/**
 * Ordena operaciones por relevancia con el texto del pedido. La ruta y los tests pasan `ordenarPorRelevancia` del
 * registro; acá no se importa porque es un VALOR de lib/api-mako/registro.ts. Sin esto, queda el orden declarado.
 */
export type OrdenarOperaciones = (ops: readonly OperacionChat[], texto: string) => readonly OperacionChat[];

export type ContextoPedidos = {
  /** El área del chat: 'landing' en el Web Generator, 'chatbot' en Automations. */
  tab: Area;
  /** Lo abierto (la landing del editor, la automatización del lienzo). */
  actual?: ObjetoChat | null;
  /** Los objetos de ESTA tab del negocio (para «la otra», «la de Juan»). */
  objetos?: readonly ObjetoChat[];
  /** Las del registro VISIBLES para esta persona. Lo que no está acá no se ofrece. */
  operaciones: readonly OperacionChat[];
  /** Para el link (`conWs` pega el `?ws=`). */
  ws?: number | null;
  ordenar?: OrdenarOperaciones;
};

export const VERBOS = ['crear', 'borrar', 'editar', 'ver', 'otro'] as const;
export type Verbo = (typeof VERBOS)[number];

/**
 * Un pedido separado y etiquetado, antes de resolverlo. `etiqueta` dice quién puso el ÁREA: con 'ia' el resolver
 * la toma tal cual (ya validada); con 'reglas' (el default) es prudente, porque `AREA_KEYWORDS` es ancha a
 * propósito —se hizo para sumar herramientas, donde sobrar es barato— y en el chat del Web Generator «cambia el
 * precio» nombra el área `negocio` sin ser de Second Brain.
 */
export type PedidoCrudo = { texto: string; verbo: Verbo; area: Area | null; referencia: string | null; etiqueta?: 'reglas' | 'ia' };

export type PedidoResuelto =
  | { sobre: 'actual'; texto: string }
  | {
      sobre: 'otro'; texto: string; verbo: Verbo; objeto: ObjetoChat | null; candidatos: ObjetoChat[];
      operacion: string | null; confirmar: boolean; pregunta: string | null;
    }
  /** Crear otro de esta MISMA tab. */
  | { sobre: 'nuevo'; texto: string; operacion: string | null }
  | { sobre: 'otra-tab'; texto: string; area: Area; titulo: string; link: string; operacion: string | null; confirmar: boolean };

export const BOTONES_PROPUESTA = ['Sí', 'Después'] as const;

export type Interpretacion = {
  pedidos: PedidoResuelto[];
  propuesta: { texto: string; botones: typeof BOTONES_PROPUESTA } | null;
  origen: 'reglas' | 'ia';
};

/** El tag de gasto de la IA que separa (lib/model-catalogo.ts). Acá para que el test lo encuentre sin server-only. */
export const FEATURE_PEDIDOS = 'mako-pedidos';

/** Más que esto en un mensaje no es una lista de pedidos: es un documento pegado. */
export const MAX_PEDIDOS = 6;

// ── El texto, sin tildes y con las MISMAS posiciones ─────────────────────────

const SIN_TILDE: Readonly<Record<string, string>> = {
  'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e', 'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
  'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u', 'ñ': 'n',
};

/**
 * Minúsculas y sin tildes, CARÁCTER POR CARÁCTER: el largo no cambia, así que una posición en el plano es la
 * misma en el original (en NFC). Las reglas corren acá, y lo que se devuelve se corta del original.
 */
export function plano(s: string): string {
  let out = '';
  for (const ch of s) {
    const low = ch.toLowerCase();
    const base = SIN_TILDE[low] ?? low;
    out += base.length === ch.length ? base : ch;
  }
  return out;
}

const nfc = (s: string): string => (s ?? '').normalize('NFC');
/** Para comparar textos: plano, sin puntuación, espacios simples. */
const comparable = (s: string): string => plano(nfc(s)).replace(/[^a-z0-9]+/g, ' ').trim();

// ── Las reglas ───────────────────────────────────────────────────────────────

/**
 * Los conectores que separan pedidos. Sobre el texto PLANO. Varios seguidos («Y luego y también») cuentan como
 * uno: el pedazo vacío del medio se tira. «y + verbo» NO separa: «Crea otra landing y ponle el título X» es UN
 * pedido sobre la landing nueva, y partido mandaría «ponle el título X» a la actual.
 */
// ⚠️ La cola sólo come PUNTUACIÓN, nunca el espacio: el espacio es el arranque del conector siguiente, y si se lo
// come, «Y luego y también» deja el «y también» pegado al pedido.
const CONECTOR = /(?:^|[\s.,;:!?…()-]+)(?:y\s+luego|y\s+despues|y\s+tambien|ademas|otra\s+cosa)(?=[\s.,;:!?…]|$)[.,;:!?…]*/g;

/** Los verbos, sobre el texto PLANO (sin tildes: «créame» y «elimínala» llegan como «creame» y «eliminala»). */
const RE_VERBOS: ReadonlyArray<readonly [Exclude<Verbo, 'otro'>, RegExp]> = [
  ['borrar', /\b(?:elimin\w*|borr(?:a|ar|ame|ala|alo|alas|alos|e|es|en|emos)\b|quit(?:a|ar|ame|ala|alo|alas|alos|ale|e|en|emos)\b|archiv(?:a|ar|ame|ala|alo|alas|alos|e|en|emos)\b|suprim\w*|desech\w*|deshaz\w*)/],
  ['crear', /\b(?:cre(?:a|ar|ame|ala|alo|alas|alos|e|es|en|emos)\b(?!\s+que\b)|gener(?:a|ar|ame|ala|alo|e|es|en|emos)\b|agend(?:ar|ame|ala|alo|alos|emos|en|es)\b|agenda(?=\s+(?:un|una|la|el|a)\b)|reagend\w*|arm(?:a|ar|ame|ala|alo|emos)\b|hazme\b)/],
  ['editar', /\b(?:cambi(?:a|ar|ame|ala|alo|alas|alos|ale|ales|e|es|en|emos)\b|modific\w*|edit(?:a|ar|ala|alo|e|es|en|emos)\b|ajust\w*|actualiz\w*|muev\w*|mover\w*|renombr\w*|pon(?:er\w*|e|me|le|les|lo|la|los|las|ga|gas)?\b|agreg\w*|anad\w*|mejor(?:a|ar|ala|alo|e|es|en|emos)\b|corrig\w*|correg\w*|reescrib\w*|configur\w*|acort\w*|alarg\w*|traduc\w*|sustitu\w*|reemplaz\w*)/],
  ['ver', /\b(?:ver|veamos|mir(?:a|ar|ame|emos)\b|muestr\w*|mostr\w*|ensen(?:a|ame|ar)\b|list(?:a|ar|ame)\b|dime\b|consult\w*|revis(?:a|ar|ame|emos)\b|cuant[oa]s?\b)/],
  // Sin «qué tengo»: «la otra automatización QUE TENGO» lo leía como un segundo verbo (ver) y la IA entraba de más.
];

/** Lo que se salta entre el verbo y su objeto: «crees OTRA landing», «agéndame UNA reunión». */
const RELLENO = new Set(['un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'lo', 'otra', 'otro', 'otras', 'otros',
  'nueva', 'nuevo', 'nuevas', 'nuevos', 'esta', 'este', 'estas', 'estos', 'esa', 'ese', 'mi', 'mis', 'tu', 'tus', 'su', 'sus',
  'me', 'te', 'le', 'nos', 'tambien', 'ya']);

/** Las palabras de cada área ancladas al principio (para «¿el objeto del verbo es de esta área?»). */
const ANCLADAS: Readonly<Record<Area, RegExp>> = Object.fromEntries(
  AREAS.map((a) => [a, new RegExp(`^(?:${AREA_KEYWORDS[a].source})`, AREA_KEYWORDS[a].flags.replace('g', ''))]),
) as Record<Area, RegExp>;

/**
 * Las palabras de un área que, DENTRO de su tab, nombran una PARTE de lo abierto y no otro objeto. En el Web
 * Generator un sitio tiene páginas («Añadir página», PanelPaginas.tsx): «crea otra página con los testimonios» es
 * una página más de la landing abierta, no otra landing. Fuera de su tab sí cuenta («créame otra página» en
 * Automations va al Web Generator).
 */
const PARTES_DE_LO_ABIERTO: Partial<Readonly<Record<Area, RegExp>>> = { landing: /^p[aá]ginas?$/i };

const esParteDeLoAbierto = (tab: Area, palabra: string | undefined): boolean =>
  !!palabra && !!PARTES_DE_LO_ABIERTO[tab]?.test(plano(nfc(palabra)).trim());

/** La última palabra de una frase («otra página» → «página»). */
const ultimaPalabra = (frase: string): string | undefined => /([\p{L}\p{N}]+)\s*$/u.exec(frase)?.[1];

type AreaEn = { area: Area; desde: number; hasta: number };

/** Las áreas que nombra un texto, con DÓNDE (la primera vez), en orden de aparición. Mira el original y el plano. */
function areasEn(original: string, pl: string): AreaEn[] {
  const out: AreaEn[] = [];
  for (const a of AREAS) {
    let mejor: AreaEn | null = null;
    for (const t of [original, pl]) {
      const m = AREA_KEYWORDS[a].exec(t);
      if (m && (mejor == null || m.index < mejor.desde)) mejor = { area: a, desde: m.index, hasta: m.index + m[0].length };
    }
    if (mejor) out.push(mejor);
  }
  return out.sort((x, y) => x.desde - y.desde);
}

type VerboEn = { verbo: Exclude<Verbo, 'otro'>; desde: number; hasta: number };

function verbosEn(pl: string): VerboEn[] {
  const out: VerboEn[] = [];
  for (const [verbo, re] of RE_VERBOS) {
    const m = re.exec(pl);
    if (m) out.push({ verbo, desde: m.index, hasta: m.index + m[0].length });
  }
  return out.sort((x, y) => x.desde - y.desde);
}

/** El área del OBJETO DIRECTO del verbo, y su frase («otra landing», «una reunión»), o null. */
function objetoDirecto(original: string, pl: string, v: VerboEn | undefined): { area: Area; frase: string } | null {
  if (!v) return null;
  const re = /[a-z0-9]+/g;
  re.lastIndex = v.hasta;
  let inicio = -1;
  for (let saltos = 0; saltos <= 3; saltos++) {
    const m = re.exec(pl);
    if (!m) return null;
    if (inicio < 0) inicio = m.index;
    if (RELLENO.has(m[0])) continue;
    for (const a of AREAS) {
      const k = ANCLADAS[a].exec(original.slice(m.index)) ?? ANCLADAS[a].exec(pl.slice(m.index));
      if (k) return { area: a, frase: original.slice(inicio, m.index + k[0].length).trim() };
    }
    return null;
  }
  return null;
}

/** La frase que nombra un objeto: la más temprana de estas formas. */
const RE_REFERENCIAS: readonly RegExp[] = [
  /\b(?:l[ao]s?|el|mis?)\s+otr[ao]s?\b(?:\s+[a-z0-9]+)?/,
  /\botr[ao]s?\s+[a-z0-9]{3,}/,
  /\b(?:l[ao]|el)\s+anterior\b/,
  /\b(?:l[ao]s?|el)\s+de\s+[a-z0-9]{3,}/,
  /\blo\s+actual\b/,
  /«[^»]{2,80}»|"[^"]{2,80}"|“[^”]{2,80}”/,
];
const NO_SUSTANTIVO = new Set(['que', 'para', 'porque', 'como', 'cuando', 'donde', 'con', 'por', 'de', 'del', 'y', 'o', 'si', 'ya']);

function referenciaEn(original: string, pl: string): string | null {
  let mejor: { desde: number; hasta: number } | null = null;
  for (const re of RE_REFERENCIAS) {
    const m = re.exec(pl);
    if (m && (mejor == null || m.index < mejor.desde)) {
      let hasta = m.index + m[0].length;
      // «la otra que tengo»: la palabra de después sólo cuenta si es un sustantivo, no un nexo.
      const ultima = /\s+([a-z0-9]+)$/.exec(m[0]);
      if (ultima && NO_SUSTANTIVO.has(ultima[1]) && /otr[ao]s?\s+[a-z0-9]+$/.test(m[0])) hasta -= ultima[0].length;
      mejor = { desde: m.index, hasta };
    }
  }
  return mejor ? original.slice(mejor.desde, mejor.hasta).trim() : null;
}

/** Lo que las reglas leen de un pedazo de texto. */
type Lectura = { original: string; pl: string; verbos: VerboEn[]; areas: AreaEn[]; objeto: { area: Area; frase: string } | null; referencia: string | null };

function leer(texto: string): Lectura {
  const original = nfc(texto);
  const pl = plano(original);
  const verbos = verbosEn(pl);
  return { original, pl, verbos, areas: areasEn(original, pl), objeto: objetoDirecto(original, pl, verbos[0]), referencia: referenciaEn(original, pl) };
}

/** El área según las reglas: la del objeto del verbo; si no, la primera nombrada después del verbo; si no, la primera. */
function areaDeReglas(l: Lectura): Area | null {
  if (l.objeto) return l.objeto.area;
  const desde = l.verbos[0]?.desde ?? 0;
  return (l.areas.find((a) => a.desde >= desde) ?? l.areas[0])?.area ?? null;
}

/** Las reglas sobre UN pedazo: verbo (el primero que aparece), área y referencia. */
function etiquetarConReglas(texto: string): PedidoCrudo {
  const l = leer(texto);
  return { texto: l.original.trim(), verbo: l.verbos[0]?.verbo ?? 'otro', area: areaDeReglas(l), referencia: l.referencia, etiqueta: 'reglas' };
}

/** Separa el mensaje en pedidos con REGLAS: un salto de línea o un conector («y luego», «y también», «además», «otra cosa»). */
export function partirPedidos(texto: string): PedidoCrudo[] {
  const original = nfc(texto).slice(0, 4000);
  const pl = plano(original);
  const pedazos: string[] = [];
  let desde = 0;
  const cortar = (hasta: number, siguiente: number) => {
    const t = original.slice(desde, hasta).replace(/^[\s,;:-]+|[\s,;:-]+$/g, '');
    if (/[a-z0-9]/i.test(plano(t))) pedazos.push(t);
    desde = siguiente;
  };
  const re = new RegExp(`\\n+|${CONECTOR.source}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(pl))) {
    if (!m[0]) { re.lastIndex++; continue; }
    cortar(m.index, m.index + m[0].length);
  }
  cortar(original.length, original.length);
  return pedazos.slice(0, MAX_PEDIDOS).map(etiquetarConReglas);
}

// ── El resolver ──────────────────────────────────────────────────────────────

/** Qué prefijos de id sirven para cada verbo, por TANDAS: la primera tanda que tenga alguna gana. */
const PREFIJOS: Readonly<Record<Verbo, readonly (readonly RegExp[])[]>> = {
  crear: [[/^crear_/, /^generar_/, /^agendar_/]],
  // Primero lo que se deshace (memoria «Cerrar no es borrar»): la papelera o archivar; borrar sólo si no hay.
  borrar: [[/^mandar_\w+_a_papelera$/, /^archivar_/], [/^borrar_/, /^eliminar_/]],
  editar: [[/^cambiar_/, /^editar_/, /^configurar_/]],
  ver: [[/^ver_/, /^listar_/]],
  otro: [],
};

/** La operación del registro para un verbo en un área, de las que la persona VE. `proponer_agendar_x` cuenta como `agendar_x`. */
export function operacionPara(verbo: Verbo, area: Area, texto: string, ctx: Pick<ContextoPedidos, 'operaciones' | 'ordenar'>): string | null {
  const tipo = verbo === 'ver' ? 'lectura' : 'accion';
  const delArea = ctx.operaciones.filter((o) => o.area === area && o.tipo === tipo);
  for (const tanda of PREFIJOS[verbo]) {
    const cand = delArea.filter((o) => tanda.some((re) => re.test(o.id.replace(/^proponer_/, ''))));
    if (!cand.length) continue;
    const orden = ctx.ordenar ? ctx.ordenar(cand, texto) : cand;
    return (orden[0] ?? cand[0]).id;
  }
  return null;
}

const tiempo = (o: ObjetoChat): number => {
  const t = o.tocadoAt ? Date.parse(o.tocadoAt) : NaN;
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
};
/** La última tocada primero; empates, en el orden que vinieron. */
const masRecientes = (l: readonly ObjetoChat[]): ObjetoChat[] =>
  l.map((o, i) => ({ o, i })).sort((a, b) => tiempo(b.o) - tiempo(a.o) || a.i - b.i).map((x) => x.o);

const nombreDe = (o: ObjetoChat): string => (o.nombre || '').trim() || 'esta';

/**
 * ¿Nombra a OTRO objeto de esta tab? Por nombre (el nombre entero en el texto, «la de Juan», o entre comillas), o
 * por «la otra» / «la anterior». «Otra X» sólo si X es la palabra de esta tab: «otra sección» en el editor es una
 * sección de la landing abierta, no otra landing.
 */
function referidos(l: Lectura, ref: string | null, otros: readonly ObjetoChat[], tab: Area): { como: 'nombre' | 'otro'; lista: ObjetoChat[] } | null {
  const t = ` ${comparable(l.original)} `;
  const porNombre = otros.filter((o) => {
    const n = comparable(o.nombre);
    return n.length >= 3 && t.includes(` ${n} `);
  });
  const deX = /\b(?:l[ao]s?|el)\s+de\s+([a-z0-9]{3,})/.exec(l.pl);
  const entreComillas = /«([^»]{2,80})»|"([^"]{2,80})"|“([^”]{2,80})”/.exec(l.original);
  const pista = deX?.[1] ?? (entreComillas ? comparable(entreComillas[1] ?? entreComillas[2] ?? entreComillas[3] ?? '') : '');
  const porPista = pista ? otros.filter((o) => ` ${comparable(o.nombre)} `.includes(` ${pista} `) || (pista.length >= 4 && comparable(o.nombre).includes(pista))) : [];
  const nombrados = [...new Set([...porNombre, ...porPista])];
  if (nombrados.length) return { como: 'nombre', lista: nombrados };

  const fuente = plano(nfc(ref ?? '')) || l.pl;
  const laOtra = /\b(?:l[ao]s?|el|mis?)\s+otr[ao]s?\b(?:\s+([a-z0-9]+))?/.exec(fuente) ?? /\botr[ao]s?\s+([a-z0-9]{3,})/.exec(fuente);
  if (laOtra) {
    const sust = laOtra[1];
    const esDeLaTab = !sust || NO_SUSTANTIVO.has(sust)
      || (ANCLADAS[tab].test(fuente.slice(laOtra.index + laOtra[0].length - sust.length)) && !esParteDeLoAbierto(tab, sust));
    if (esDeLaTab) return { como: 'otro', lista: [...otros] };
  }
  if (/\b(?:l[ao]|el)\s+anterior\b/.test(fuente)) return { como: 'otro', lista: [...otros] };
  return null;
}

/** La pregunta para confirmar un borrado, con el verbo de la operación que se va a usar. */
function confirmacion(operacion: string | null, nombre: string): string {
  if (operacion && /_a_papelera$/.test(operacion)) return `¿Mando «${nombre}» a la papelera?`;
  if (operacion && /^archivar_/.test(operacion)) return `¿Archivo «${nombre}»?`;
  return `¿Borro «${nombre}»?`;
}

function sobreOtro(c: PedidoCrudo, lista: readonly ObjetoChat[], ctx: ContextoPedidos): PedidoResuelto {
  const operacion = operacionPara(c.verbo, ctx.tab, c.texto, ctx);
  const confirmar = c.verbo === 'borrar';
  const orden = masRecientes(lista);
  if (orden.length === 1) {
    return { sobre: 'otro', texto: c.texto, verbo: c.verbo, objeto: orden[0], candidatos: [], operacion, confirmar, pregunta: confirmar ? confirmacion(operacion, nombreDe(orden[0])) : null };
  }
  // Ninguno o varios: se PREGUNTA. Con varios, los dos más recientes; nunca el primero de la lista.
  const candidatos = orden.slice(0, 2);
  const pregunta = candidatos.length === 2 ? `¿Cuál: «${nombreDe(candidatos[0])}» o «${nombreDe(candidatos[1])}»?` : '¿Cuál? Dime su nombre.';
  return { sobre: 'otro', texto: c.texto, verbo: c.verbo, objeto: null, candidatos, operacion, confirmar, pregunta };
}

type Decision = { pedido: PedidoResuelto; ambiguo: boolean; frase: string | null; hacemos?: string };

/** El «nosotros» del verbo que crea, para la propuesta: «agéndame» → agendamos, «créame» → creamos. */
function hacemosDe(l: Lectura): string {
  const v = l.verbos[0];
  const palabra = v ? l.pl.slice(v.desde, v.hasta) : '';
  if (/^(?:re)?agend/.test(palabra)) return 'agendamos';
  if (/^gener/.test(palabra)) return 'generamos';
  if (/^arm/.test(palabra)) return 'armamos';
  return 'creamos';
}

/** Decide UN pedido. `ambiguo` = las reglas lo mandaron a lo actual por prudencia, con otra área nombrada. */
function decidir(c: PedidoCrudo, ctx: ContextoPedidos): Decision {
  const tab = ctx.tab;
  const l = leer(c.texto);
  const area = c.area ?? tab;
  const actual = ctx.actual ?? null;

  if (area !== tab) {
    // Fuerte: lo etiquetó la IA (validado), no hay nada abierto, o el verbo CREA un objeto de esa área
    // («agéndame una reunión», «créame otra landing»). Lo demás —«cambia el precio», «quita el video»— nombra
    // otra área pero casi siempre es un cambio de lo abierto: va a lo actual y la IA desempata (si está).
    const fuerte = c.etiqueta === 'ia' || !actual || (c.verbo === 'crear' && l.objeto?.area === area);
    if (!fuerte) return { pedido: { sobre: 'actual', texto: c.texto }, ambiguo: true, frase: null };
    const info = AREA_INFO[area];
    return {
      pedido: {
        sobre: 'otra-tab', texto: c.texto, area, titulo: info.tab, link: conWs(info.ruta, ctx.ws ?? null),
        operacion: operacionPara(c.verbo, area, c.texto, ctx), confirmar: c.verbo === 'borrar',
      },
      // La frase sólo cuando CREA algo de esa área: «¿…y después agendamos una reunión?».
      ambiguo: false, frase: c.verbo === 'crear' && l.objeto?.area === area ? l.objeto.frase : null, hacemos: hacemosDe(l),
    };
  }

  // Crear algo de ESTA tab («créame otra landing») es uno nuevo; «crea una sección» o «crea otra página» es un
  // cambio de lo abierto.
  if (c.verbo === 'crear' && l.objeto?.area === tab && !esParteDeLoAbierto(tab, ultimaPalabra(l.objeto.frase))) {
    return { pedido: { sobre: 'nuevo', texto: c.texto, operacion: operacionPara('crear', tab, c.texto, ctx) }, ambiguo: false, frase: l.objeto.frase, hacemos: hacemosDe(l) };
  }
  const otros = (ctx.objetos ?? []).filter((o) => o.id !== actual?.id);
  const r = referidos(l, c.referencia, otros, tab);
  if (r) return { pedido: sobreOtro(c, r.lista, ctx), ambiguo: false, frase: null };
  // «Elimina esta landing»: borrar lo ABIERTO tampoco va por el camino de siempre (el editor no borra).
  if (c.verbo === 'borrar' && l.objeto?.area === tab && actual && !esParteDeLoAbierto(tab, ultimaPalabra(l.objeto.frase))) return { pedido: sobreOtro(c, [actual], ctx), ambiguo: false, frase: null };
  return { pedido: { sobre: 'actual', texto: c.texto }, ambiguo: false, frase: null };
}

/** El «después» de la propuesta, en una frase corta. */
function despues(d: Decision): string {
  const p = d.pedido;
  if (p.sobre === 'nuevo' && d.frase) return `${d.hacemos} ${d.frase}`;
  if (p.sobre === 'otra-tab') return d.frase && p.operacion ? `${d.hacemos} ${d.frase}` : `vamos a ${p.titulo}`;
  if (p.sobre === 'otro' && p.objeto) return `vamos con «${nombreDe(p.objeto)}»`;
  return 'vamos con lo otro';
}

/**
 * Decide cada pedido y arma la propuesta. Los pedidos sobre lo actual se juntan en UNO (es lo que sigue por el
 * camino de siempre); si TODO es de lo actual, va el mensaje entero, sin cortar.
 */
export function resolverPedidos(crudos: readonly PedidoCrudo[], ctx: ContextoPedidos, opts?: { origen?: 'reglas' | 'ia'; texto?: string }): Interpretacion {
  const decisiones = crudos.slice(0, MAX_PEDIDOS).map((c) => decidir(c, ctx));
  const actuales = decisiones.filter((d) => d.pedido.sobre === 'actual');
  const resto = decisiones.filter((d) => d.pedido.sobre !== 'actual');
  const textoActual = !resto.length && opts?.texto?.trim()
    ? nfc(opts.texto).trim()
    : actuales.map((d) => d.pedido.texto).join('\n');
  const pedidos: PedidoResuelto[] = [];
  let puesto = false;
  for (const d of decisiones) {
    if (d.pedido.sobre !== 'actual') { pedidos.push(d.pedido); continue; }
    if (!puesto) { pedidos.push({ sobre: 'actual', texto: textoActual }); puesto = true; }
  }
  // Con algo de lo actual Y algo más: se contesta lo actual y se PROPONE lo otro. Sin lo actual, no hay
  // propuesta: lo otro se contesta directo (el link, la pregunta o la confirmación).
  const propuesta = actuales.length && resto.length
    ? { texto: `¿Terminamos esto y después ${despues(resto[0])}?`, botones: BOTONES_PROPUESTA }
    : null;
  return { pedidos, propuesta, origen: opts?.origen ?? 'reglas' };
}

// ── Cuándo entra la IA ───────────────────────────────────────────────────────

/**
 * ¿Las reglas dudan? Sólo entonces se le pregunta a la IA. Devuelve el porqué (para el log) o null.
 *   · un pedido que nombra DOS áreas («créame otra landing para mi otro producto»: landing y negocio);
 *   · uno que las reglas mandaron a lo actual por prudencia con otra área nombrada («cambia el precio»);
 *   · dos verbos distintos sin conector, cuando hay algo más que lo actual en juego.
 * Un mensaje sin ninguna señal de otra cosa no duda: va entero a lo actual sin gastar una llamada.
 */
export function dudaDeLasReglas(crudos: readonly PedidoCrudo[], ctx: ContextoPedidos): string | null {
  for (const c of crudos) {
    const l = leer(c.texto);
    if (new Set(l.areas.map((a) => a.area)).size >= 2) return 'un pedido nombra dos áreas';
    if (decidir(c, ctx).ambiguo) return 'nombra otra área, pero puede ser un cambio de lo abierto';
    const senal = l.areas.some((a) => a.area !== ctx.tab) || !!l.referencia || l.objeto?.area === ctx.tab;
    if (new Set(l.verbos.map((v) => v.verbo)).size >= 2 && senal) return 'dos verbos sin conector';
  }
  return null;
}

/** Las tabs donde el chat habla de los clientes del negocio: lo que se escribe ahí lleva datos personales. */
export const TABS_DE_LEADS: readonly Area[] = ['crm', 'chats', 'whatsapp', 'closing', 'cobros'];

/**
 * ¿El mensaje lleva datos de los clientes del negocio? Un email, un teléfono, o una tab de leads. Con esto la IA
 * nunca va a un proveedor que entrena con lo que recibe (AGENTS.md, «Los datos de los clientes de un cliente…»).
 */
export function llevaDatosPersonales(texto: string, tab: Area): boolean {
  return TABS_DE_LEADS.includes(tab)
    || /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(texto)
    || /\+?\d[\d\s().-]{7,}\d/.test(texto);
}

const esArea = (s: unknown): s is Area => typeof s === 'string' && (AREAS as readonly string[]).includes(s);
const esVerbo = (s: unknown): s is Verbo => typeof s === 'string' && (VERBOS as readonly string[]).includes(s);

function jsonFlojo(raw: string): unknown {
  const t = (raw ?? '').trim();
  try { return JSON.parse(t); } catch { /* sigue */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

/**
 * Valida lo que etiquetó la IA. `null` = no sirve entera (y quedan las reglas). Cada pedido:
 *   · `texto` tiene que estar EN el mensaje (la IA separa, no reescribe): si uno no está, se descarta todo;
 *   · `verbo` fuera de la lista → el de las reglas para ese pedazo;
 *   · `area` que no existe, o que el pedazo no nombra y no es la de la tab → la de las reglas (y el resolver la
 *     trata con la prudencia de las reglas);
 *   · `referencia` que no está en el pedazo → la de las reglas. Cualquier otro campo (un id, un «objeto») se ignora.
 */
export function leerRespuestaIA(raw: string, texto: string, tab: Area): PedidoCrudo[] | null {
  const o = jsonFlojo(raw) as { pedidos?: unknown } | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.pedidos)) return null;
  if (!o.pedidos.length || o.pedidos.length > MAX_PEDIDOS) return null;
  const mensaje = ` ${comparable(texto)} `;
  const out: PedidoCrudo[] = [];
  for (const p of o.pedidos as Array<Record<string, unknown> | null>) {
    if (!p || typeof p !== 'object' || typeof p.texto !== 'string') return null;
    const t = nfc(p.texto).trim();
    const tc = comparable(t);
    if (!tc || !mensaje.includes(` ${tc} `)) return null;
    const reglas = etiquetarConReglas(t);
    const nombradas = areasEn(nfc(t), plano(nfc(t))).map((a) => a.area);
    const areaIA = esArea(p.area) && (p.area === tab || nombradas.includes(p.area)) ? p.area : null;
    const ref = typeof p.referencia === 'string' && comparable(p.referencia) && ` ${comparable(t)} `.includes(` ${comparable(p.referencia)} `)
      ? nfc(p.referencia).trim()
      : reglas.referencia;
    out.push({
      texto: t,
      verbo: esVerbo(p.verbo) ? p.verbo : reglas.verbo,
      area: areaIA ?? reglas.area,
      referencia: ref,
      etiqueta: areaIA ? 'ia' : 'reglas',
    });
  }
  return out;
}

/** Lo que devuelve la IA real (o el doble de un test): el JSON crudo, o null si no contestó. */
export type PedirEtiquetas = (texto: string, ctx: ContextoPedidos) => Promise<string | null>;

/**
 * El orden: reglas → IA SÓLO si las reglas dudan (y si hay a quién preguntarle) → resolver. Si la IA no contesta
 * o lo que contesta no pasa `leerRespuestaIA`, quedan las reglas (`origen: 'reglas'`).
 */
export async function interpretarCon(texto: string, ctx: ContextoPedidos, pedirIA?: PedirEtiquetas | null): Promise<Interpretacion> {
  const crudos = partirPedidos(texto);
  if (pedirIA && dudaDeLasReglas(crudos, ctx)) {
    let raw: string | null = null;
    try { raw = await pedirIA(texto, ctx); } catch { raw = null; }
    const deIA = raw ? leerRespuestaIA(raw, texto, ctx.tab) : null;
    if (deIA) return resolverPedidos(deIA, ctx, { origen: 'ia', texto });
  }
  return resolverPedidos(crudos, ctx, { origen: 'reglas', texto });
}
