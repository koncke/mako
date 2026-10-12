// =============================================================================
// editor-landing/validar — el saneo de lo que se GUARDA (contenido y configuración)
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1-D3).
//
// `sanearContenido(raw)` lleva cualquier cosa a un `LandingContenido` válido y dice qué tiró y
// por qué; `sanearConfig(raw)` hace lo mismo con la configuración del sitio. Lo usan el server al
// guardar y al leer (server.ts), la publicación (publicar.ts) y el render (la configuración).
//
// Qué mira:
//   · ESTRUCTURA: `doc.content` sólo tarjetas (los bloques sueltos se envuelven en una sección
//     nueva, no se tiran); dentro de cada nodo, sólo lo que ese nodo admite (`HIJOS_PERMITIDOS`).
//     Nodos y marcas desconocidos, afuera, con su motivo.
//   · ATRIBUTOS: cada valor contra su lista cerrada de doc.ts, con los normalizadores de
//     especificacion.ts (la misma regla que usa la forma HTML: una sola copia).
//   · TOPES de doc.ts (páginas, secciones por página, caracteres por texto, campos, series…).
//   · IDS: de sección y de campo únicos en TODA la landing (un duplicado se regenera); páginas
//     con id único y ruta válida y única, con UNA sola '' (el inicio).
//   · ORÍGENES: imágenes y videos sólo del bucket `landing-imagenes` (`srcPermitido`); hrefs sólo
//     http(s), mailto:, tel:, `#t-<id>`, `#` y `pagina:<id>`; el insertado, de `embedDe`.
//
// ⚠️ LO QUE SALE DE ACÁ LO CARGA TIPTAP. Si el JSON no cumple el esquema del editor, TipTap
//    no avisa: carga un documento VACÍO, y el autoguardado lo guardaría encima. Por eso este
//    módulo exporta el modelo de contenido (`HIJOS_PERMITIDOS`, `CONTENIDO_TIPTAP`): el esquema
//    de las extensiones (paquete G) tiene que ser IGUAL o más permisivo, nunca más estricto.
//    Y por eso nunca sale un texto vacío (ProseMirror lo rechaza), una tarjeta sin contenido, un
//    ítem de lista que no arranca con un párrafo ni un desplegable sin su título y su cuerpo.
// ⚠️ Cada descarte tiene MOTIVO (AGENTS.md: «Lo que un saneador DESCARTA queda escrito»). Un
//    `continue` mudo hace indistinguibles «no llegó» y «lo tiramos nosotros».
// ⚠️ PURO (sin server-only): lo ejecutan los tests y lo puede usar el editor para avisar antes.
// =============================================================================

import {
  MAX_COLUMNAS, MAX_ITEMS_OPTIMIZADO, MIN_COLUMNAS, NODO, TOPES, enLista, nuevoId, rutaValida, slugDe,
  type JsonMarca, type JsonNodo, type LandingContenido, type Pagina,
} from './doc';
import { CONFIG_DEFAULT, FORMATOS, PROPORCIONES, type BotonNav, type ConfigLanding, type EnlaceNav } from './api-tipos';
import { OBJETIVOS_LANDING, type ObjetivoLanding } from '../landing-spec';
import {
  NORMALIZAR_MARCAS, NORMALIZAR_NODOS, attrsFormulario, attrsTarjeta, hrefPermitido, idValido, obj,
  srcImagen, textoLimpio,
} from './especificacion';

// ─────────────────────────────────────────────────────────────────────────────
// El modelo de contenido (lo comparten este saneo y el esquema de TipTap)
// ─────────────────────────────────────────────────────────────────────────────

const INLINE = ['text', 'hardBreak'] as const;
const TEXTO = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'horizontalRule', 'table'] as const;
const ATOMOS = [NODO.imagen, NODO.video, NODO.insertado, NODO.formulario, NODO.grafico, NODO.espaciador, NODO.htmlLibre] as const;
/** Lo que puede ir suelto en una sección. */
export const BLOQUES_TARJETA: readonly string[] = [...TEXTO, NODO.columnas, NODO.optimizado, NODO.botones, NODO.recuadro, NODO.desplegable, ...ATOMOS];
/** En una columna: todo menos otras columnas. */
const BLOQUES_COLUMNA: readonly string[] = BLOQUES_TARJETA.filter((t) => t !== NODO.columnas);
/** En un ítem de diseño optimizado, un recuadro o el cuerpo de un desplegable: ni columnas ni otro diseño optimizado. */
const BLOQUES_ANIDADOS: readonly string[] = BLOQUES_TARJETA.filter((t) => t !== NODO.columnas && t !== NODO.optimizado);
/** Después del primer párrafo de un ítem de lista. */
const BLOQUES_LISTA = ['paragraph', 'bulletList', 'orderedList', 'taskList'] as const;
/** En una cita y en una celda de tabla. */
const BLOQUES_TEXTO_SIMPLE = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList'] as const;

