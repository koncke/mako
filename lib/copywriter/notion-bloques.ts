// =============================================================================
// copywriter/notion-bloques — el documento guardado ⇄ los bloques de BlockNote (PURO)
// =============================================================================
// Pedido de Martín (29/10/2026): «quiero que Copywriter sea una réplica de Notion, busca un repo que sea copia, y
// replícalo». El editor es BlockNote (github.com/TypeCellOS/BlockNote, 0.56.0 del 14/10/2026, MPL-2.0 en el núcleo; los
// paquetes XL son GPL y NO se usan): bloques, «/», el asa ⋮⋮ para arrastrar, listas, desplegables y tablas, como
// Notion. Diseño: docs/diseno-copywriter.md (D11).
//
// LO QUE SE GUARDA NO CAMBIA: es el JSON de ProseMirror de doc.ts, con su `bid` por bloque de primer nivel, el saneo, las
// secciones y las operaciones de MaKo (todo probado, y es lo que lee la API). Este módulo traduce en los dos sentidos:
//   · aBloques(doc)      → lo que abre BlockNote (cada bloque con su id = el `bid`; una lista son N ítems).
//   · deBloques(bloques) → lo que se guarda (los ítems seguidos del mismo tipo vuelven a ser UNA lista con el `bid` del
//     primero; lo que el formato guardado no anida —un párrafo con hijos— sale a continuación, al mismo nivel: no se
//     pierde texto).
// Tres decisiones que no se ven:
//   · EL ID ES ESTABLE. Un id de BlockNote que no es un `bid` (los nuevos son uuid) se convierte SIEMPRE en el mismo
//     `bid` (`bidDe`): dos lecturas seguidas del mismo editor dan los mismos ids, y MaKo apunta por id.
//   · LA SECCIÓN DEL GUION (`attrs.seccion` de un Título 2) no es una propiedad de BlockNote: viaja aparte, en un mapa
//     id → etiqueta que el editor guarda mientras la página está abierta.
//   · UN ID REPETIDO NO ENTRA A BLOCKNOTE (exige ids únicos en todo el documento): el segundo va sin id y BlockNote le
//     pone uno.
// SIN imports de BlockNote: los tipos de acá son su forma JSON (la de `editor.document`), así lo usan el server y los tests.
// =============================================================================

import { BID_RE, EMOJI_DESTACADO, NODOS, esEtiqueta } from './doc';
import type { JsonNodo } from './tipos';

/** Los estilos de texto que guarda el documento (los colores de BlockNote no: el esquema del editor no los ofrece). */
export type EstilosBN = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; code?: boolean };
export type TextoBN = { type: 'text'; text: string; styles: EstilosBN };
export type EnlaceBN = { type: 'link'; href: string; content: TextoBN[] };
export type EnLineaBN = TextoBN | EnlaceBN;
export type CeldaBN = { type: 'tableCell'; props?: Record<string, unknown>; content: EnLineaBN[] };
export type TablaBN = { type: 'tableContent'; columnWidths?: (number | undefined | null)[]; headerRows?: number; rows: { cells: (EnLineaBN[] | CeldaBN)[] }[] };
export type BloqueBN = {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: EnLineaBN[] | TablaBN | string;
  children?: BloqueBN[];
};
/** id de un Título 2 → la etiqueta de su sección (`GANCHO`). */
export type Secciones = Record<string, string>;

/** Los tipos de bloque del editor (el esquema de app/copywriter/editor/esquema.ts usa EXACTAMENTE estos). */
export const TIPOS_BN = {
  parrafo: 'paragraph',
  titulo: 'heading',
  vineta: 'bulletListItem',
  numero: 'numberedListItem',
  tarea: 'checkListItem',
  desplegable: 'toggleListItem',
  cita: 'quote',
  divisor: 'divider',
  tabla: 'table',
  destacado: 'callout',
} as const;

const MARCA_DE_ESTILO: Readonly<Record<keyof EstilosBN, string>> = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strike', code: 'code' };
const ESTILO_DE_MARCA: Readonly<Record<string, keyof EstilosBN>> = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strike', code: 'code' };

