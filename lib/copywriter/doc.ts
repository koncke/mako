// =============================================================================
// copywriter/doc — el CONTENIDO de un guion: qué bloques existen, el saneo, las secciones y el texto (PURO)
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D3). El contenido es JSON de ProseMirror (TipTap 3), con los bloques básicos de
// Notion (help/writing-and-editing-basics, «Basic blocks»): Texto, Título 1-3, Viñetas, Numerada, Tareas, Desplegable,
// Cita, Separador, Destacado y Tabla.
//
// Tres decisiones que no se ven en el código:
//   · CADA BLOQUE DE PRIMER NIVEL LLEVA UN ID (`attrs.bid`). La IA apunta a un bloque por su id, nunca por su posición
//     (AGENTS.md, «Un chat que edita lo abierto»: «Las refs que ve la IA no pueden depender de la posición»). Lo pone
//     la extensión del editor al crear el bloque y lo REPONE el saneo: uno repetido (Enter copia los attrs del bloque
//     que se parte) o faltante recibe uno nuevo.
//   · UNA SECCIÓN DEL GUION ES UN TÍTULO 2 CON SU ETIQUETA (`attrs.seccion`, la MAYÚSCULA exacta de
//     lib/guion-estructuras.ts) y los bloques que le siguen hasta el próximo título de sección. Se lee «Gancho», como
//     un título de Notion; al exportar a texto se escribe la etiqueta en su renglón, que es el contrato de
//     `parsearSecciones` (lib/guion-secciones.ts) y del resto de la casa.
//   · EL SANEO NO CONFÍA EN NADA: corre en el server antes de guardar (lo que llega del navegador, de la API o de la IA).
//     Un nodo que no está en la lista se convierte en un párrafo con su texto (no se tira lo escrito); un atributo que no
//     está en la lista se cae; un enlace sólo con http(s) o mailto.
// SIN 'server-only': lo usan el editor (al pegar y al aplicar lo de MaKo), el server y los tests.
// =============================================================================

import { TOPES, type JsonNodo } from './tipos';

/** Los nodos de bloque que puede tener el documento, y los de adentro de cada uno. */
export const NODOS = {
  doc: 'doc',
  parrafo: 'paragraph',
  titulo: 'heading',
  texto: 'text',
  salto: 'hardBreak',
  vinetas: 'bulletList',
  numerada: 'orderedList',
  item: 'listItem',
  tareas: 'taskList',
  tarea: 'taskItem',
  cita: 'blockquote',
  separador: 'horizontalRule',
  tabla: 'table',
  fila: 'tableRow',
  celdaTitulo: 'tableHeader',
  celda: 'tableCell',
  destacado: 'callout',
  desplegable: 'toggle',
} as const;

/** Los bloques que pueden ir en el primer nivel (los que llevan `bid`). */
export const BLOQUES_DE_PRIMER_NIVEL: ReadonlySet<string> = new Set([
  NODOS.parrafo, NODOS.titulo, NODOS.vinetas, NODOS.numerada, NODOS.tareas, NODOS.cita, NODOS.separador, NODOS.tabla,
  NODOS.destacado, NODOS.desplegable,
]);

const PERMITIDOS: ReadonlySet<string> = new Set(Object.values(NODOS));
const MARCAS: ReadonlySet<string> = new Set(['bold', 'italic', 'strike', 'underline', 'code', 'link']);

/** El emoji por defecto de un Destacado (el de Notion). */
export const EMOJI_DESTACADO = '💡';

/** Un id de bloque: «b» + 9 letras o números. Sale de `Math.random` (corre igual en el navegador y en node). */
export function bidNuevo(): string {
  let s = '';
  while (s.length < 9) s += Math.random().toString(36).slice(2);
  return `b${s.slice(0, 9)}`;
}
export const BID_RE = /^b[a-z0-9]{6,16}$/;

/** Una etiqueta de sección válida: la forma de `normalizarEstructurasGuion` (MAYÚSCULA, 2 a 20). */
export const esEtiqueta = (v: unknown): v is string => typeof v === 'string' && /^[A-ZÁÉÍÓÚÑ0-9 ]{2,20}$/.test(v);