/** Qué hijos admite cada nodo. Los que no aparecen no llevan contenido (átomos). */
export const HIJOS_PERMITIDOS: Readonly<Record<string, readonly string[]>> = {
  doc: [NODO.tarjeta],
  [NODO.tarjeta]: BLOQUES_TARJETA,
  [NODO.columnas]: [NODO.columna],
  [NODO.columna]: BLOQUES_COLUMNA,
  [NODO.optimizado]: [NODO.optimizadoItem],
  [NODO.optimizadoItem]: BLOQUES_ANIDADOS,
  [NODO.botones]: [NODO.boton],
  [NODO.boton]: ['text'],
  [NODO.recuadro]: BLOQUES_ANIDADOS,
  [NODO.desplegable]: [NODO.desplegableTitulo, NODO.desplegableCuerpo],
  [NODO.desplegableTitulo]: INLINE,
  [NODO.desplegableCuerpo]: BLOQUES_ANIDADOS,
  paragraph: INLINE,
  heading: INLINE,
  bulletList: ['listItem'],
  orderedList: ['listItem'],
  listItem: BLOQUES_LISTA,
  taskList: ['taskItem'],
  taskItem: BLOQUES_LISTA,
  blockquote: BLOQUES_TEXTO_SIMPLE,
  table: ['tableRow'],
  tableRow: ['tableCell', 'tableHeader'],
  tableCell: BLOQUES_TEXTO_SIMPLE,
  tableHeader: BLOQUES_TEXTO_SIMPLE,
};

/** Nodos cuyo contenido es texto en línea (y no bloques). */
const CONTENEDORES_INLINE = new Set<string>(['paragraph', 'heading', NODO.desplegableTitulo, NODO.boton]);
/** Nodos que no admiten marcas en su texto. */
export const SIN_MARCAS: ReadonlySet<string> = new Set<string>([NODO.boton]);

const alternativa = (l: readonly string[]) => `(${l.join(' | ')})`;

/**
 * El `content` de cada nodo en la sintaxis de ProseMirror/TipTap, derivado de `HIJOS_PERMITIDOS`.
 * PEDIDO al paquete G: usar EXACTAMENTE esto en `content:` (y `marks: ''` en `SIN_MARCAS`). Lo
 * que este saneo deja pasar tiene que poder cargarse en el editor.
 */
export const CONTENIDO_TIPTAP: Readonly<Record<string, string>> = {
  doc: 'tarjeta+',
  [NODO.tarjeta]: `${alternativa(BLOQUES_TARJETA)}+`,
  [NODO.columnas]: `columna{${MIN_COLUMNAS},${MAX_COLUMNAS}}`,
  [NODO.columna]: `${alternativa(BLOQUES_COLUMNA)}+`,
  [NODO.optimizado]: `optimizadoItem{1,${MAX_ITEMS_OPTIMIZADO}}`,
  [NODO.optimizadoItem]: `${alternativa(BLOQUES_ANIDADOS)}+`,
  [NODO.botones]: 'boton+',
  [NODO.boton]: 'text*',
  [NODO.recuadro]: `${alternativa(BLOQUES_ANIDADOS)}+`,
  [NODO.desplegable]: 'desplegableTitulo desplegableCuerpo',
  [NODO.desplegableTitulo]: '(text | hardBreak)*',
  [NODO.desplegableCuerpo]: `${alternativa(BLOQUES_ANIDADOS)}+`,
  paragraph: '(text | hardBreak)*',
  heading: '(text | hardBreak)*',
  bulletList: 'listItem+',
  orderedList: 'listItem+',
  listItem: `paragraph ${alternativa(BLOQUES_LISTA)}*`,
  taskList: 'taskItem+',
  taskItem: `paragraph ${alternativa(BLOQUES_LISTA)}*`,
  blockquote: `${alternativa(BLOQUES_TEXTO_SIMPLE)}+`,
  table: 'tableRow+',
  tableRow: '(tableCell | tableHeader)+',
  tableCell: `${alternativa(BLOQUES_TEXTO_SIMPLE)}+`,
  tableHeader: `${alternativa(BLOQUES_TEXTO_SIMPLE)}+`,
};

// ─────────────────────────────────────────────────────────────────────────────
// El recorrido
// ─────────────────────────────────────────────────────────────────────────────

const PROFUNDIDAD_MAX = 30;
const NODOS_MAX = 100_000;
const DESCARTES_MAX = 200;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/**
 * Atributos que TipTap agrega solo y que no son nuestros (`rel` y `class` del enlace, `type` de
 * la lista, `colwidth` de la tabla…): se descartan SIN motivo, o cada guardado anotaría lo mismo.
 */
const ATTRS_DE_TIPTAP = new Set(['class', 'rel', 'type', 'colwidth', 'dir', 'target', 'abierto']);

type Ctx = {
  d: string[]; omitidos: number; idsTarjeta: Set<string>; idsCampo: Set<string>; nodos: number; cortado: boolean;
  /** Ids de «HTML personalizado» ya usados, la sección que se está saneando y cuántos lleva adentro. */
  idsHtml: Set<string>; tarjeta: string; htmlEnTarjeta: number;
};