/** El `bid` de un id de BlockNote: él mismo si ya lo es; si no, siempre el mismo derivado de él. */
export function bidDe(id: unknown): string | null {
  if (typeof id !== 'string' || !id) return null;
  if (BID_RE.test(id)) return id;
  let s = id.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s) return null;
  while (s.length < 8) s += '0';
  return `b${s.slice(0, 15)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo guardado → BlockNote
// ─────────────────────────────────────────────────────────────────────────────

/** El texto con sus estilos y enlaces (un `hardBreak` es un «\n» dentro del texto, como lo escribe BlockNote). */
export function enLineaDe(nodos: readonly JsonNodo[] | undefined): EnLineaBN[] {
  const out: EnLineaBN[] = [];
  const empujarTexto = (destino: EnLineaBN[] | TextoBN[], text: string, styles: EstilosBN) => {
    const prev = destino[destino.length - 1];
    if (prev && prev.type === 'text' && JSON.stringify(prev.styles) === JSON.stringify(styles)) { prev.text += text; return; }
    (destino as TextoBN[]).push({ type: 'text', text, styles });
  };
  for (const n of nodos ?? []) {
    if (n.type === NODOS.salto) {
      const ult = out[out.length - 1];
      if (ult && ult.type === 'link') ult.content.push({ type: 'text', text: '\n', styles: {} });
      else empujarTexto(out, '\n', {});
      continue;
    }
    if (n.type !== NODOS.texto || !n.text) continue;
    const styles: EstilosBN = {};
    let href: string | null = null;
    for (const m of n.marks ?? []) {
      if (m.type === 'link' && typeof m.attrs?.href === 'string') href = m.attrs.href;
      else if (ESTILO_DE_MARCA[m.type]) styles[ESTILO_DE_MARCA[m.type]] = true;
    }
    if (href) {
      const ult = out[out.length - 1];
      if (ult && ult.type === 'link' && ult.href === href) empujarTexto(ult.content, n.text, styles);
      else out.push({ type: 'link', href, content: [{ type: 'text', text: n.text, styles }] });
      continue;
    }
    empujarTexto(out, n.text, styles);
  }
  return out;
}

/** El renglón de adentro de un contenedor de párrafos (cita, celda, ítem): los párrafos unidos por un salto. */
function enLineaDeParrafos(hijos: readonly JsonNodo[] | undefined): EnLineaBN[] {
  const nodos: JsonNodo[] = [];
  for (const h of hijos ?? []) {
    if (h.type !== NODOS.parrafo && h.type !== NODOS.titulo) continue;
    if (nodos.length) nodos.push({ type: NODOS.salto });
    nodos.push(...(h.content ?? []));
  }
  return enLineaDe(nodos);
}

type Contexto = { usados: Set<string>; secciones: Secciones };

/** El id que va a BlockNote: el pedido si no se usó todavía (BlockNote exige ids únicos), si no, ninguno. */
function idLibre(c: Contexto, id: unknown): { id?: string } {
  if (typeof id !== 'string' || !id || c.usados.has(id)) return {};
  c.usados.add(id);
  return { id };
}

const bidDeNodo = (n: JsonNodo): string | null => (typeof n.attrs?.bid === 'string' && BID_RE.test(n.attrs.bid) ? n.attrs.bid : null);

/** Un nodo guardado → uno o más bloques de BlockNote (una lista son sus ítems). */
function bloquesDeNodo(n: JsonNodo, c: Contexto): BloqueBN[] {
  const bid = bidDeNodo(n);
  switch (n.type) {
    case NODOS.parrafo:
      return [{ ...idLibre(c, bid), type: TIPOS_BN.parrafo, content: enLineaDe(n.content) }];
    case NODOS.titulo: {
      const level = [1, 2, 3].includes(Number(n.attrs?.level)) ? Number(n.attrs?.level) : 2;
      const b: BloqueBN = { ...idLibre(c, bid), type: TIPOS_BN.titulo, props: { level }, content: enLineaDe(n.content) };
      if (b.id && esEtiqueta(n.attrs?.seccion)) c.secciones[b.id] = n.attrs!.seccion as string;
      return [b];
    }
    case NODOS.vinetas:
    case NODOS.numerada:
    case NODOS.tareas: {
      const tipo = n.type === NODOS.vinetas ? TIPOS_BN.vineta : n.type === NODOS.numerada ? TIPOS_BN.numero : TIPOS_BN.tarea;
      const start = n.type === NODOS.numerada && Number(n.attrs?.start) > 1 ? Number(n.attrs?.start) : null;
      return (n.content ?? []).map((item, k) => {
        const [primero, ...resto] = item.content ?? [];
        const props: Record<string, unknown> = {};
        if (tipo === TIPOS_BN.tarea) props.checked = item.attrs?.checked === true;
        if (k === 0 && start) props.start = start;
        const hijos = resto.flatMap((h) => bloquesDeNodo(h, c));
        const id = k === 0 ? bid : bid ? `${bid}x${k}` : null;
        return {
          ...idLibre(c, id), type: tipo, ...(Object.keys(props).length ? { props } : {}),
          content: primero?.type === NODOS.parrafo ? enLineaDe(primero.content) : [],
          ...(hijos.length ? { children: hijos } : {}),
        };
      });
    }
    case NODOS.cita:
      return [{ ...idLibre(c, bid), type: TIPOS_BN.cita, content: enLineaDeParrafos(n.content) }];
    case NODOS.separador:
      return [{ ...idLibre(c, bid), type: TIPOS_BN.divisor }];
    case NODOS.destacado: {
      const [primero, ...resto] = n.content ?? [];
      const emoji = typeof n.attrs?.emoji === 'string' && n.attrs.emoji ? n.attrs.emoji : EMOJI_DESTACADO;
      const hijos = resto.flatMap((h) => bloquesDeNodo(h, c));
      return [{ ...idLibre(c, bid), type: TIPOS_BN.destacado, props: { emoji }, content: enLineaDe(primero?.content), ...(hijos.length ? { children: hijos } : {}) }];
    }
    case NODOS.desplegable: {
      const [primero, ...resto] = n.content ?? [];
      const hijos = resto.flatMap((h) => bloquesDeNodo(h, c));
      return [{ ...idLibre(c, bid), type: TIPOS_BN.desplegable, content: enLineaDe(primero?.content), ...(hijos.length ? { children: hijos } : {}) }];
    }
    case NODOS.tabla: {
      const filas = n.content ?? [];
      const encabezado = filas.length > 1 && (filas[0].content ?? []).every((celda) => celda.type === NODOS.celdaTitulo);
      return [{
        ...idLibre(c, bid), type: TIPOS_BN.tabla,
        content: {
          type: 'tableContent',
          ...(encabezado ? { headerRows: 1 } : {}),
          rows: filas.map((f) => ({
            cells: (f.content ?? []).map((celda) => {
              const props: Record<string, unknown> = {};
              if (Number(celda.attrs?.colspan) > 1) props.colspan = Number(celda.attrs?.colspan);
              if (Number(celda.attrs?.rowspan) > 1) props.rowspan = Number(celda.attrs?.rowspan);
              return { type: 'tableCell' as const, props, content: enLineaDeParrafos(celda.content) };
            }),
          })),
        },
      }];
    }
    default: {
      // Lo que no se conoce: su texto, en un párrafo (no se tira lo escrito).
      const t = textoPlano(n);
      return t ? [{ ...idLibre(c, bid), type: TIPOS_BN.parrafo, content: [{ type: 'text', text: t, styles: {} }] }] : [];
    }
  }
}

function textoPlano(n: JsonNodo): string {
  if (n.type === NODOS.texto) return n.text ?? '';
  if (n.type === NODOS.salto) return '\n';
  return (n.content ?? []).map(textoPlano).join('');
}

/** El documento guardado → los bloques que abre BlockNote, y las secciones del guion por id. */
export function aBloques(doc: JsonNodo): { bloques: BloqueBN[]; secciones: Secciones } {
  const c: Contexto = { usados: new Set(), secciones: {} };
  const bloques = (doc.content ?? []).flatMap((n) => bloquesDeNodo(n, c));
  return { bloques: bloques.length ? bloques : [{ type: TIPOS_BN.parrafo, content: [] }], secciones: c.secciones };
}

// ─────────────────────────────────────────────────────────────────────────────
// BlockNote → lo guardado
// ─────────────────────────────────────────────────────────────────────────────

const esEnlace = (x: unknown): x is EnlaceBN => !!x && typeof x === 'object' && (x as { type?: unknown }).type === 'link';

/** Un texto con sus marcas, partido en sus saltos de renglón. */
function nodosDeTexto(text: string, styles: EstilosBN | undefined, href: string | null): JsonNodo[] {
  const marks: NonNullable<JsonNodo['marks']> = [];
  for (const k of Object.keys(MARCA_DE_ESTILO) as (keyof EstilosBN)[]) if (styles?.[k] === true) marks.push({ type: MARCA_DE_ESTILO[k] });
  if (href) marks.push({ type: 'link', attrs: { href } });
  const out: JsonNodo[] = [];
  text.split('\n').forEach((parte, i) => {
    if (i > 0) out.push({ type: NODOS.salto });
    if (parte) out.push({ type: NODOS.texto, text: parte, ...(marks.length ? { marks } : {}) });
  });
  return out;
}

/** El contenido en línea de BlockNote → los nodos de texto guardados. */
export function nodosDeEnLinea(content: BloqueBN['content'] | CeldaBN['content'] | undefined): JsonNodo[] {
  if (typeof content === 'string') return nodosDeTexto(content, {}, null);
  if (!Array.isArray(content)) return [];
  const out: JsonNodo[] = [];
  for (const x of content as unknown[]) {
    if (esEnlace(x)) {
      for (const t of x.content ?? []) if (t && typeof t.text === 'string') out.push(...nodosDeTexto(t.text, t.styles, x.href));
      continue;
    }
    const t = x as Partial<TextoBN>;
    if (t && t.type === 'text' && typeof t.text === 'string') out.push(...nodosDeTexto(t.text, t.styles, null));
  }
  return out;
}

function parrafoDe(content: BloqueBN['content'] | CeldaBN['content'] | undefined, bid?: string | null): JsonNodo {
  const c = nodosDeEnLinea(content);
  return { type: NODOS.parrafo, ...(bid !== undefined ? { attrs: { bid } } : {}), ...(c.length ? { content: c } : {}) };
}

const TIPO_DE_LISTA: Readonly<Record<string, string>> = { [TIPOS_BN.vineta]: NODOS.vinetas, [TIPOS_BN.numero]: NODOS.numerada, [TIPOS_BN.tarea]: NODOS.tareas };

/** Una lista de bloques de BlockNote → los nodos guardados (los ítems seguidos del mismo tipo son UNA lista). */
function nodosDeBloques(bloques: readonly BloqueBN[], secciones: Secciones, usados: Set<string>): JsonNodo[] {
  const out: JsonNodo[] = [];
  /** El `bid` de un bloque: el suyo (o el derivado) si no se usó; si no, ninguno (el saneo pone uno). */
  const bidLibre = (id: unknown): string | null => {
    const b = bidDe(id);
    if (!b || usados.has(b)) return null;
    usados.add(b);
    return b;
  };
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (!b || typeof b !== 'object') continue;
    const lista = TIPO_DE_LISTA[b.type];
    if (lista) {
      const corrida: BloqueBN[] = [];
      while (i < bloques.length && bloques[i]?.type === b.type) corrida.push(bloques[i++]);
      i--;
      const attrs: Record<string, unknown> = { bid: bidLibre(b.id) };
      if (lista === NODOS.numerada) attrs.start = Number(b.props?.start) > 1 ? Math.round(Number(b.props?.start)) : 1;
      for (const it of corrida.slice(1)) bidLibre(it.id); // los ids de los otros ítems no se reparten a otro bloque
      out.push({
        type: lista, attrs,
        content: corrida.map((it) => ({
          type: lista === NODOS.tareas ? NODOS.tarea : NODOS.item,
          ...(lista === NODOS.tareas ? { attrs: { checked: it.props?.checked === true } } : {}),
          content: [parrafoDe(it.content), ...nodosDeBloques(it.children ?? [], secciones, usados)],
        })),
      });
      continue;
    }
    const hijos = b.children ?? [];
    switch (b.type) {
      case TIPOS_BN.titulo: {
        const level = [1, 2, 3].includes(Number(b.props?.level)) ? Number(b.props?.level) : 3;
        const seccion = typeof b.id === 'string' && esEtiqueta(secciones[b.id]) && level === 2 ? secciones[b.id] : null;
        const c = nodosDeEnLinea(b.content);
        out.push({ type: NODOS.titulo, attrs: { level, bid: bidLibre(b.id), seccion }, ...(c.length ? { content: c } : {}) });
        out.push(...nodosDeBloques(hijos, secciones, usados));
        break;
      }
      case TIPOS_BN.cita:
        out.push({ type: NODOS.cita, attrs: { bid: bidLibre(b.id) }, content: [parrafoDe(b.content)] });
        out.push(...nodosDeBloques(hijos, secciones, usados));
        break;
      case TIPOS_BN.divisor:
        out.push({ type: NODOS.separador, attrs: { bid: bidLibre(b.id) } });
        out.push(...nodosDeBloques(hijos, secciones, usados));
        break;
      case TIPOS_BN.destacado: {
        // Adentro de un Destacado sólo van párrafos: los otros hijos salen a continuación, al mismo nivel.
        const emoji = typeof b.props?.emoji === 'string' && b.props.emoji ? b.props.emoji : EMOJI_DESTACADO;
        const adentro = hijos.filter((h) => h.type === TIPOS_BN.parrafo && !(h.children ?? []).length);
        const afuera = hijos.filter((h) => !adentro.includes(h));
        out.push({ type: NODOS.destacado, attrs: { emoji, bid: bidLibre(b.id) }, content: [parrafoDe(b.content), ...adentro.map((h) => parrafoDe(h.content))] });
        out.push(...nodosDeBloques(afuera, secciones, usados));
        break;
      }
      case TIPOS_BN.desplegable:
        out.push({ type: NODOS.desplegable, attrs: { abierto: true, bid: bidLibre(b.id) }, content: [parrafoDe(b.content), ...nodosDeBloques(hijos, secciones, usados)] });
        break;
      case TIPOS_BN.tabla: {
        const t = b.content as TablaBN | undefined;
        const filas = Array.isArray(t?.rows) ? t!.rows : [];
        const encabezado = Number(t?.headerRows) >= 1;
        const nodosFilas = filas.map((f, k) => ({
          type: NODOS.fila,
          content: (Array.isArray(f?.cells) ? f.cells : []).map((celda) => {
            const esCelda = !Array.isArray(celda) && (celda as CeldaBN)?.type === 'tableCell';
            const contenido = esCelda ? (celda as CeldaBN).content : (celda as EnLineaBN[]);
            const props = esCelda ? (celda as CeldaBN).props ?? {} : {};
            const n = (x: unknown) => (Number.isInteger(x) && (x as number) > 1 ? (x as number) : 1);
            return { type: encabezado && k === 0 ? NODOS.celdaTitulo : NODOS.celda, attrs: { colspan: n(props.colspan), rowspan: n(props.rowspan), colwidth: null }, content: [parrafoDe(contenido)] };
          }),
        })).filter((f) => f.content.length);
        if (nodosFilas.length) out.push({ type: NODOS.tabla, attrs: { bid: bidLibre(b.id) }, content: nodosFilas });
        out.push(...nodosDeBloques(hijos, secciones, usados));
        break;
      }
      default:
        // Un párrafo (y cualquier tipo que el formato guardado no tenga: su texto, en un párrafo).
        out.push(parrafoDe(b.content, bidLibre(b.id)));
        out.push(...nodosDeBloques(hijos, secciones, usados));
    }
  }
  return out;
}

/** Los bloques de BlockNote → el documento que se guarda (el server lo vuelve a sanear igual). */
export function deBloques(bloques: readonly BloqueBN[], secciones: Secciones = {}): JsonNodo {
  const content = nodosDeBloques(Array.isArray(bloques) ? bloques : [], secciones, new Set());
  return { type: NODOS.doc, content: content.length ? content : [{ type: NODOS.parrafo, attrs: { bid: null } }] };
}

/** Las secciones de un documento guardado (id → etiqueta), para el editor abierto. */
export const seccionesDe = (doc: JsonNodo): Secciones => aBloques(doc).secciones;