/** Las etiquetas de la biblioteca que en MAYÚSCULA perdieron la tilde: cómo se leen en el título. */
const CON_TILDE: Readonly<Record<string, string>> = {
  AGITACION: 'Agitación', SOLUCION: 'Solución', ATENCION: 'Atención', INTERES: 'Interés', DESPUES: 'Después',
  PROMESA: 'Promesa', PRUEBA: 'Prueba', INTRODUCCION: 'Introducción', CONCLUSION: 'Conclusión', ACCION: 'Acción',
  EXPLICACION: 'Explicación', DEMOSTRACION: 'Demostración', OBJECION: 'Objeción',
};

/** «AGITACION» → «Agitación»; «CTA» queda «CTA»; «GANCHO» → «Gancho». */
export function nombreDeSeccion(etiqueta: string): string {
  const e = etiqueta.trim().toUpperCase();
  if (CON_TILDE[e]) return CON_TILDE[e];
  if (e.length <= 3) return e;
  return e.charAt(0) + e.slice(1).toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Armar
// ─────────────────────────────────────────────────────────────────────────────

const texto = (t: string): JsonNodo[] => (t ? [{ type: NODOS.texto, text: t }] : []);

export function parrafo(t = ''): JsonNodo {
  const c = texto(t);
  return { type: NODOS.parrafo, attrs: { bid: bidNuevo() }, ...(c.length ? { content: c } : {}) };
}

/** El título de una sección: Título 2 con su etiqueta. */
export function tituloDeSeccion(etiqueta: string): JsonNodo {
  return { type: NODOS.titulo, attrs: { level: 2, bid: bidNuevo(), seccion: etiqueta }, content: texto(nombreDeSeccion(etiqueta)) };
}

/** Un documento con un solo renglón vacío (el de una página nueva de Notion). */
export function docVacio(): JsonNodo {
  return { type: NODOS.doc, content: [parrafo()] };
}

/** El documento de una estructura: un título por etiqueta y un renglón vacío debajo de cada uno. */
export function docDeEstructura(etiquetas: readonly string[]): JsonNodo {
  const content: JsonNodo[] = [];
  for (const e of etiquetas) {
    if (!esEtiqueta(e)) continue;
    content.push(tituloDeSeccion(e), parrafo());
  }
  return content.length ? { type: NODOS.doc, content } : docVacio();
}

// ─────────────────────────────────────────────────────────────────────────────
// Leer
// ─────────────────────────────────────────────────────────────────────────────

/** El texto plano de un nodo (sin los saltos de los bloques de adentro). */
export function textoDeNodo(n: JsonNodo | undefined): string {
  if (!n) return '';
  if (n.type === NODOS.texto) return n.text ?? '';
  if (n.type === NODOS.salto) return '\n';
  return (n.content ?? []).map(textoDeNodo).join(n.type === NODOS.parrafo || n.type === NODOS.titulo ? '' : '\n');
}

/** ¿El documento no tiene nada escrito? (los títulos de sección vacíos de una estructura cuentan como vacío) */
export function sinTexto(doc: JsonNodo): boolean {
  return (doc.content ?? []).every((b) => (b.type === NODOS.titulo && esEtiqueta(b.attrs?.seccion)) || b.type === NODOS.separador || !textoDeNodo(b).trim());
}

/** Un bloque de primer nivel como lo ve la IA y la API: su id, su tipo, su sección y su texto. */
export type BloqueLeido = { bid: string; tipo: string; seccion: string | null; texto: string };

/** Los bloques de primer nivel, con la sección a la que pertenecen (la del último título de sección de arriba). */
export function bloquesDelDoc(doc: JsonNodo): BloqueLeido[] {
  const out: BloqueLeido[] = [];
  let seccion: string | null = null;
  for (const b of doc.content ?? []) {
    const etiqueta = b.type === NODOS.titulo && esEtiqueta(b.attrs?.seccion) ? (b.attrs!.seccion as string) : null;
    if (etiqueta) seccion = etiqueta;
    const bid = typeof b.attrs?.bid === 'string' ? b.attrs.bid : '';
    out.push({ bid, tipo: nombreDeTipo(b), seccion: etiqueta ?? seccion, texto: textoParaLeer(b) });
  }
  return out;
}

/** El tipo de un bloque en palabras (lo que lee la IA). */
function nombreDeTipo(b: JsonNodo): string {
  if (b.type === NODOS.titulo) return b.attrs?.seccion ? 'seccion' : `titulo${Number(b.attrs?.level) || 2}`;
  const nombres: Record<string, string> = {
    [NODOS.parrafo]: 'texto', [NODOS.vinetas]: 'vinetas', [NODOS.numerada]: 'numerada', [NODOS.tareas]: 'tareas',
    [NODOS.cita]: 'cita', [NODOS.separador]: 'separador', [NODOS.tabla]: 'tabla', [NODOS.destacado]: 'destacado',
    [NODOS.desplegable]: 'desplegable',
  };
  return nombres[b.type] ?? 'texto';
}

/** El texto de un bloque como se lee: las listas con su viñeta, las tareas con su casilla, la tabla con «|». */
function textoParaLeer(b: JsonNodo): string {
  switch (b.type) {
    case NODOS.vinetas:
      return (b.content ?? []).map((i) => `- ${textoDeNodo(i).replace(/\n/g, ' ')}`).join('\n');
    case NODOS.numerada:
      return (b.content ?? []).map((i, k) => `${k + 1}. ${textoDeNodo(i).replace(/\n/g, ' ')}`).join('\n');
    case NODOS.tareas:
      return (b.content ?? []).map((i) => `[${i.attrs?.checked ? 'x' : ' '}] ${textoDeNodo(i).replace(/\n/g, ' ')}`).join('\n');
    case NODOS.tabla:
      return (b.content ?? []).map((f) => (f.content ?? []).map((c) => textoDeNodo(c).replace(/\n/g, ' ')).join(' | ')).join('\n');
    case NODOS.separador:
      return '---';
    case NODOS.destacado:
      return `${typeof b.attrs?.emoji === 'string' ? `${b.attrs.emoji} ` : ''}${textoDeNodo(b)}`;
    default:
      return textoDeNodo(b);
  }
}

/**
 * El guion como TEXTO: cada sección con su etiqueta en MAYÚSCULA en su renglón (el contrato de `parsearSecciones`) y el
 * resto de los bloques como se leen. Es lo que se copia, lo que lee la API y lo que se exporta al teleprompter.
 */
export function textoDelDoc(doc: JsonNodo): string {
  const lineas: string[] = [];
  for (const b of bloquesDelDoc(doc)) {
    if (b.tipo === 'seccion') { lineas.push('', b.seccion ?? ''); continue; }
    if (b.tipo.startsWith('titulo')) { lineas.push('', b.texto.trim()); continue; }
    if (b.texto.trim()) lineas.push(b.texto.trim());
  }
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// El saneo
// ─────────────────────────────────────────────────────────────────────────────

export type ResultadoSaneo = { ok: true; doc: JsonNodo; bytes: number } | { ok: false; error: string };

const recortarTexto = (t: unknown): string => (typeof t === 'string' ? t.slice(0, TOPES.texto) : '');

function hrefSeguro(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, 2_000);
  return /^(https?:\/\/|mailto:)/i.test(s) ? s : null;
}

function sanearMarcas(ms: unknown): JsonNodo['marks'] {
  if (!Array.isArray(ms)) return undefined;
  const out: NonNullable<JsonNodo['marks']> = [];
  for (const m of ms) {
    const t = (m as { type?: unknown })?.type;
    if (typeof t !== 'string' || !MARCAS.has(t)) continue;
    if (t === 'link') {
      const href = hrefSeguro((m as { attrs?: { href?: unknown } }).attrs?.href);
      if (href) out.push({ type: 'link', attrs: { href } });
      continue;
    }
    out.push({ type: t });
  }
  return out.length ? out : undefined;
}

/** Los atributos que se conservan de cada nodo (lo demás se cae). */
function sanearAttrs(tipo: string, a: Record<string, unknown>): Record<string, unknown> | undefined {
  const bid = typeof a.bid === 'string' && BID_RE.test(a.bid) ? a.bid : null;
  switch (tipo) {
    case NODOS.titulo: {
      const level = [1, 2, 3].includes(Number(a.level)) ? Number(a.level) : 2;
      return { level, bid, seccion: esEtiqueta(a.seccion) ? a.seccion : null };
    }
    case NODOS.numerada: {
      const start = Number.isInteger(a.start) && (a.start as number) > 0 && (a.start as number) < 10_000 ? a.start : 1;
      return { start, bid };
    }
    case NODOS.tarea:
      return { checked: a.checked === true };
    case NODOS.destacado:
      return { emoji: typeof a.emoji === 'string' && a.emoji.length <= 16 && a.emoji.trim() ? a.emoji : EMOJI_DESTACADO, bid };
    case NODOS.desplegable:
      return { abierto: a.abierto !== false, bid };
    case NODOS.celda:
    case NODOS.celdaTitulo: {
      const n = (x: unknown) => (Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 20 ? x : 1);
      return { colspan: n(a.colspan), rowspan: n(a.rowspan), colwidth: null };
    }
    default:
      return BLOQUES_DE_PRIMER_NIVEL.has(tipo) ? { bid } : undefined;
  }
}

type Contador = { nodos: number };

function sanearNodo(raw: unknown, prof: number, c: Contador): JsonNodo | null {
  if (!raw || typeof raw !== 'object' || prof > TOPES.profundidad || ++c.nodos > 20_000) return null;
  const o = raw as Record<string, unknown>;
  const tipo = typeof o.type === 'string' ? o.type : '';
  if (tipo === NODOS.texto) {
    const t = recortarTexto(o.text);
    if (!t) return null;
    const marks = sanearMarcas(o.marks);
    return { type: NODOS.texto, text: t, ...(marks ? { marks } : {}) };
  }
  if (tipo === NODOS.salto) return { type: NODOS.salto };
  // Un nodo que no conocemos: su texto, en un párrafo (no se tira lo escrito).
  if (!PERMITIDOS.has(tipo) || tipo === NODOS.doc) {
    const t = recortarTexto(textoDeNodo(o as JsonNodo).trim());
    return t ? { type: NODOS.parrafo, attrs: { bid: null }, content: [{ type: NODOS.texto, text: t }] } : null;
  }
  const attrs = sanearAttrs(tipo, (o.attrs && typeof o.attrs === 'object' ? o.attrs : {}) as Record<string, unknown>);
  const hijos = Array.isArray(o.content) ? o.content.map((h) => sanearNodo(h, prof + 1, c)).filter((h): h is JsonNodo => !!h) : [];
  const nodo: JsonNodo = { type: tipo, ...(attrs ? { attrs } : {}) };
  if (hijos.length) nodo.content = hijos;
  return reparar(nodo);
}

/** Lo mínimo que exige el esquema de cada contenedor (si no, TipTap abre el documento VACÍO sin error). */
function reparar(n: JsonNodo): JsonNodo | null {
  const hijos = n.content ?? [];
  const soloDe = (tipo: string) => hijos.filter((h) => h.type === tipo);
  switch (n.type) {
    case NODOS.parrafo:
    case NODOS.titulo:
      // Sólo texto y saltos adentro.
      n.content = hijos.filter((h) => h.type === NODOS.texto || h.type === NODOS.salto);
      if (!n.content.length) delete n.content;
      return n;
    case NODOS.vinetas:
    case NODOS.numerada: {
      const items = soloDe(NODOS.item).map(conBloques);
      return items.length ? { ...n, content: items } : null;
    }
    case NODOS.tareas: {
      const items = soloDe(NODOS.tarea).map(conBloques);
      return items.length ? { ...n, content: items } : null;
    }
    case NODOS.item:
    case NODOS.tarea:
      return conBloques(n);
    case NODOS.cita:
    case NODOS.destacado: {
      const bloques = hijos.filter((h) => h.type === NODOS.parrafo);
      return { ...n, content: bloques.length ? bloques : [{ type: NODOS.parrafo }] };
    }
    case NODOS.desplegable: {
      // El primer hijo es el renglón que se ve plegado (un párrafo); después, cualquier bloque.
      const bloques = hijos.filter((h) => BLOQUES_DE_PRIMER_NIVEL.has(h.type) && h.type !== NODOS.desplegable);
      if (!bloques.length || bloques[0].type !== NODOS.parrafo) bloques.unshift({ type: NODOS.parrafo });
      return { ...n, content: bloques };
    }
    case NODOS.separador:
      delete n.content;
      return n;
    case NODOS.tabla: {
      const filas = soloDe(NODOS.fila).filter((f) => (f.content ?? []).length);
      return filas.length ? { ...n, content: filas.slice(0, 100) } : null;
    }
    case NODOS.fila: {
      const celdas = hijos.filter((h) => h.type === NODOS.celda || h.type === NODOS.celdaTitulo).map((c) => conBloques(c));
      return celdas.length ? { ...n, content: celdas.slice(0, 20) } : null;
    }
    case NODOS.celda:
    case NODOS.celdaTitulo:
      return conBloques(n);
    default:
      return n;
  }
}

/** Un ítem o una celda: al menos un párrafo, y sólo bloques adentro. */
function conBloques(n: JsonNodo): JsonNodo {
  const adentro = (n.content ?? []).filter((h) => h.type !== NODOS.texto && h.type !== NODOS.salto && h.type !== NODOS.item && h.type !== NODOS.tarea);
  if (!adentro.length || adentro[0].type !== NODOS.parrafo) adentro.unshift({ type: NODOS.parrafo });
  return { ...n, content: adentro };
}

/**
 * Sanea un documento entero: lo de arriba nodo por nodo, sólo bloques en el primer nivel, un id ÚNICO en cada bloque de
 * primer nivel (el repetido o faltante recibe uno nuevo) y al menos un renglón. Falla si pasa los topes: la pantalla lo
 * dice («demasiado largo»), nunca se recorta en silencio.
 */
export function sanearContenido(raw: unknown): ResultadoSaneo {
  const c: Contador = { nodos: 0 };
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const crudos = Array.isArray(o.content) ? o.content : [];
  if (crudos.length > TOPES.bloques) return { ok: false, error: `El guion tiene más de ${TOPES.bloques} bloques.` };
  const vistos = new Set<string>();
  const content: JsonNodo[] = [];
  for (const raw of crudos) {
    let b = sanearNodo(raw, 1, c);
    if (!b) continue;
    // En el primer nivel sólo bloques: un ítem suelto se envuelve en su lista; lo demás, en un párrafo.
    if (b.type === NODOS.item) b = { type: NODOS.vinetas, content: [b] };
    else if (b.type === NODOS.tarea) b = { type: NODOS.tareas, content: [b] };
    else if (!BLOQUES_DE_PRIMER_NIVEL.has(b.type)) {
      const t = textoDeNodo(b).trim();
      if (!t) continue;
      b = { type: NODOS.parrafo, content: [{ type: NODOS.texto, text: t.slice(0, TOPES.texto) }] };
    }
    const bid = typeof b.attrs?.bid === 'string' && BID_RE.test(b.attrs.bid) && !vistos.has(b.attrs.bid) ? b.attrs.bid : bidNuevo();
    vistos.add(bid);
    b.attrs = { ...(b.attrs ?? {}), bid };
    content.push(b);
  }
  if (c.nodos > 20_000) return { ok: false, error: 'El guion es demasiado largo.' };
  const doc: JsonNodo = { type: NODOS.doc, content: content.length ? content : [parrafo()] };
  const bytes = new TextEncoder().encode(JSON.stringify(doc)).length;
  if (bytes > TOPES.bytesContenido) return { ok: false, error: 'El guion es demasiado largo para guardarlo.' };
  return { ok: true, doc, bytes };
}