/** Hash corto y DETERMINISTA (FNV-1a de 32 bits, en base 36). */
function hashCorto(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/**
 * El id de un «HTML personalizado» que no lo trae (o lo trae repetido). DETERMINISTA, no al azar
 * como el de una sección: la vista previa del borrador (publicar.ts, `leerVistaPrevia`) sanea en
 * CADA pedido, y la ruta del bloque (app/l/html/[docId]/[bloque]) vuelve a sanear para encontrarlo.
 * Con un id al azar, la página pediría `/l/html/<doc>/hX` y la ruta buscaría `hY`: 404. Sale de la
 * sección que lo contiene y de su orden adentro, así que el mismo contenido da siempre el mismo id.
 */
function idHtmlDerivado(ctx: Ctx): string {
  const base = `h${hashCorto(`${ctx.tarjeta}:${ctx.htmlEnTarjeta}`)}`;
  let id = base;
  for (let i = 2; ctx.idsHtml.has(id); i++) id = `${base}-${i}`;
  return id;
}

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const recorte = (v: unknown, n = 60): string => {
  let s: string;
  try { s = typeof v === 'string' ? v : JSON.stringify(v) ?? String(v); } catch { s = String(v); }
  s = s.replace(CONTROL, '');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};
const parrafo = (): JsonNodo => ({ type: 'paragraph' });

function descartar(ctx: Ctx, motivo: string): void {
  if (ctx.d.length < DESCARTES_MAX) ctx.d.push(motivo);
  else ctx.omitidos++;
}

/** Un id que no esté en el set (y queda anotado). */
function idUnico(usados: Set<string>, prefijo: string): string {
  let id = nuevoId(prefijo);
  while (usados.has(id)) id = nuevoId(prefijo);
  usados.add(id);
  return id;
}

const igual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

/**
 * Los nodos propios llevan TODOS sus atributos; los de TipTap, sólo los que no son null. Se exporta
 * para ia-bloques.ts (la IA produce contenido YA saneado): había una copia allá.
 */
const NODOS_PROPIOS = new Set<string>(Object.values(NODO));
export function compactar(tipo: string, attrs: Record<string, unknown>): Record<string, unknown> | undefined {
  if (NODOS_PROPIOS.has(tipo)) return Object.keys(attrs).length ? attrs : undefined;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(attrs)) if (attrs[k] !== null && attrs[k] !== undefined) out[k] = attrs[k];
  return Object.keys(out).length ? out : undefined;
}

/**
 * Normaliza los atributos de un nodo y anota lo que cambió: un atributo inventado (con valor)
 * o un valor fuera de su lista. `saltear` = claves con un motivo propio más claro.
 */
function attrsConMotivo(tipo: string, raw: unknown, ctx: Ctx, donde: string, saltear: readonly string[] = []): Record<string, unknown> {
  const norm = NORMALIZAR_NODOS[tipo](raw);
  const r = obj(raw);
  for (const k of Object.keys(r)) {
    if (saltear.includes(k)) continue;
    const v = r[k];
    if (!(k in norm)) {
      if (/^on/i.test(k) || (v != null && v !== false && v !== '' && !ATTRS_DE_TIPTAP.has(k))) {
        descartar(ctx, `atributo desconocido «${recorte(k, 30)}» en ${tipo} (${donde}): se quita`);
      }
      continue;
    }
    if (v === undefined) continue;
    if (!igual(v, norm[k])) descartar(ctx, `«${k}» inválido en ${tipo} (${donde}): ${recorte(v, 40)} → ${recorte(norm[k], 40)}`);
  }
  return norm;
}

function sanearMarcas(raw: unknown, ctx: Ctx, donde: string): JsonMarca[] {
  const out: JsonMarca[] = [];
  const vistas = new Set<string>();
  for (const m of arr(raw)) {
    if (!esObj(m) || typeof m.type !== 'string') { descartar(ctx, `una marca sin tipo en ${donde}: se quita`); continue; }
    const fn = NORMALIZAR_MARCAS[m.type];
    if (!fn) { descartar(ctx, `marca desconocida «${recorte(m.type, 30)}» en ${donde}: se quita`); continue; }
    if (vistas.has(m.type)) continue;
    const a = fn(m.attrs);
    if (!a) {
      if (m.type === 'link') descartar(ctx, `enlace no permitido «${recorte(obj(m.attrs).href)}» en ${donde}: queda como texto`);
      continue;
    }
    vistas.add(m.type);
    const attrs = compactar(m.type, a);
    out.push(attrs ? { type: m.type, attrs } : { type: m.type });
  }
  return out;
}

/** Texto en línea: sólo `text` (no vacío) y `hardBreak`. En un botón, texto pelado. */
function sanearInline(raw: unknown, ctx: Ctx, donde: string, soloTexto: boolean): JsonNodo[] {
  const out: JsonNodo[] = [];
  for (const h of arr(raw)) {
    if (!esObj(h) || typeof h.type !== 'string') { descartar(ctx, `un nodo sin tipo en ${donde}: se quita`); continue; }
    if (++ctx.nodos > NODOS_MAX) { cortar(ctx); break; }
    if (h.type === 'hardBreak') {
      if (soloTexto) descartar(ctx, `salto de línea en un botón (${donde}): se quita`);
      else out.push({ type: 'hardBreak' });
      continue;
    }
    if (h.type !== 'text') {
      descartar(ctx, NORMALIZAR_NODOS[h.type] ? `«${h.type}» no puede ir dentro de un texto (${donde}): se quita` : `nodo desconocido «${recorte(h.type, 30)}» en ${donde}: se quita`);
      continue;
    }
    let t = typeof h.text === 'string' ? h.text.replace(CONTROL, '') : '';
    if (!t) continue; // ProseMirror no acepta un texto vacío.
    if (t.length > TOPES.caracteresTexto) {
      descartar(ctx, `texto de ${t.length} caracteres en ${donde}: se recorta a ${TOPES.caracteresTexto}`);
      t = t.slice(0, TOPES.caracteresTexto);
    }
    if (soloTexto && arr(h.marks).length) descartar(ctx, `un botón no lleva formato (${donde}): se quita`);
    const marks = soloTexto ? [] : sanearMarcas(h.marks, ctx, donde);
    out.push(marks.length ? { type: 'text', text: t, marks } : { type: 'text', text: t });
  }
  return out;
}

function cortar(ctx: Ctx): void {
  if (ctx.cortado) return;
  ctx.cortado = true;
  descartar(ctx, `la landing tiene más de ${NODOS_MAX} nodos: el resto se quita`);
}

/** Los hijos-bloque de un nodo: los que ese nodo admite, saneados. */
function sanearBloques(raw: unknown, permitidos: readonly string[], ctx: Ctx, prof: number, donde: string, padre: string): JsonNodo[] {
  const out: JsonNodo[] = [];
  for (const h of arr(raw)) {
    if (!esObj(h) || typeof h.type !== 'string') { descartar(ctx, `un bloque sin tipo en ${donde}: se quita`); continue; }
    if (!permitidos.includes(h.type)) {
      descartar(ctx, NORMALIZAR_NODOS[h.type] || h.type === NODO.tarjeta || h.type === 'text'
        ? `«${h.type}» no puede ir dentro de ${padre} (${donde}): se quita`
        : `nodo desconocido «${recorte(h.type, 30)}» en ${donde}: se quita`);
      continue;
    }
    const n = sanearNodo(h, ctx, prof + 1, donde);
    if (Array.isArray(n)) out.push(...n);
    else if (n) out.push(n);
  }
  return out;
}

/**
 * Un desplegable admite sólo su título y su cuerpo. Los bloques que vengan sueltos al lado (un
 * pegado, una IA que no siguió la forma) se mudan al cuerpo en vez de tirarse: es contenido de
 * la persona.
 */
function ordenarDesplegable(raw: unknown, ctx: Ctx, donde: string): unknown[] {
  const partes: unknown[] = [];
  const sueltos: unknown[] = [];
  for (const c of arr(raw)) {
    if (esObj(c) && typeof c.type === 'string' && c.type !== NODO.desplegableTitulo && c.type !== NODO.desplegableCuerpo && BLOQUES_ANIDADOS.includes(c.type)) sueltos.push(c);
    else partes.push(c);
  }
  if (!sueltos.length) return partes;
  descartar(ctx, `${sueltos.length} bloque(s) suelto(s) en un desplegable (${donde}): van a su cuerpo`);
  const i = partes.findIndex((c) => esObj(c) && c.type === NODO.desplegableCuerpo);
  if (i < 0) return [...partes, { type: NODO.desplegableCuerpo, content: sueltos }];
  const cuerpo = partes[i] as Record<string, unknown>;
  partes[i] = { ...cuerpo, content: [...arr(cuerpo.content), ...sueltos] };
  return partes;
}

/** Anchos de columnas por default: iguales en la grilla de 12 si se puede, si no 1fr cada una. */
const anchosIguales = (n: number): number[] => Array.from({ length: n }, () => (12 % n === 0 ? 12 / n : 1));

/**
 * Un nodo (que no es tarjeta). Devuelve `null` si se cae, o un ARRAY cuando el nodo se deshace y
 * deja su contenido en su lugar (unas «columnas» de una sola columna).
 */
function sanearNodo(h: Record<string, unknown>, ctx: Ctx, prof: number, donde: string): JsonNodo | JsonNodo[] | null {
  const tipo = h.type as string;
  if (prof > PROFUNDIDAD_MAX) { descartar(ctx, `«${tipo}» demasiado anidado en ${donde}: se quita`); return null; }
  if (++ctx.nodos > NODOS_MAX) { cortar(ctx); return null; }
  const crudo = obj(h.attrs);

  // Atributos (con motivos propios donde dicen algo más que «inválido»).
  let attrs: Record<string, unknown>;
  if (tipo === NODO.imagen || tipo === NODO.video) {
    attrs = attrsConMotivo(tipo, crudo, ctx, donde, ['src']);
    if (!attrs.src) {
      descartar(ctx, `${tipo === NODO.imagen ? 'imagen' : 'video'} fuera del almacenamiento de la landing «${recorte(crudo.src)}» en ${donde}: se quita`);
      return null;
    }
  } else if (tipo === NODO.insertado) {
    attrs = attrsConMotivo(tipo, crudo, ctx, donde, ['src', 'proveedor']);
    // VACÍO es un MARCADOR, no un error: «Insertar» y «Video de YouTube…» entran sin enlace (su
    // NodeView lo pide). Tirarlo hacía que el bloque desapareciera al recargar si se guardaba antes
    // de pegar el enlace, y anotaba un descarte en cada guardado. Se guarda vacío y sin motivo; el
    // render público no lo dibuja (render.ts: un átomo sin origen no sale). Sólo se quita, con
    // motivo, un enlace que vino y no es de un proveedor permitido.
    const pidio = typeof crudo.src === 'string' && crudo.src.trim() !== '';
    if (!attrs.src && pidio) { descartar(ctx, `insertado de un sitio no permitido «${recorte(crudo.src)}» en ${donde}: se quita`); return null; }
  } else if (tipo === NODO.formulario) {
    attrs = sanearFormulario(crudo, ctx, donde);
  } else if (tipo === NODO.htmlLibre) {
    attrs = attrsConMotivo(tipo, crudo, ctx, donde, ['html', 'id']);
    if (typeof crudo.html === 'string' && crudo.html.length > TOPES.htmlLibre) {
      descartar(ctx, `HTML personalizado de ${crudo.html.length} caracteres en ${donde} (tope ${TOPES.htmlLibre}): queda vacío`);
    }
    // Id estable y único en toda la landing (tanda 2: la publicada lo sirve en /l/html/<doc>/<id>).
    // Sin id es lo normal en un bloque recién insertado: se le pone uno SIN motivo (si no, cada
    // guardado anotaría lo mismo). Repetido (un copiar y pegar) o inválido, sí con motivo.
    ctx.htmlEnTarjeta++;
    const pedido = attrs.id as string | null;
    if (pedido && !ctx.idsHtml.has(pedido)) ctx.idsHtml.add(pedido);
    else {
      if (pedido || (crudo.id != null && crudo.id !== '')) descartar(ctx, `id de HTML personalizado ${pedido ? `repetido «${pedido}»` : 'inválido'} en ${donde}: se regenera`);
      const nuevo = idHtmlDerivado(ctx);
      ctx.idsHtml.add(nuevo);
      attrs = { ...attrs, id: nuevo };
    }
  } else if (tipo === NODO.boton) {
    attrs = attrsConMotivo(tipo, crudo, ctx, donde, ['href']);
    if (crudo.href !== undefined && crudo.href !== '' && !attrs.href) descartar(ctx, `destino de botón no permitido «${recorte(crudo.href)}» en ${donde}: queda sin destino`);
  } else {
    attrs = attrsConMotivo(tipo, crudo, ctx, donde);
  }

  // Contenido.
  let content: JsonNodo[] = [];
  const permitidos = HIJOS_PERMITIDOS[tipo];
  if (CONTENEDORES_INLINE.has(tipo)) {
    content = sanearInline(h.content, ctx, donde, SIN_MARCAS.has(tipo));
  } else if (permitidos) {
    const crudos = tipo === NODO.desplegable ? ordenarDesplegable(h.content, ctx, donde) : h.content;
    content = sanearBloques(crudos, permitidos, ctx, prof, donde, tipo);
  } else if (arr(h.content).length) {
    descartar(ctx, `«${tipo}» no lleva contenido (${donde}): se quita lo que traía`);
  }

  // Arreglos de estructura (lo que el esquema exige y el JSON puede no traer).
  switch (tipo) {
    case NODO.columnas: {
      if (!content.length) { descartar(ctx, `columnas sin columnas en ${donde}: se quitan`); return null; }
      if (content.length < MIN_COLUMNAS) {
        descartar(ctx, `columnas con una sola columna en ${donde}: queda su contenido`);
        return content[0].content ?? [];
      }
      if (content.length > MAX_COLUMNAS) {
        descartar(ctx, `${content.length} columnas en ${donde} (tope ${MAX_COLUMNAS}): las de más se juntan en la última`);
        const sobra = content.slice(MAX_COLUMNAS - 1).flatMap((c) => c.content ?? []);
        content = [...content.slice(0, MAX_COLUMNAS - 1), { type: NODO.columna, content: sobra.length ? sobra : [parrafo()] }];
      }
      const anchos = attrs.anchos as number[];
      if (anchos.length !== content.length) {
        if (anchos.length || arr(crudo.anchos).length) descartar(ctx, `los anchos de las columnas no coinciden con ${content.length} columnas en ${donde}: se igualan`);
        attrs = { ...attrs, anchos: anchosIguales(content.length) };
      }
      break;
    }
    case NODO.optimizado:
      if (!content.length) { descartar(ctx, `diseño optimizado sin ítems en ${donde}: se quita`); return null; }
      if (content.length > MAX_ITEMS_OPTIMIZADO) {
        descartar(ctx, `${content.length} ítems en un diseño optimizado (${donde}): quedan ${MAX_ITEMS_OPTIMIZADO}`);
        content = content.slice(0, MAX_ITEMS_OPTIMIZADO);
      }
      break;
    case NODO.botones:
      if (!content.length) { descartar(ctx, `grupo de botones vacío en ${donde}: se quita`); return null; }
      break;
    case NODO.desplegable: {
      const titulo = content.find((c) => c.type === NODO.desplegableTitulo) ?? { type: NODO.desplegableTitulo };
      const cuerpo = content.find((c) => c.type === NODO.desplegableCuerpo) ?? { type: NODO.desplegableCuerpo, content: [parrafo()] };
      if (content.length > 2) descartar(ctx, `desplegable con partes repetidas en ${donde}: quedan el primer título y el primer cuerpo`);
      content = [titulo, cuerpo];
      break;
    }
    case 'bulletList': case 'orderedList': case 'taskList': case 'table':
      if (!content.length) { descartar(ctx, `${tipo} vacía en ${donde}: se quita`); return null; }
      break;
    case 'tableRow':
      if (!content.length) return null;
      break;
    case 'listItem': case 'taskItem':
      if (content[0]?.type !== 'paragraph') content = [parrafo(), ...content];
      break;
    case NODO.columna: case NODO.optimizadoItem: case NODO.recuadro: case NODO.desplegableCuerpo:
    case 'blockquote': case 'tableCell': case 'tableHeader':
      if (!content.length) content = [parrafo()];
      break;
  }

  const a = compactar(tipo, attrs);
  return {
    type: tipo,
    ...(a ? { attrs: a } : {}),
    ...(content.length ? { content } : {}),
  };
}

/** El formulario: campos válidos, ids únicos en toda la landing y al menos el correo. */
function sanearFormulario(crudo: Record<string, unknown>, ctx: Ctx, donde: string): Record<string, unknown> {
  const a = attrsConMotivo(NODO.formulario, crudo, ctx, donde, ['campos']) as ReturnType<typeof attrsFormulario>;
  const crudos = arr(crudo.campos);
  const esperados = Math.min(crudos.length, TOPES.camposFormulario);
  if (crudos.length > TOPES.camposFormulario) descartar(ctx, `${crudos.length} campos en un formulario (${donde}): quedan ${TOPES.camposFormulario}`);
  if (a.campos.length < esperados) descartar(ctx, `${esperados - a.campos.length} campo(s) de tipo desconocido o repetido en el formulario (${donde}): se quitan`);
  const campos = a.campos.map((c, i) => {
    let id = c.id;
    if (!id || ctx.idsCampo.has(id)) {
      if (obj(crudos[i]).id !== undefined) descartar(ctx, `id de campo ${id ? `repetido «${id}»` : 'inválido'} en ${donde}: se regenera`);
      id = idUnico(ctx.idsCampo, 'c');
    } else ctx.idsCampo.add(id);
    return { ...c, id };
  });
  if (!campos.length) {
    descartar(ctx, `formulario sin campos en ${donde}: queda el correo`);
    campos.push({ id: idUnico(ctx.idsCampo, 'c'), tipo: 'email', etiqueta: 'Correo electrónico', requerido: true, opciones: [] });
  }
  return { ...a, campos };
}

/** Una sección: atributos de la lista, id único en toda la landing y al menos un bloque. */
function sanearTarjeta(h: Record<string, unknown>, ctx: Ctx, donde: string): JsonNodo {
  ctx.nodos++;
  const crudo = obj(h.attrs);
  const a = attrsConMotivo(NODO.tarjeta, crudo, ctx, donde, ['id', 'imagenSrc']) as ReturnType<typeof attrsTarjeta>;
  if (crudo.imagenSrc != null && crudo.imagenSrc !== '' && !a.imagenSrc) {
    descartar(ctx, `imagen de acento fuera del almacenamiento de la landing «${recorte(crudo.imagenSrc)}» en ${donde}: se quita`);
  }
  let id = a.id;
  if (!id) {
    if (crudo.id !== undefined) descartar(ctx, `id de sección inválido «${recorte(crudo.id, 30)}» en ${donde}: se regenera`);
    id = idUnico(ctx.idsTarjeta, 't');
  } else if (ctx.idsTarjeta.has(id)) {
    descartar(ctx, `id de sección repetido «${id}» en ${donde}: se regenera`);
    id = idUnico(ctx.idsTarjeta, 't');
  } else ctx.idsTarjeta.add(id);
  ctx.tarjeta = id;
  ctx.htmlEnTarjeta = 0;
  const content = sanearBloques(h.content, BLOQUES_TARJETA, ctx, 1, donde, 'una sección');
  return { type: NODO.tarjeta, attrs: { ...a, id }, content: content.length ? content : [parrafo()] };
}

/** El `doc` de una página: sólo tarjetas (los bloques sueltos van a una sección nueva). */
function sanearDoc(raw: unknown, ctx: Ctx, donde: string): { type: 'doc'; content: JsonNodo[] } {
  const tarjetas: JsonNodo[] = [];
  let sueltos: unknown[] = [];
  const vaciar = () => {
    if (!sueltos.length) return;
    descartar(ctx, `${sueltos.length} bloque(s) fuera de una sección en ${donde}: van a una sección nueva`);
    tarjetas.push(sanearTarjeta({ type: NODO.tarjeta, content: sueltos }, ctx, `${donde}, sección ${tarjetas.length + 1}`));
    sueltos = [];
  };
  const o = obj(raw);
  if (raw !== undefined && o.type !== undefined && o.type !== 'doc') descartar(ctx, `la página de ${donde} no es un documento: se lee su contenido igual`);
  for (const n of arr(o.content)) {
    if (ctx.cortado) break;
    if (esObj(n) && n.type === NODO.tarjeta) {
      vaciar();
      tarjetas.push(sanearTarjeta(n, ctx, `${donde}, sección ${tarjetas.length + 1}`));
    } else if (esObj(n) && typeof n.type === 'string' && BLOQUES_TARJETA.includes(n.type)) {
      sueltos.push(n);
    } else if (esObj(n) && typeof n.type === 'string') {
      descartar(ctx, NORMALIZAR_NODOS[n.type] || n.type === 'text'
        ? `«${n.type}» no puede ir suelto en ${donde} (fuera de un bloque): se quita`
        : `nodo desconocido «${recorte(n.type, 30)}» en ${donde}: se quita`);
    } else {
      descartar(ctx, `un nodo sin tipo en ${donde}: se quita`);
    }
  }
  vaciar();
  if (tarjetas.length > TOPES.tarjetasPorPagina) {
    descartar(ctx, `${tarjetas.length} secciones en ${donde} (tope ${TOPES.tarjetasPorPagina}): las de más se quitan`);
    tarjetas.length = TOPES.tarjetasPorPagina;
  }
  if (!tarjetas.length) {
    tarjetas.push(sanearTarjeta({ type: NODO.tarjeta, content: [{ type: 'heading', attrs: { level: 1 } }, parrafo()] }, ctx, donde));
  }
  return { type: 'doc', content: tarjetas };
}

/** Una ruta libre a partir de una base: válida (`rutaValida`) y que no esté usada. */
function rutaLibre(base: string, usadas: Set<string>): string {
  let b = rutaValida(base) && base !== '' ? base : 'pagina';
  b = b.slice(0, 54).replace(/-+$/, '') || 'pagina';
  if (!rutaValida(b)) b = 'pagina';
  let r = b;
  for (let i = 2; usadas.has(r) || !rutaValida(r); i++) r = `${b}-${i}`;
  return r;
}

export type ResultadoSaneo = {
  contenido: LandingContenido;
  /** Qué se tiró o se cambió, y por qué (hasta 200; después, una línea con cuántos más). */
  descartes: string[];
  /** Lo que pesa el contenido saneado, en bytes UTF-8 (el server lo compara con `TOPES.bytesContenido`). */
  bytes: number;
};

const bytesDe = (v: unknown): number => {
  const s = JSON.stringify(v);
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length;
};

/**
 * Cualquier cosa → una landing válida. Acepta también el JSON como string y un `doc` suelto (una
 * sola página). Nunca tira: lo que no se puede leer termina en una página vacía, con su motivo.
 */
export function sanearContenido(raw: unknown): ResultadoSaneo {
  const ctx: Ctx = { d: [], omitidos: 0, idsTarjeta: new Set(), idsCampo: new Set(), nodos: 0, cortado: false, idsHtml: new Set(), tarjeta: '', htmlEnTarjeta: 0 };
  let r: unknown = raw;
  if (typeof r === 'string') {
    try { r = JSON.parse(r); } catch { r = null; descartar(ctx, 'el contenido no es un JSON válido: queda una página vacía'); }
  }
  const o = obj(r);
  let paginasRaw: unknown[];
  if (Array.isArray(o.paginas)) paginasRaw = o.paginas;
  else if (o.type === 'doc') { paginasRaw = [{ titulo: 'Inicio', ruta: '', doc: o }]; }
  else {
    if (r !== null) descartar(ctx, 'el contenido no tiene la forma de una landing: queda una página vacía');
    paginasRaw = [];
  }
  if (o.v !== undefined && o.v !== 1) descartar(ctx, `versión «${recorte(o.v, 10)}» desconocida: se lee como la 1`);
  if (paginasRaw.length > TOPES.paginas) {
    descartar(ctx, `${paginasRaw.length} páginas (tope ${TOPES.paginas}): las de más se quitan`);
    paginasRaw = paginasRaw.slice(0, TOPES.paginas);
  }

  const idsPagina = new Set<string>();
  const leidas: { p: Pagina; rutaCruda: unknown }[] = [];
  paginasRaw.forEach((pr, i) => {
    const p = obj(pr);
    let id = idValido(p.id);
    if (!id || idsPagina.has(id)) {
      if (p.id !== undefined) descartar(ctx, `id de página ${id ? `repetido «${id}»` : 'inválido'}: se regenera`);
      id = idUnico(idsPagina, 'p');
    } else idsPagina.add(id);
    const titulo = textoLimpio(p.titulo, TOPES.titulo).trim() || (i === 0 ? 'Inicio' : `Página ${i + 1}`);
    const doc = sanearDoc(p.doc, ctx, `la página «${titulo.slice(0, 40)}»`);
    const pagina: Pagina = { id, titulo, ruta: '', doc };
    const seoTitulo = textoLimpio(p.seoTitulo, 200).trim().slice(0, 60);
    const seoDescripcion = textoLimpio(p.seoDescripcion, 500).trim().slice(0, 160);
    if (seoTitulo) pagina.seoTitulo = seoTitulo;
    if (seoDescripcion) pagina.seoDescripcion = seoDescripcion;
    leidas.push({ p: pagina, rutaCruda: p.ruta });
  });
  if (!leidas.length) {
    leidas.push({ p: { id: idUnico(idsPagina, 'p'), titulo: 'Inicio', ruta: '', doc: sanearDoc({ type: 'doc', content: [] }, ctx, 'la página «Inicio»') }, rutaCruda: '' });
  }

  // Rutas: UNA sola '' (el inicio: la primera que la traiga, o la primera página), el resto
  // válidas y únicas.
  let inicio = leidas.findIndex((x) => x.rutaCruda === '');
  if (inicio < 0) {
    if (leidas.length > 1 || leidas[0].rutaCruda !== undefined) descartar(ctx, 'ninguna página era el inicio: la primera pasa a serlo');
    inicio = 0;
  }
  const usadas = new Set<string>();
  leidas.forEach((x, i) => {
    if (i === inicio) { x.p.ruta = ''; return; }
    const cruda = typeof x.rutaCruda === 'string' ? x.rutaCruda.trim() : '';
    let ruta = cruda;
    if (!ruta || !rutaValida(ruta)) {
      ruta = rutaLibre(slugDe(x.p.titulo), usadas);
      descartar(ctx, cruda === '' ? `«${x.p.titulo.slice(0, 40)}» también era el inicio: pasa a /${ruta}` : `ruta inválida «${recorte(cruda, 40)}»: pasa a /${ruta}`);
    } else if (usadas.has(ruta)) {
      const nueva = rutaLibre(ruta, usadas);
      descartar(ctx, `ruta repetida «${ruta}»: pasa a /${nueva}`);
      ruta = nueva;
    }
    usadas.add(ruta);
    x.p.ruta = ruta;
  });

  const contenido: LandingContenido = { v: 1, paginas: leidas.map((x) => x.p) };
  const bytes = bytesDe(contenido);
  if (bytes > TOPES.bytesContenido) descartar(ctx, `el contenido pesa ${bytes} bytes (tope ${TOPES.bytesContenido})`);
  const descartes = ctx.omitidos ? [...ctx.d, `… y ${ctx.omitidos} descarte(s) más`] : ctx.d;
  return { contenido, descartes, bytes };
}

/** ¿El contenido saneado pasa el tope de bytes? (El server contesta «demasiado grande» y no guarda.) */
export function excedeTope(r: Pick<ResultadoSaneo, 'bytes'>): boolean {
  return r.bytes > TOPES.bytesContenido;
}

// ─────────────────────────────────────────────────────────────────────────────
// La configuración
// ─────────────────────────────────────────────────────────────────────────────

const MODOS_ORIGEN = ['cero', 'ia', 'plantilla', 'importar', 'generador'] as const;
const OBJETIVOS = OBJETIVOS_LANDING.map((o) => o.value) as readonly ObjetivoLanding[];
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);

/**
 * La configuración del sitio con los defaults de `CONFIG_DEFAULT` (api-tipos.ts): imágenes sólo
 * del bucket, destinos de la lista de `hrefPermitido`, el Píxel de Meta sólo dígitos (el código lo
 * arma el server), SEO a 60/160 caracteres, hasta 5 enlaces y 2 botones en la barra.
 */
export function sanearConfig(raw: unknown): { config: ConfigLanding; descartes: string[] } {
  const d: string[] = [];
  const r = obj(raw);
  const s = obj(r.sitio);
  const nav = obj(s.nav);
  const pie = obj(s.pie);
  const pag = obj(r.pagina);
  const D = CONFIG_DEFAULT;

  const imagen = (v: unknown, que: string): string | null => {
    const ok = srcImagen(v);
    if (v != null && v !== '' && !ok) d.push(`${que} fuera del almacenamiento de la landing: se quita`);
    return ok;
  };
  const texto = (v: unknown, max: number, que: string): string => {
    const t = textoLimpio(v, 4000).trim();
    if (t.length > max) d.push(`${que}: se recorta a ${max} caracteres`);
    return t.slice(0, max);
  };

  const enlacesCrudos = arr(nav.enlaces);
  const enlaces: EnlaceNav[] = [];
  for (const e of enlacesCrudos) {
    const o = obj(e);
    const destino = hrefPermitido(o.destino);
    const t = textoLimpio(o.texto, 40).trim();
    if (!destino || !t) { d.push(`enlace de la barra sin texto o con un destino no permitido «${recorte(o.destino)}»: se quita`); continue; }
    if (enlaces.length >= 5) { d.push('más de 5 enlaces en la barra: quedan 5'); break; }
    enlaces.push({ texto: t, destino });
  }
  const botones: BotonNav[] = [];
  for (const b of arr(nav.botones)) {
    const o = obj(b);
    const destino = hrefPermitido(o.destino);
    const t = textoLimpio(o.texto, 40).trim();
    if (!destino || !t) { d.push(`botón de la barra sin texto o con un destino no permitido «${recorte(o.destino)}»: se quita`); continue; }
    if (botones.length >= 2) { d.push('más de 2 botones en la barra: quedan 2'); break; }
    botones.push({ texto: t, destino, estilo: enLista(['primario', 'secundario'] as const, o.estilo, 'primario') });
  }

  const pixelCrudo = typeof s.metaPixelId === 'number' && Number.isInteger(s.metaPixelId) ? String(s.metaPixelId) : typeof s.metaPixelId === 'string' ? s.metaPixelId.trim() : '';
  const metaPixelId = /^\d{5,20}$/.test(pixelCrudo) ? pixelCrudo : null;
  if (pixelCrudo && !metaPixelId) d.push(`Píxel de Meta «${recorte(pixelCrudo, 30)}» no es un número: se quita`);

  const tema = typeof r.tema === 'string' && /^(ws:)?[A-Za-z0-9_-]{1,60}$/.test(r.tema) ? r.tema : D.tema;
  if (r.tema !== undefined && tema !== r.tema) d.push(`tema «${recorte(r.tema, 30)}» inválido: queda «${D.tema}»`);

  // T3: el formato y la proporción, de sus listas cerradas (lo de antes de la tanda 2 no los trae: página, 16:9).
  const formato = enLista(FORMATOS, r.formato, 'pagina');
  if (r.formato !== undefined && formato !== r.formato) d.push(`formato «${recorte(r.formato, 30)}» inválido: queda «pagina»`);
  const proporcion = enLista(PROPORCIONES, r.proporcion, '16:9');
  if (r.proporcion !== undefined && proporcion !== r.proporcion) d.push(`proporción «${recorte(r.proporcion, 30)}» inválida: queda «16:9»`);

  const config: ConfigLanding = {
    tema,
    formato,
    proporcion,
    sitio: {
      nombre: texto(s.nombre, 80, 'nombre del sitio'),
      favicon: imagen(s.favicon, 'el ícono del sitio'),
      seoTitulo: texto(s.seoTitulo, 60, 'título para buscadores'),
      seoDescripcion: texto(s.seoDescripcion, 160, 'descripción para buscadores'),
      ogImagen: imagen(s.ogImagen, 'la imagen para compartir'),
      indexar: bool(s.indexar, D.sitio.indexar),
      nav: { mostrar: bool(nav.mostrar, D.sitio.nav.mostrar), logo: imagen(nav.logo, 'el logo de la barra'), enlaces, botones },
      pie: { mostrar: bool(pie.mostrar, D.sitio.pie.mostrar), texto: texto(pie.texto, 300, 'texto del pie') },
      metaPixelId,
      marcaMako: bool(s.marcaMako, D.sitio.marcaMako),
    },
    pagina: { animaciones: bool(pag.animaciones, D.pagina.animaciones), fondoImagen: imagen(pag.fondoImagen, 'la imagen de fondo') },
  };

  const or = obj(r.origen);
  if (r.origen !== undefined && r.origen !== null) {
    if ((MODOS_ORIGEN as readonly unknown[]).includes(or.modo)) {
      const origen: NonNullable<ConfigLanding['origen']> = { modo: or.modo as (typeof MODOS_ORIGEN)[number] };
      const pedido = textoLimpio(or.pedido, 5000).trim();
      if (pedido) origen.pedido = pedido;
      if ((OBJETIVOS as readonly unknown[]).includes(or.objetivo)) origen.objetivo = or.objetivo as ObjetivoLanding;
      const url = hrefPermitido(or.basadoEnUrl);
      if (or.basadoEnUrl !== undefined) origen.basadoEnUrl = url && /^https?:/i.test(url) && url.length <= 500 ? url : null;
      const plantilla = typeof or.plantilla === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(or.plantilla) ? or.plantilla : null;
      if (plantilla) origen.plantilla = plantilla;
      config.origen = origen;
    } else d.push('el origen de la landing no tiene un modo conocido: se quita');
  }
  return { config, descartes: d };
}
