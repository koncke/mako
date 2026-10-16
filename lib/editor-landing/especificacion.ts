// =============================================================================
// editor-landing/especificacion — la FORMA HTML de cada nodo y cada marca (D3)
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md.
//
// UNA función por nodo de doc.ts (`NODO` + `NODOS_TIPTAP`) y por marca (`MARCAS`): recibe
// los atributos y devuelve un `DOMOutputSpec` de ProseMirror (`['tag', {attrs}, 0 | ...hijos]`)
// con EXACTAMENTE el contrato de clases `gm-` del diseño. La usan DOS:
//   · el editor (paquete G), desde el `renderHTML` de cada extensión de TipTap: así el DOM
//     que se edita es el del publicado (y la hoja CSS_CONTENIDO es una sola);
//   · render.ts, que serializa el mismo árbol a un string para la página publicada, la
//     vista previa, las miniaturas y la exportación.
// Un solo lugar decide la forma HTML de cada nodo.
//
// Además vive acá lo que esas funciones necesitan para no emitir nada inválido, y que el
// saneo del server (validar.ts) reusa para no tener una segunda copia de las reglas:
//   · los NORMALIZADORES de atributos por nodo (`NORMALIZAR_NODOS`, `NORMALIZAR_MARCAS`):
//     cada valor contra su lista cerrada de doc.ts; lo que no es exactamente un valor de
//     la lista no se lee;
//   · `srcPermitido` (sólo el bucket público `landing-imagenes`) y `hrefPermitido` (http(s),
//     mailto:, tel:, `#t-<id>` y `pagina:<id>`). render.ts los re-exporta: el contrato del
//     diseño los nombra ahí.
//
// ⚠️ Cada función NORMALIZA lo que recibe aunque «ya venga validado»: el editor le pasa los
//    `node.attrs` de TipTap (que pueden venir de un pegado) y render.ts puede recibir un JSON
//    que no pasó por el server (la vista previa de la IA). Normalizar es idempotente y barato;
//    confiar en que alguien validó antes es cómo se cuela un atributo.
// ⚠️ Lo que NUNCA sale al HTML público: `notas`, `bloqueadaIA` y `oculta` de la tarjeta (las
//    notas del orador son privadas; una sección oculta directamente no se dibuja). Sólo en los
//    modos que no son 'publico' sale `data-oculta` para que la tira de miniaturas la atenúe.
// ⚠️ Los íconos (de un ítem o de un recuadro) salen como `<span data-icono="nombre">` VACÍO:
//    el SVG lo pone render.ts desde el catálogo (iconos.ts, paquete B). El editor puede hacer
//    lo mismo en un NodeView. Un SVG no se puede escribir dentro de un DOMOutputSpec sin
//    parsearlo, y este módulo no sabe de qué forma lo guarda el catálogo.
// ⚠️ PURO: sin DOM, sin React, sin server-only. Sólo `import type` de ProseMirror.
// =============================================================================

import type { DOMOutputSpec } from '@tiptap/pm/model';
import {
  ALINEACIONES, ALINEACIONES_TARJETA, ALTOS_ESPACIADOR, ALTOS_HTML_LIBRE, ALTOS_TARJETA, AJUSTES_IMAGEN,
  ANCHOS_IMAGEN, ANCHOS_TARJETA, COLORES_TEMA, COLUMNAS_OPTIMIZADO, DEGRADADOS, DISENOS_TARJETA, FONDOS_TARJETA,
  FORMAS_IMAGEN, MAX_COLUMNAS, NIVELES_TITULO, NODO, OPTIMIZADOS, SUPERPOSICIONES, TAMANOS_TEXTO, TIPOS_CAMPO,
  TONOS_RECUADRO, TOPES, VARIANTES_BOTON, VARIANTES_OPTIMIZADO, VARIANTES_PARRAFO, enLista, esHex,
  type AttrsBoton, type AttrsBotones, type AttrsColumnas, type AttrsEspaciador, type AttrsFormulario,
  type AttrsHtmlLibre, type AttrsImagen, type AttrsInsertado, type AttrsOptimizado, type AttrsOptimizadoItem,
  type AttrsRecuadro, type AttrsTarjeta, type AttrsVideo, type CampoFormulario, type ColorTema, type Degradado,
  type TamanoTexto, type TipoCampo, type VarianteOptimizado, type VarianteParrafo,
} from './doc';
import {
  CORTE_CELULAR, datosDeAnimacion, sanearAnimacionSeccion, sanearDireccion, type AnimacionResuelta, type VideoFondo,
} from './animaciones';
import { altoDeEmbed, atributosDeIframe, claseDeProveedor, embedDe, esProveedorEmbed, nombreDeProveedor } from '../embeds';
import { SANDBOX_PUBLICO } from './html-libre';
import { hrefPagoValido } from './pago-landing';
import {
  arbolDeGrafico, htmlDeArbol, normalizarGrafico, type AttrsArbol, type HijoArbol, type NodoArbol,
} from './grafico-svg';

export { htmlDeArbol, escaparTexto, escaparAtributo, HtmlCrudo } from './grafico-svg';
export type { NodoArbol, AttrsArbol, HijoArbol } from './grafico-svg';
export type { DOMOutputSpec };

// ─────────────────────────────────────────────────────────────────────────────
// Contexto con que se pide una forma
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 'publico' = la página publicada · 'editor' = el DOM del editor (renderHTML de TipTap) ·
 * 'miniatura' = la tira y el Panel (sin iframes ni videos: pesan y no se ven a ese tamaño) ·
 * 'exportar' = PDF/PNG/PPTX/HTML (los desplegables salen abiertos para que se lean).
 */
export type ModoRender = 'publico' | 'editor' | 'miniatura' | 'exportar';

export type CtxSpec = {
  /** Default 'editor': sin contexto la pide el renderHTML de TipTap. */
  modo?: ModoRender;
  /**
   * Convierte un href YA PERMITIDO en el que se escribe (`pagina:<id>` → la ruta de esa página).
   * Sin esto se escribe tal cual se guardó (el editor: un pegado lo vuelve a leer igual).
   * Devolver `null` deja el enlace sin destino.
   */
  resolverHref?: (href: string) => string | null;
  /**
   * Las variables CSS de una sección con fondo PROPIO (color o degradado): el `style` del
   * `<section>`. Es `varsDeFondoPropio(tema, relleno)` de temas.ts; la pasan render.ts y el
   * NodeView de la tarjeta (que conocen el tema). Sin esto, el fondo se pinta igual (inline en
   * `.gm-tarjeta-fondo`) pero la tinta del texto es la del tema.
   */
  varsFondo?: (relleno: string) => Record<string, string>;
  /**
   * La URL desde la que se sirve el «HTML personalizado» de un bloque (`/l/html/<docId>/<id>`,
   * html-libre.ts), o null. Sólo se usa en modo 'publico': la pasa render.ts cuando conoce la
   * landing (`OpRender.htmlLibre`). Sin esto, o sin id, el bloque sale con `srcdoc` como siempre.
   */
  srcHtmlLibre?: (idBloque: string) => string | null;
  /**
   * Los MARCADORES de una miniatura de trabajo (render.ts, `OpRender.marcadores`; sólo en
   * 'miniatura'): el VSL vacío de un diseño se dibuja como un ▶ (`specInsertado`). Sin esto, un
   * insertado vacío no se dibuja, como en la publicada.
   */
  marcadores?: boolean;
  /**
   * Marcar los textos A COMPLETAR («[Tu especialidad]», `rangosACompletar` abajo) con un
   * `span.gm-completar`. Lo prende render.ts junto con `marcadores` (la miniatura de TRABAJO) y lo
   * puede pedir un NodeView del editor para lo que dibuja desde un atributo (el `valor` de un ítem).
   * El `renderHTML` de TipTap nunca lo pide: `getHTML()` y el portapapeles salen sin marcar.
   */
  completar?: boolean;
  /**
   * La SECCIÓN que se está dibujando (sólo la lee `specTarjeta`): su `indice` entre las VISIBLES de su página
   * (0 = la primera, la que ve quien entra) y su animación ya resuelta con el estilo de la landing
   * (`animacionDeSeccion`, animaciones.ts). La pone render.ts sección por sección; el NodeView del editor la
   * puede pasar igual. Sin esto: sin `data-anim` (la sección anima con las reglas de siempre, o no anima) y un
   * póster de video sin prioridad declarada.
   */
  seccion?: { indice: number; animacion: AnimacionResuelta | null };
};

// ─────────────────────────────────────────────────────────────────────────────
// Los textos A COMPLETAR: «[Tu especialidad]», «[resultado concreto]», «[00]%»
// ─────────────────────────────────────────────────────────────────────────────
// Pedido de Martín (14/10/2026): «También quiero que los [] que el usuario debe completar, se queden
// como de otro color o algo diferencial, y que eso se vea también en la miniatura, así se entiende
// mejor.» Las plantillas, los diseños y la IA (ia-bloques.ts: «usa marcadores entre corchetes») dejan
// entre corchetes lo que la persona tiene que escribir. Se MARCA en dos lugares y en ningún otro:
//   · el editor, con una decoración de ProseMirror (editor/extensiones/completar.ts): no toca el
//     documento, ni el JSON guardado, ni `getHTML()`;
//   · la miniatura de TRABAJO (render.ts con `marcadores`): un `span.gm-completar`.
// La publicada, la exportación y la vista del visitante en el teléfono (app/m/landing, miniatura sin
// marcadores) no marcan nada: si la persona publicó con un corchete, se publica tal cual.
// El tope es 120 y no 80: el más largo de los catálogos mide 88 (medido el 14/10/2026 sobre
// PLANTILLAS, DISENOS_SECCION, PLANTILLAS_PRESENTACION y los diseños × objetivos: 526 distintos; con
// 80 quedaban sin marcar la garantía y la historia del «Sobre mí»). Sin saltos de línea ni corchetes
// adentro (un «[» suelto no se come el párrafo), y con al menos una letra o un número: «[…]» y
// «[ ]» no son algo a completar.

/** La regla de un texto a completar. Con `g`: se usa con `matchAll`, que la clona (no comparte `lastIndex`). */
export const RE_A_COMPLETAR = /\[(?=[^\[\]\n]*[\p{L}\p{N}])[^\[\]\n]{1,120}\]/gu;
/** La clase del marcado (la hoja, css.ts, lo dibuja sólo en el editor y en la miniatura de trabajo). */
export const CLASE_A_COMPLETAR = 'gm-completar';

/** Los rangos `[desde, hasta)` de cada texto a completar, con sus corchetes, en orden. */
export function rangosACompletar(texto: string): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  if (!texto.includes('[')) return out;
  for (const m of texto.matchAll(RE_A_COMPLETAR)) out.push([m.index, m.index + m[0].length]);
  return out;
}

export type TramoACompletar = { texto: string; completar: boolean };

/**
 * Un texto partido según `rangos`, que se midieron sobre el texto CORRIDO del bloque; `base` es dónde
 * empieza este texto en él. Es lo que deja marcar «[tu **cliente** ideal]» aunque la negrita lo parta
 * en tres textos: cada pedazo se marca adentro de su propia marca, como parte ProseMirror una
 * decoración. Nunca devuelve un tramo vacío salvo para un texto vacío.
 */
export function tramosACompletar(texto: string, rangos: ReadonlyArray<readonly [number, number]>, base = 0): TramoACompletar[] {
  const fin = base + texto.length;
  const out: TramoACompletar[] = [];
  let i = 0;
  for (const [d, h] of rangos) {
    if (h <= base || d >= fin) continue;
    const a = Math.max(d, base) - base;
    const b = Math.min(h, fin) - base;
    if (a > i) out.push({ texto: texto.slice(i, a), completar: false });
    if (b > Math.max(a, i)) out.push({ texto: texto.slice(Math.max(a, i), b), completar: true });
    i = Math.max(i, b);
  }
  if (i < texto.length || !out.length) out.push({ texto: texto.slice(i), completar: false });
  return out;
}

/** Un texto suelto (que no parte ninguna marca) como hijos de un árbol, con lo que hay que completar marcado. */
export function hijosACompletar(texto: string): HijoArbol[] {
  return tramosACompletar(texto, rangosACompletar(texto))
    .filter((t) => t.texto)
    .map((t): HijoArbol => (t.completar ? ['span', { class: CLASE_A_COMPLETAR }, t.texto] : t.texto));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de lectura (lo que no es exactamente un valor válido, no se lee)
// ─────────────────────────────────────────────────────────────────────────────

type Crudo = Record<string, unknown>;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** El objeto de atributos, o uno vacío. */
export function obj(v: unknown): Crudo {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Crudo) : {};
}
const bool = (v: unknown, def = false): boolean => (typeof v === 'boolean' ? v : def);
/** Texto limpio de caracteres de control, recortado a `max`. */
export function textoLimpio(v: unknown, max: number, def = ''): string {
  return typeof v === 'string' ? v.replace(CONTROL, '').slice(0, max) : def;
}
/** Un entero (o su texto exacto: «12», no «012» ni «12px») dentro de [min, max]. */
const entero = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d{1,9}$/.test(v) && String(Number(v)) === v ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};
/** Un número finito llevado a [min, max]. */
const acotado = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
/** Un valor de una lista numérica cerrada (acepta su texto exacto, como los `data-*`). */
const deListaNum = (lista: readonly number[], v: unknown, def: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,4}$/.test(v) ? Number(v) : NaN;
  return lista.includes(n) ? n : def;
};

/** Id de tarjeta, campo o página: letras, números, `_` y `-`, hasta 60. */
export const RE_ID = /^[A-Za-z0-9_-]{1,60}$/;
export function idValido(v: unknown): string | null {
  return typeof v === 'string' && RE_ID.test(v) ? v : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Imágenes y videos: SÓLO el bucket público propio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El prefijo público del bucket `landing-imagenes` (`<SUPABASE_URL>/storage/v1/object/public/landing-imagenes/`),
 * o '' si no hay `NEXT_PUBLIC_SUPABASE_URL` (entonces nada es permitido). Se lee en cada
 * llamada: en el navegador Next reemplaza `process.env.NEXT_PUBLIC_…` al compilar, y en los
 * tests se puede definir antes de llamar.
 */
export function origenImagenes(): string {
  // Sin `typeof process`: Next reemplaza la expresión ENTERA por el literal al compilar para el
  // navegador; un `typeof process` delante podría dar 'undefined' allá y dejar todo afuera.
  let base: string | undefined;
  try { base = process.env.NEXT_PUBLIC_SUPABASE_URL; } catch { base = undefined; }
  if (!base || !/^https?:\/\/[^\s"'<>()\\]+$/.test(base)) return '';
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/landing-imagenes/`;
}

/** El valor al cargar el módulo (contrato del diseño). Para decidir, `srcPermitido` vuelve a leerlo. */
export const ORIGEN_IMAGENES = origenImagenes();

/**
 * Lo que puede seguir al prefijo: `<carpeta>/…/<archivo>.<ext>`, con segmentos de letras,
 * números, `_` y `-` (el path que arma el server es `<ws>/<uuid>.<ext>`). Como un segmento no
 * puede tener puntos, `..` es imposible; tampoco hay `?`, `#`, comillas ni paréntesis, así que
 * la URL entra tal cual en un `url("…")` de CSS sin poder cerrarlo.
 */
const RE_ARCHIVO = /^(?:[A-Za-z0-9_-]{1,128}\/){1,3}[A-Za-z0-9_-]{1,128}\.(png|jpe?g|webp|gif|mp4|webm)$/i;
const EXT_IMAGEN = /\.(png|jpe?g|webp|gif)$/i;
const EXT_VIDEO = /\.(mp4|webm)$/i;

/** ¿Es una URL del bucket público de la landing (imagen o video)? Ninguna otra sale al HTML. */
export function srcPermitido(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 600) return false;
  const origen = origenImagenes();
  if (!origen || !url.startsWith(origen)) return false;
  return RE_ARCHIVO.test(url.slice(origen.length));
}
/** La URL si es una IMAGEN del bucket; si no, null. */
export function srcImagen(v: unknown): string | null {
  return srcPermitido(v) && EXT_IMAGEN.test(v) ? v : null;
}
/** La URL si es un VIDEO del bucket; si no, null. */
export function srcVideo(v: unknown): string | null {
  return srcPermitido(v) && EXT_VIDEO.test(v) ? v : null;
}

/**
 * El video de fondo de una sección (animaciones.ts, `VideoFondo`) con la MISMA regla que `imagenSrc`: los videos
 * y los pósters sólo del bucket `landing-imagenes`. Sin un video o sin un póster válidos, null entero (un video
 * sin póster deja el hero vacío hasta que arranca, y el póster es el LCP). Las variantes del teléfono que no
 * pasan quedan en null: el teléfono usa las de escritorio.
 */
export function videoFondoValido(raw: unknown): VideoFondo | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Crudo;
  const src = srcVideo(r.src);
  const poster = srcImagen(r.poster);
  if (!src || !poster) return null;
  return { src, srcMovil: srcVideo(r.srcMovil), poster, posterMovil: srcImagen(r.posterMovil) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enlaces
// ─────────────────────────────────────────────────────────────────────────────

const RE_ANCLA = /^#t-[A-Za-z0-9_-]{1,60}$/;
const RE_PAGINA = /^pagina:[A-Za-z0-9_-]{1,60}$/;
/** `tel:` con dígitos, espacios, `+`, `(`, `)` y `-` (así lo escriben la persona y la IA). */
const RE_TEL = /^tel:\+?[0-9 ()-]{3,30}$/i;
/** Lo que nunca puede ir en un href que se guarda tal cual: espacios, control, comillas, `<>` y backtick. */
const RE_SUCIO = /[\s\u0000-\u001F\u007F<>"'`]/;

/**
 * El href en la forma en que se GUARDA, o null si no está permitido. Se acepta:
 *   · `http://…` y `https://…` (el protocolo lo decide el parser de URL, el mismo algoritmo que
 *     usa el navegador: `java\tscript:` o `JaVaScRiPt:` quedan afuera); sin usuario ni clave;
 *   · un dominio suelto (`www.algo.com`, `algo.com/x`) → se le antepone `https://`;
 *   · `mailto:…@…` y `tel:…`;
 *   · `#t-<id>` (una sección de la página), `#` (un botón todavía sin destino) y `pagina:<id>`
 *     (otra página del sitio: la ruta la resuelve render.ts con `urlBase`).
 * Todo lo demás —`javascript:`, `data:`, `vbscript:`, `file:`, `//host`, rutas relativas— no.
 * Lo que se acepta se devuelve como vino (sólo `trim`), para que guardar dos veces no lo cambie
 * (la misma lista que `hrefValido` de ia-bloques.ts, más `pagina:` y el dominio suelto).
 */
export function hrefPermitido(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const h = raw.trim();
  if (!h || h.length > 2000) return null;
  if (h === '#' || RE_ANCLA.test(h) || RE_PAGINA.test(h) || RE_TEL.test(h)) return h;
  if (RE_SUCIO.test(h)) return null;
  if (/^mailto:/i.test(h)) return /^mailto:[^@]+@[^@]+$/i.test(h) ? h : null;
  const conProtocolo = /^https?:\/\//i.test(h) ? h
    : /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]|$)/i.test(h) ? `https://${h}` : null;
  if (!conProtocolo) return null;
  try {
    const u = new URL(conProtocolo);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password || !u.hostname) return null;
    return conProtocolo;
  } catch {
    return null;
  }
}

/** Alias con el nombre de la casa (lib/html-seguro.ts tiene su `hrefSeguro` para el editor rico). */
export const hrefSeguro = hrefPermitido;

/** ¿Lleva a otra página o a otro sitio (y no a una sección de esta)? */
const esExterno = (h: string) => /^https?:/i.test(h);

/** El href que se ESCRIBE: permitido y, si hay resolvedor, resuelto. `undefined` = sin href. */
function hrefDe(guardado: unknown, ctx?: CtxSpec): string | undefined {
  const h = hrefSeguro(guardado);
  if (!h) return undefined;
  const r = ctx?.resolverHref ? ctx.resolverHref(h) : h;
  return r ?? undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalizadores de atributos (uno por nodo con atributos; los usa validar.ts)
// ─────────────────────────────────────────────────────────────────────────────

const ALINEACIONES_TEXTO = ['left', 'center', 'right', 'justify'] as const;
type AlineacionTexto = (typeof ALINEACIONES_TEXTO)[number];

/** Atributos de la tarjeta («sección» en el español de Gamma). `id: ''` = inválido (validar.ts lo regenera). */
export function attrsTarjeta(raw: unknown): AttrsTarjeta {
  const r = obj(raw);
  const fondoColor = esHex(r.fondoColor) ? r.fondoColor : null;
  const fondoDegradado = typeof r.fondoDegradado === 'string' && Object.prototype.hasOwnProperty.call(DEGRADADOS, r.fondoDegradado)
    ? (r.fondoDegradado as Degradado) : null;
  let fondo = enLista(FONDOS_TARJETA, r.fondo, 'tema');
  if (fondo === 'color' && !fondoColor) fondo = 'tema';
  if (fondo === 'degradado' && !fondoDegradado) fondo = 'tema';
  const animacion = sanearAnimacionSeccion(r.animacion);
  return {
    id: idValido(r.id) ?? '',
    diseno: enLista(DISENOS_TARJETA, r.diseno, 'sin'),
    imagenSrc: srcImagen(r.imagenSrc),
    imagenFocoX: acotado(r.imagenFocoX, 0, 100, 50),
    imagenFocoY: acotado(r.imagenFocoY, 0, 100, 50),
    imagenAjuste: enLista(AJUSTES_IMAGEN, r.imagenAjuste, 'cubrir'),
    superposicion: enLista(SUPERPOSICIONES, r.superposicion, 'ninguna'),
    fondo,
    fondoColor,
    fondoDegradado,
    ancho: enLista(ANCHOS_TARJETA, r.ancho, 'normal'),
    alineacion: enLista(ALINEACIONES_TARJETA, r.alineacion, 'centro'),
    alto: enLista(ALTOS_TARJETA, r.alto, 'auto'),
    oculta: bool(r.oculta),
    notas: textoLimpio(r.notas, TOPES.notas),
    bloqueadaIA: bool(r.bloqueadaIA),
    // El catálogo de animaciones (animaciones.ts): lo que no está en él se lee null (= hereda el estilo).
    animacion,
    animacionDireccion: sanearDireccion(r.animacionDireccion, animacion),
    videoFondo: videoFondoValido(r.videoFondo),
  };
}

export function attrsColumnas(raw: unknown): AttrsColumnas {
  const r = obj(raw);
  const anchos = (Array.isArray(r.anchos) ? r.anchos : []).slice(0, MAX_COLUMNAS).map((v) => entero(v, 1, 12, 0));
  return { anchos: anchos.every((n) => n > 0) ? anchos : [], divisores: bool(r.divisores) };
}

export function attrsOptimizado(raw: unknown): AttrsOptimizado {
  const r = obj(raw);
  return {
    variante: enLista<VarianteOptimizado>(VARIANTES_OPTIMIZADO, r.variante, 'vinetas-grandes'),
    columnas: enLista(COLUMNAS_OPTIMIZADO, r.columnas, 'auto'),
    mostrarIconos: bool(r.mostrarIconos, true),
  };
}

/** Nombre de ícono: minúsculas, números y guiones. Que exista en el catálogo lo mira render.ts. */
const RE_ICONO = /^[a-z0-9][a-z0-9-]{0,47}$/;

export function attrsOptimizadoItem(raw: unknown): AttrsOptimizadoItem {
  const r = obj(raw);
  return {
    icono: typeof r.icono === 'string' && RE_ICONO.test(r.icono) ? r.icono : null,
    imagenSrc: srcImagen(r.imagenSrc),
    valor: textoLimpio(r.valor, 40).trim(),
    destacado: bool(r.destacado),
  };
}

export function attrsBotones(raw: unknown): AttrsBotones {
  return { alinea: enLista(ALINEACIONES, obj(raw).alinea, 'izquierda') };
}

/**
 * Un BOTÓN acepta además `pago:<productoId>` (tanda 4: el «Botón de pago» cobrado por la pasarela de
 * MaKo, pago-landing.ts). Sólo el botón: un enlace de texto, una imagen o la barra del sitio siguen con
 * `hrefSeguro`, que no lo conoce — un `pago:` ahí no tendría quién lo resuelva. Va en el `href` que
 * ya existía y no en un atributo nuevo: el esquema de TipTap, el saneo y el pegado lo leen igual.
 */
export function attrsBoton(raw: unknown): AttrsBoton {
  const r = obj(raw);
  return { href: hrefSeguro(r.href) ?? hrefPagoValido(r.href) ?? '', variante: enLista(VARIANTES_BOTON, r.variante, 'primario'), nuevaPestana: bool(r.nuevaPestana) };
}

export function attrsRecuadro(raw: unknown): AttrsRecuadro {
  return { tono: enLista(TONOS_RECUADRO, obj(raw).tono, 'info') };
}

/** El desplegable no tiene atributos guardados; `abierto` sólo lo usa el editor o la exportación. */
export function attrsDesplegable(raw: unknown): { abierto: boolean } {
  return { abierto: bool(obj(raw).abierto) };
}

export function attrsImagen(raw: unknown): AttrsImagen {
  const r = obj(raw);
  return {
    src: srcImagen(r.src) ?? '',
    alt: textoLimpio(r.alt, 300),
    ancho: deListaNum(ANCHOS_IMAGEN, r.ancho, 100),
    alinea: enLista(ALINEACIONES, r.alinea, 'centro'),
    href: hrefSeguro(r.href),
    forma: enLista(FORMAS_IMAGEN, r.forma, 'normal'),
  };
}

export function attrsVideo(raw: unknown): AttrsVideo {
  const r = obj(raw);
  return {
    src: srcVideo(r.src) ?? '',
    ancho: deListaNum(ANCHOS_IMAGEN, r.ancho, 100),
    autoplay: bool(r.autoplay),
    bucle: bool(r.bucle),
    poster: srcImagen(r.poster),
  };
}

/**
 * El insertado sale de `embedDe` (lib/embeds.ts), la MISMA fuente que el saneo del editor rico:
 * el `src` que se guarda es el que arma ese módulo desde el id, nunca el que entró, y con enlace el
 * proveedor sale de ahí (el que traiga el JSON no se lee). El alto sólo existe en una agenda.
 *
 * SIN enlace (el marcador que pide «Pega el enlace»), el proveedor es una PISTA de qué va en el hueco
 * —un video o una agenda— y se conserva SÓLO si es uno de la lista cerrada de lib/embeds.ts
 * (`esProveedorEmbed`); uno inventado sale ''. Con eso el editor pide lo justo («el enlace de tu
 * video») y la miniatura dibuja el VSL vacío de un diseño como un video (`specInsertado`). Antes del
 * 14/10/2026 salía siempre '': un VSL vacío y una agenda vacía eran indistinguibles.
 */
export function attrsInsertado(raw: unknown): AttrsInsertado {
  const r = obj(raw);
  const sinEnlace = typeof r.src !== 'string' || r.src.trim() === '';
  const e = sinEnlace ? null : embedDe(r.src as string);
  if (!e) return { src: '', proveedor: sinEnlace && esProveedorEmbed(r.proveedor) ? r.proveedor : '', alto: null };
  const agenda = claseDeProveedor(e.proveedor) === 'agenda';
  return { src: e.src, proveedor: e.proveedor, alto: agenda ? altoDeEmbed(r.alto) ?? e.alto ?? null : null };
}

/** El aviso de Publicar cuando un video quedó sin su enlace (corto: lo dibuja el diálogo). */
export const TEXTO_FALTA_VIDEO = 'Falta el enlace del video';

/**
 * ¿Cuántos VIDEOS quedaron sin pegar? Un `insertado` con la pista de un proveedor de video (el VSL que
 * trae un diseño, «Video de YouTube…»: `attrsInsertado` la conserva en el hueco vacío) y sin `src`. Lo
 * pregunta el diálogo Publicar ANTES de publicar (integración de la tanda 4): la publicada no dibuja
 * un insertado vacío (render.ts), así que el hero de un diseño con VSL sale sin video y nadie lo dice.
 * Una agenda vacía no cuenta (no tiene pista de video), ni una sección OCULTA (no se publica). Se lee
 * con `attrsInsertado`, la MISMA regla del saneo y del render: un enlace que no es de la lista ya no
 * está, y una pista inventada sale ''.
 */
export function videosSinEnlace(paginas: ReadonlyArray<{ doc?: { content?: unknown } } | null | undefined>): number {
  let n = 0;
  const recorrer = (nodos: unknown, prof: number): void => {
    if (!Array.isArray(nodos) || prof > 40) return;
    for (const x of nodos) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
      const nodo = x as { type?: unknown; attrs?: unknown; content?: unknown };
      const attrs = nodo.attrs && typeof nodo.attrs === 'object' ? nodo.attrs as Record<string, unknown> : {};
      if (nodo.type === NODO.tarjeta && attrs.oculta === true) continue;
      if (nodo.type === NODO.insertado) {
        const a = attrsInsertado(attrs);
        if (!a.src && claseDeProveedor(a.proveedor) === 'video') n++;
        continue;
      }
      recorrer(nodo.content, prof + 1);
    }
  };
  for (const p of paginas ?? []) recorrer(p?.doc?.content, 0);
  return n;
}

/** El aviso de Publicar, o null si no falta ningún video. */
export const avisoDeVideo = (paginas: Parameters<typeof videosSinEnlace>[0]): string | null =>
  videosSinEnlace(paginas) > 0 ? TEXTO_FALTA_VIDEO : null;

/** Rótulo por default de cada tipo de campo (el que la persona ve si no escribió otro). */
export const ETIQUETA_CAMPO: Record<TipoCampo, string> = {
  nombre: 'Nombre', email: 'Correo electrónico', telefono: 'Teléfono', empresa: 'Empresa',
  texto: 'Respuesta', textoLargo: 'Mensaje', opciones: 'Elige una opción',
};
/** Los tipos que no se repiten en un formulario (el Pixel lee UN valor de cada uno). */
const CAMPOS_UNICOS: ReadonlySet<TipoCampo> = new Set<TipoCampo>(['nombre', 'email', 'telefono']);

/**
 * Atributos del formulario. Un campo de tipo desconocido se cae; uno de los tipos únicos que se
 * repite se cae; «opciones» con menos de 2 opciones pasa a «texto» (igual que la gramática de la
 * IA, ia-bloques.ts). Un id de campo inválido queda '' (validar.ts lo regenera).
 */
export function attrsFormulario(raw: unknown): AttrsFormulario {
  const r = obj(raw);
  const campos: CampoFormulario[] = [];
  const vistos = new Set<TipoCampo>();
  for (const c of Array.isArray(r.campos) ? r.campos : []) {
    if (campos.length >= TOPES.camposFormulario) break;
    const o = obj(c);
    if (!(TIPOS_CAMPO as readonly unknown[]).includes(o.tipo)) continue;
    let tipo = o.tipo as TipoCampo;
    if (CAMPOS_UNICOS.has(tipo) && vistos.has(tipo)) continue;
    vistos.add(tipo);
    let opciones = (Array.isArray(o.opciones) ? o.opciones : [])
      .map((x) => textoLimpio(x, 120).trim()).filter(Boolean).slice(0, 12);
    if (tipo === 'opciones' && opciones.length < 2) tipo = 'texto';
    if (tipo !== 'opciones') opciones = [];
    campos.push({
      id: idValido(o.id) ?? '',
      tipo,
      etiqueta: textoLimpio(o.etiqueta, 120).trim() || ETIQUETA_CAMPO[tipo],
      requerido: bool(o.requerido),
      opciones,
    });
  }
  const redirigir = hrefSeguro(r.redirigir);
  return {
    campos,
    boton: textoLimpio(r.boton, 60).trim() || 'Enviar',
    exito: textoLimpio(r.exito, 200).trim() || '¡Listo! Recibimos tus datos.',
    redirigir: redirigir && redirigir !== '#' ? redirigir : null,
  };
}

export function attrsEspaciador(raw: unknown): AttrsEspaciador {
  return { alto: enLista(ALTOS_ESPACIADOR, obj(raw).alto, 'm') };
}

/**
 * HTML personalizado: si pasa el tope (`TOPES.htmlLibre`) no se recorta (quedaría roto): queda vacío.
 * `id` (tanda 2): el id estable del bloque, o null — el saneo (validar.ts) le pone uno. Va PRIMERO en
 * el objeto a propósito: el `{}` de acá es lo que declara los atributos del nodo en TipTap
 * (`attrsSinParseo(attrsHtmlLibre({}))`), y un atributo que no se declara TipTap lo tira al cargar.
 */
export function attrsHtmlLibre(raw: unknown): AttrsHtmlLibre {
  const r = obj(raw);
  const html = typeof r.html === 'string' && r.html.length <= TOPES.htmlLibre ? r.html.replace(/\u0000/g, '') : '';
  return { id: idValido(r.id), html, alto: deListaNum(ALTOS_HTML_LIBRE, r.alto, 300) as AttrsHtmlLibre['alto'] };
}

export type AttrsParrafo = { variante: VarianteParrafo | null; textAlign: AlineacionTexto | null };
export function attrsParrafo(raw: unknown): AttrsParrafo {
  const r = obj(raw);
  return {
    variante: (VARIANTES_PARRAFO as readonly unknown[]).includes(r.variante) ? (r.variante as VarianteParrafo) : null,
    textAlign: (ALINEACIONES_TEXTO as readonly unknown[]).includes(r.textAlign) ? (r.textAlign as AlineacionTexto) : null,
  };
}

/** `variante: 'titulo'` = el «Título» grande de Gamma: siempre un h1. */
export type AttrsEncabezado = { level: 1 | 2 | 3 | 4; variante: 'titulo' | null; textAlign: AlineacionTexto | null };
export function attrsEncabezado(raw: unknown): AttrsEncabezado {
  const r = obj(raw);
  const variante = r.variante === 'titulo' ? 'titulo' : null;
  const level = variante ? 1 : (deListaNum(NIVELES_TITULO, r.level, 2) as 1 | 2 | 3 | 4);
  return { level, variante, textAlign: attrsParrafo(r).textAlign };
}

export function attrsListaOrdenada(raw: unknown): { start: number } {
  return { start: entero(obj(raw).start, 1, 100000, 1) };
}

export function attrsTarea(raw: unknown): { checked: boolean } {
  return { checked: bool(obj(raw).checked) };
}

export function attrsCelda(raw: unknown): { colspan: number; rowspan: number } {
  const r = obj(raw);
  return { colspan: entero(r.colspan, 1, 20, 1), rowspan: entero(r.rowspan, 1, 50, 1) };
}

const sinAtributos = (): Record<string, never> => ({});

/**
 * Normalizador por tipo de nodo. Los nodos sin atributos devuelven `{}`. `doc` y `text` no
 * están: no tienen forma HTML propia (la raíz la arma render.ts; el texto se escapa).
 */
export const NORMALIZAR_NODOS: Readonly<Record<string, (raw: unknown) => Record<string, unknown>>> = {
  [NODO.tarjeta]: attrsTarjeta,
  [NODO.columnas]: attrsColumnas,
  [NODO.columna]: sinAtributos,
  [NODO.optimizado]: attrsOptimizado,
  [NODO.optimizadoItem]: attrsOptimizadoItem,
  [NODO.botones]: attrsBotones,
  [NODO.boton]: attrsBoton,
  [NODO.recuadro]: attrsRecuadro,
  [NODO.desplegable]: sinAtributos,
  [NODO.desplegableTitulo]: sinAtributos,
  [NODO.desplegableCuerpo]: sinAtributos,
  [NODO.imagen]: attrsImagen,
  [NODO.video]: attrsVideo,
  [NODO.insertado]: attrsInsertado,
  [NODO.formulario]: attrsFormulario,
  [NODO.grafico]: normalizarGrafico,
  [NODO.espaciador]: attrsEspaciador,
  [NODO.htmlLibre]: attrsHtmlLibre,
  paragraph: attrsParrafo,
  heading: attrsEncabezado,
  bulletList: sinAtributos,
  orderedList: attrsListaOrdenada,
  listItem: sinAtributos,
  taskList: sinAtributos,
  taskItem: attrsTarea,
  blockquote: sinAtributos,
  horizontalRule: sinAtributos,
  hardBreak: sinAtributos,
  table: sinAtributos,
  tableRow: sinAtributos,
  tableHeader: attrsCelda,
  tableCell: attrsCelda,
};

// ── Marcas ───────────────────────────────────────────────────────────────────

/** Un color de texto o de resaltado: un token del tema (`acento`, `paleta-3`…) o un hex. */
export function colorValido(v: unknown): ColorTema | string | null {
  if ((COLORES_TEMA as readonly unknown[]).includes(v)) return v as ColorTema;
  return esHex(v) ? v : null;
}

export type AttrsEnlace = { href: string; target: '_blank' | null };
export type AttrsTextStyle = { color: string | null; tam: TamanoTexto | null };
export type AttrsResaltado = { color: string | null };
export type AttrsEtiqueta = { color: ColorTema | null };

/**
 * Normalizador por marca. Devuelve `null` cuando la marca no tiene sentido y se cae: un enlace
 * con un href no permitido, un `textStyle` sin color ni tamaño (TipTap los deja al borrar).
 * Los nombres de atributo (`color`, `tam`, `href`, `target`) son el CONTRATO con las
 * extensiones de G: TipTap tiene que guardarlos con estos nombres.
 */
export const NORMALIZAR_MARCAS: Readonly<Record<string, (raw: unknown) => Record<string, unknown> | null>> = {
  bold: sinAtributos,
  italic: sinAtributos,
  underline: sinAtributos,
  strike: sinAtributos,
  link: (raw): AttrsEnlace | null => {
    const r = obj(raw);
    const href = hrefSeguro(r.href);
    return href ? { href, target: r.target === '_blank' ? '_blank' : null } : null;
  },
  textStyle: (raw): AttrsTextStyle | null => {
    const r = obj(raw);
    const color = colorValido(r.color);
    const tam = (TAMANOS_TEXTO as readonly unknown[]).includes(r.tam) ? (r.tam as TamanoTexto) : null;
    return color || tam ? { color, tam } : null;
  },
  highlight: (raw): AttrsResaltado => ({ color: colorValido(obj(raw).color) }),
  etiqueta: (raw): AttrsEtiqueta => {
    const c = obj(raw).color;
    return { color: (COLORES_TEMA as readonly unknown[]).includes(c) ? (c as ColorTema) : null };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Las formas
// ─────────────────────────────────────────────────────────────────────────────

type Hijo = HijoArbol;
const el = (tag: string, attrs: AttrsArbol, ...hijos: Hijo[]): NodoArbol => [tag, attrs, ...hijos];
const si = (b: boolean): string | undefined => (b ? 'si' : undefined);
const modo = (ctx?: CtxSpec): ModoRender => ctx?.modo ?? 'editor';
const estiloAlinea = (a: AlineacionTexto | null): string | undefined => (a && a !== 'left' ? `text-align:${a}` : undefined);

/** Las variables de un fondo propio, saneadas: sólo `--gm-…` y sin comillas ni ángulos. */
function estiloDeVars(vars: Record<string, string> | undefined): string | undefined {
  if (!vars) return undefined;
  const partes = Object.entries(vars)
    .filter(([k, v]) => /^--gm-[a-z0-9-]{1,40}$/.test(k) && typeof v === 'string')
    .map(([k, v]) => `${k}:${v.replace(/[<>"';{}]/g, '')}`);
  return partes.length ? partes.join(';') : undefined;
}

/**
 * `section.gm-tarjeta#t-<id>` > `.gm-tarjeta-fondo` + `.gm-acento` (sólo con imagen) + `.gm-tarjeta-cuerpo`.
 * Sin imagen permitida, el diseño sale como 'sin' (una columna para una imagen que no está
 * dejaría la mitad de la sección vacía).
 */
export function specTarjeta(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsTarjeta(raw);
  // El video de fondo sólo con el diseño «fondo» (el hero): su póster hace de imagen (ver `acentoConVideo`).
  const video = a.diseno === 'fondo' ? a.videoFondo : null;
  const conImagen = a.diseno !== 'sin' && (!!a.imagenSrc || !!video);
  const diseno = conImagen ? a.diseno : 'sin';
  const fondoEstilo = a.fondo === 'color' && a.fondoColor ? `background:${a.fondoColor}`
    : a.fondo === 'degradado' && a.fondoDegradado ? `background:${DEGRADADOS[a.fondoDegradado]}` : undefined;
  const hijos: Hijo[] = [el('div', { class: 'gm-tarjeta-fondo', style: fondoEstilo })];
  if (video) hijos.push(acentoConVideo(a, video, ctx));
  else if (conImagen && a.imagenSrc) {
    hijos.push(el('div', {
      class: 'gm-acento',
      'data-ajuste': a.imagenAjuste,
      style: `background-image:url("${a.imagenSrc}");background-position:${Math.round(a.imagenFocoX * 10) / 10}% ${Math.round(a.imagenFocoY * 10) / 10}%`,
    }));
  }
  hijos.push(el('div', { class: 'gm-tarjeta-cuerpo' }, 0));
  // Con un fondo propio, las variables del tema para ESE fondo (la tinta que se lee encima):
  // las calcula temas.ts (`varsDeFondoPropio`) y llegan por el contexto.
  const relleno = a.fondo === 'color' ? a.fondoColor : a.fondo === 'degradado' && a.fondoDegradado ? DEGRADADOS[a.fondoDegradado] : null;
  let varsFondo: Record<string, string> | undefined;
  if (relleno && ctx?.varsFondo) { try { varsFondo = ctx.varsFondo(relleno); } catch { varsFondo = undefined; } }
  return el('section', {
    class: 'gm-tarjeta',
    id: a.id ? `t-${a.id}` : undefined,
    'data-diseno': diseno,
    'data-ancho': a.ancho,
    'data-alinea': a.alineacion,
    'data-alto': a.alto,
    'data-fondo': a.fondo,
    'data-superposicion': a.superposicion,
    'data-oculta': modo(ctx) !== 'publico' ? si(a.oculta) : undefined,
    // La animación resuelta (data-anim / data-anim-dir / data-anim-texto: animaciones.ts, `datosDeAnimacion`).
    // En la publicada la usa la hoja bajo html.gm-anim; en el editor y las tiles, sólo con .gm-reproducir.
    ...datosDeAnimacion(ctx?.seccion?.animacion),
    style: estiloDeVars(varsFondo),
  }, ...hijos);
}

/**
 * El acento de un hero con VIDEO de fondo (animaciones.ts, `VideoFondo`; hoy la pantalla no lo ofrece:
 * `VIDEO_FONDO.disponible`). Lo medido está en docs/hallazgos-editor-landing.md → «Animaciones: el video de fondo
 * del hero» («Lo que la plataforma ya deja y lo que no»):
 *   · En la PUBLICADA, el póster como `<img>` (es el LCP: `fetchpriority="high"` en la primera sección visible,
 *     `loading="lazy"` en las demás) y encima un `<video muted playsinline loop preload="none">` SIN `autoplay` ni
 *     `src` en el HTML: `autoplay` le gana a `preload` y le robaba ancho de banda al póster (+0,7-0,8 s de LCP en
 *     Slow 4G). El script de la página (pagina-publica.ts) le pone `src` después del load (`data-src`, o
 *     `data-src-movil` en el ancho del teléfono), lo muestra recién con `playing` y agrega la pausa (WCAG 2.2.2).
 *   · El póster del teléfono (`posterMovil`, vertical) va por `srcset` con `sizes="<corte> 1px, 100vw"`: en el
 *     ancho del teléfono el navegador toma el candidato más chico (el vertical, 480w) — el MISMO corte con que el
 *     script elige el video vertical. No va en un `<picture>` porque htmlDeArbol (grafico-svg.ts) no lo deja salir.
 *   · En el editor, las miniaturas y lo exportado, sólo el póster, de fondo como una imagen de acento.
 * El encuadre (`imagenFocoX/Y`) y el ajuste (`imagenAjuste`) de la imagen valen para el póster y el video.
 */
function acentoConVideo(a: AttrsTarjeta, v: VideoFondo, ctx?: CtxSpec): NodoArbol {
  const foco = `${Math.round(a.imagenFocoX * 10) / 10}% ${Math.round(a.imagenFocoY * 10) / 10}%`;
  if (modo(ctx) !== 'publico') {
    return el('div', { class: 'gm-acento', 'data-ajuste': a.imagenAjuste, style: `background-image:url("${v.poster}");background-position:${foco}` });
  }
  const indice = ctx?.seccion?.indice;
  const primera = indice === 0;
  return el('div', { class: 'gm-acento', 'data-ajuste': a.imagenAjuste, 'data-video': 'si' },
    el('img', {
      class: 'gm-acento-poster',
      src: v.poster,
      srcset: v.posterMovil ? `${v.posterMovil} 480w, ${v.poster} 1280w` : undefined,
      sizes: v.posterMovil ? `${CORTE_CELULAR} 1px, 100vw` : undefined,
      alt: '',
      fetchpriority: primera ? 'high' : undefined,
      loading: indice !== undefined && !primera ? 'lazy' : undefined,
      decoding: primera ? undefined : 'async',
      style: `object-position:${foco}`,
    }),
    el('video', {
      class: 'gm-acento-video',
      muted: '', playsinline: '', loop: '', preload: 'none',
      'data-src': v.src,
      'data-src-movil': v.srcMovil ?? undefined,
      'aria-hidden': 'true', tabindex: '-1', disablepictureinpicture: '', disableremoteplayback: '',
      style: `object-position:${foco}`,
    }));
}

/** `.gm-columnas[style="--gm-cols: 4fr 8fr"][data-divisores]` (anchos en una grilla de 12). */
export function specColumnas(raw: unknown): NodoArbol {
  const a = attrsColumnas(raw);
  return el('div', {
    class: 'gm-columnas',
    style: a.anchos.length ? `--gm-cols: ${a.anchos.map((n) => `${n}fr`).join(' ')}` : undefined,
    'data-divisores': si(a.divisores),
  }, 0);
}

export const specColumna = (): NodoArbol => el('div', { class: 'gm-columna' }, 0);

/** El grupo de Gamma de cada variante («Línea de tiempo» → `linea-de-tiempo`), para la hoja. */
const GRUPO_DE_VARIANTE: Record<string, string> = Object.fromEntries(
  OPTIMIZADOS.map((o) => [o.id, o.grupo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')]),
);

/** `.gm-optimizado[data-variante][data-grupo][data-cols][data-iconos]` («Diseños optimizados»). */
export function specOptimizado(raw: unknown): NodoArbol {
  const a = attrsOptimizado(raw);
  return el('div', {
    class: 'gm-optimizado',
    'data-variante': a.variante,
    'data-grupo': GRUPO_DE_VARIANTE[a.variante],
    'data-cols': a.columnas,
    'data-iconos': si(a.mostrarIconos),
  }, 0);
}

/**
 * El número que trae el valor de un ítem («97%» → 97, «4.9» → 4.9, «1,200» → 1200), para las
 * variantes que lo dibujan (estadísticas circulares, de barras, estrellas): sale como
 * `--gm-num` y la hoja hace la cuenta. `null` si no trae número.
 */
export function numeroDeValor(valor: string): number | null {
  const m = /-?\d+(?:[.,]\d+)*/.exec(valor);
  if (!m) return null;
  let s = m[0];
  if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(-1e9, Math.min(1e9, Math.round(n * 100) / 100));
}

/**
 * `.gm-item[data-destacado]` > `.gm-item-marca` (ícono · imagen · valor) + `.gm-item-cuerpo`. Con
 * `ctx.completar`, el `valor` («[00]%», «[$000]») marca lo que hay que completar: es un atributo, no
 * texto del documento, así que el recorrido de render.ts no lo ve.
 */
export function specOptimizadoItem(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsOptimizadoItem(raw);
  const marca: Hijo[] = [];
  if (a.icono) marca.push(el('span', { class: 'gm-item-icono', 'data-icono': a.icono, 'aria-hidden': 'true' }));
  if (a.imagenSrc) marca.push(el('img', { class: 'gm-item-imagen', src: a.imagenSrc, alt: '', loading: 'lazy', decoding: 'async' }));
  if (a.valor) marca.push(el('span', { class: 'gm-item-valor' }, ...(ctx?.completar ? hijosACompletar(a.valor) : [a.valor])));
  const num = a.valor ? numeroDeValor(a.valor) : null;
  return el('div', { class: 'gm-item', 'data-destacado': si(a.destacado), style: num != null ? `--gm-num:${num}` : undefined },
    el('div', { class: 'gm-item-marca' }, ...marca),
    el('div', { class: 'gm-item-cuerpo' }, 0));
}

export function specBotones(raw: unknown): NodoArbol {
  return el('div', { class: 'gm-botones', 'data-alinea': attrsBotones(raw).alinea }, 0);
}

/** `a.gm-boton[data-variante]`. Sin destino permitido, el `<a>` sale sin href. */
export function specBoton(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsBoton(raw);
  // `pago:<id>` no pasa por `hrefSeguro` (no lo conoce): lo resuelve render.ts (`resolverHref`) al paso
  // de nombre y email de la publicada, o a `#` donde no hay paso (vista previa, exportar). Sin
  // resolvedor (el DOM del editor) se escribe como se guardó, igual que `pagina:<id>`.
  const pago = hrefPagoValido(a.href);
  const href = pago ? (ctx?.resolverHref ? ctx.resolverHref(pago) ?? undefined : pago) : hrefDe(a.href, ctx);
  // El paso de pago abre en la MISMA pestaña: es el camino de compra, no un sitio de afuera.
  const nueva = !pago && a.nuevaPestana && !!href && esExterno(href);
  return el('a', {
    class: 'gm-boton', 'data-variante': a.variante, href,
    target: nueva ? '_blank' : undefined, rel: nueva ? 'noopener noreferrer' : undefined,
  }, 0);
}

/** `aside.gm-recuadro[data-tono]` > `.gm-recuadro-icono` (ícono = el tono) + `.gm-recuadro-cuerpo`. */
export function specRecuadro(raw: unknown): NodoArbol {
  const tono = attrsRecuadro(raw).tono;
  return el('aside', { class: 'gm-recuadro', 'data-tono': tono },
    el('div', { class: 'gm-recuadro-icono', 'data-icono': tono, 'aria-hidden': 'true' }),
    el('div', { class: 'gm-recuadro-cuerpo' }, 0));
}

/** `details.gm-desplegable` (funciona sin JavaScript: las preguntas frecuentes se leen igual). */
export function specDesplegable(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const abierto = attrsDesplegable(raw).abierto || modo(ctx) === 'exportar';
  return el('details', { class: 'gm-desplegable', open: abierto ? '' : undefined }, 0);
}
export const specDesplegableTitulo = (): NodoArbol => el('summary', { class: 'gm-desplegable-titulo' }, 0);
export const specDesplegableCuerpo = (): NodoArbol => el('div', { class: 'gm-desplegable-cuerpo' }, 0);

/** `figure.gm-imagen[data-ancho][data-alinea][data-forma]` > (a >) img. Sin src permitido: la figura vacía. */
export function specImagen(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsImagen(raw);
  const attrsFig: AttrsArbol = {
    class: 'gm-imagen', 'data-ancho': String(a.ancho), 'data-alinea': a.alinea, 'data-forma': a.forma,
    'data-vacia': a.src ? undefined : 'si',
  };
  if (!a.src) return el('figure', attrsFig);
  const img = el('img', { src: a.src, alt: a.alt, loading: 'lazy', decoding: 'async' });
  const href = a.href ? hrefDe(a.href, ctx) : undefined;
  if (!href) return el('figure', attrsFig, img);
  const ext = esExterno(href);
  return el('figure', attrsFig, el('a', { href, target: ext ? '_blank' : undefined, rel: ext ? 'noopener noreferrer' : undefined }, img));
}

/** `figure.gm-video > video`. En miniatura no se carga el video: va el póster o un marcador. */
export function specVideo(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsVideo(raw);
  const attrsFig: AttrsArbol = { class: 'gm-video', 'data-ancho': String(a.ancho), 'data-vacia': a.src ? undefined : 'si' };
  if (!a.src) return el('figure', attrsFig);
  if (modo(ctx) === 'miniatura') {
    return el('figure', { ...attrsFig, 'data-marcador': 'si' },
      a.poster ? el('img', { src: a.poster, alt: '', loading: 'lazy', decoding: 'async' }) : el('div', { class: 'gm-marcador' }));
  }
  return el('figure', attrsFig, el('video', {
    src: a.src,
    poster: a.poster ?? undefined,
    controls: a.autoplay ? undefined : '',
    autoplay: a.autoplay ? '' : undefined,
    muted: a.autoplay ? '' : undefined,
    loop: a.bucle ? '' : undefined,
    playsinline: '',
    preload: 'metadata',
  }));
}

/**
 * `.gm-insertado > iframe`, con los atributos de `atributosDeIframe` (lib/embeds.ts: sandbox,
 * allow, referrer y title fijos; ninguno libre). Una agenda lleva su alto de la lista cerrada.
 */
export function specInsertado(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsInsertado(raw);
  const clase = claseDeProveedor(a.proveedor) ?? undefined;
  const attrsDiv: AttrsArbol = { class: 'gm-insertado', 'data-proveedor': a.proveedor || undefined, 'data-clase': clase };
  if (!a.src) {
    // El VSL vacío de un diseño, en una miniatura que pide MARCADORES: un video 16:9 con un ▶, sin
    // texto (la grilla de Diseños tiene que mostrar que la landing lleva video; pedido de Martín,
    // 14/10/2026). La publicada, la exportación y la vista del visitante en el teléfono no lo
    // dibujan (render.ts no saca un insertado vacío) y el editor tiene su NodeView. Una agenda
    // vacía no se dibuja en ningún modo. El ▶ va RELLENO (`play-relleno`, el peso «fill» de Phosphor),
    // como el de un reproductor: el `play` de contorno del catálogo es el de «Presentar».
    if (ctx?.marcadores && modo(ctx) === 'miniatura' && clase === 'video') {
      return el('div', { ...attrsDiv, 'data-marcador': 'si', 'data-pista': 'si' },
        el('div', { class: 'gm-marcador', 'data-play': 'si' },
          el('span', { class: 'gm-marcador-play', 'data-icono': 'play-relleno', 'aria-hidden': 'true' })));
    }
    return el('div', { ...attrsDiv, 'data-vacia': 'si' });
  }
  if (modo(ctx) === 'miniatura') {
    return el('div', { ...attrsDiv, 'data-marcador': 'si' }, el('div', { class: 'gm-marcador' }, nombreDeProveedor(a.proveedor) ?? ''));
  }
  const pares = atributosDeIframe({ src: a.src, proveedor: a.proveedor, alto: a.alto ?? undefined });
  const attrsIframe: Record<string, string | undefined> = {};
  for (const [k, v] of pares) attrsIframe[k] = v;
  if (clase === 'agenda') attrsIframe.style = `height:${attrsIframe['data-alto'] ?? '700'}px`;
  return el('div', attrsDiv, el('iframe', attrsIframe));
}

/**
 * Un id de DOM SIN LETRAS a partir del id del campo (cada carácter, su código en 3 dígitos: no
 * hay dos ids que den el mismo). Un id al azar podría contener «tel» o «mail», y el Pixel, que
 * mira el `id` y el `name` (lib/landing-token.ts), lo leería como teléfono o correo.
 */
function idDom(id: string): string {
  let d = '';
  for (let i = 0; i < id.length; i++) d += String(id.charCodeAt(i) % 1000).padStart(3, '0');
  return `gmc${d}`;
}
const NAME_CAMPO: Partial<Record<TipoCampo, string>> = { nombre: 'nombre', email: 'email', telefono: 'telefono', empresa: 'empresa' };

/** Un texto que viene de un ATRIBUTO, como hijos: tal cual, o con lo que hay que completar marcado. */
type Marcar = (texto: string) => Hijo[];
const tal = (texto: string): Hijo[] => [texto];

function specCampo(c: CampoFormulario, i: number, marcar: Marcar = tal): NodoArbol {
  const dom = idDom(c.id || `i${i}`);
  // `name` de los campos libres: «respuesta-<dígitos>», que no contiene ninguna palabra que el
  // Pixel lea como contacto (email, tel, nombre, name, empresa…: lib/landing-token.ts).
  const name = NAME_CAMPO[c.tipo] ?? `respuesta-${dom.slice(3)}`;
  const req = c.requerido ? '' : undefined;
  const rotulo = el('label', { class: 'gm-campo-etiqueta', for: dom, 'data-requerido': si(c.requerido) }, ...marcar(c.etiqueta));
  if (c.tipo === 'opciones') {
    // Radios. El Pixel arma la respuesta con `labels[0].textContent` del input marcado: con el
    // radio adentro de la etiqueta de su opción, la clave sería «Compra: Compra». Un `<label
    // hidden for>` con la PREGUNTA va antes (orden del documento = primero en `labels`): el
    // Pixel lee «¿Compras o rentas?: Compra», y como está oculto no se dibuja ni se anuncia.
    // Esa etiqueta oculta NUNCA se marca: es lo que lee el Pixel.
    return el('fieldset', { class: 'gm-campo', 'data-tipo': c.tipo },
      el('legend', { class: 'gm-campo-etiqueta', 'data-requerido': si(c.requerido) }, ...marcar(c.etiqueta)),
      ...c.opciones.flatMap((op, k): Hijo[] => [
        el('label', { for: `${dom}-${k}`, hidden: '' }, c.etiqueta),
        el('label', { class: 'gm-opcion' },
          el('input', { type: 'radio', id: `${dom}-${k}`, name, value: op, required: req }),
          el('span', {}, ...marcar(op))),
      ]));
  }
  let control: NodoArbol;
  if (c.tipo === 'textoLargo') {
    control = el('textarea', { id: dom, name, rows: '4', maxlength: '2000', required: req });
  } else {
    const porTipo: Record<string, AttrsArbol> = {
      nombre: { type: 'text', autocomplete: 'name' },
      email: { type: 'email', autocomplete: 'email', inputmode: 'email' },
      telefono: { type: 'tel', autocomplete: 'tel', inputmode: 'tel' },
      empresa: { type: 'text', autocomplete: 'organization' },
      texto: { type: 'text' },
    };
    control = el('input', { ...porTipo[c.tipo], id: dom, name, maxlength: '200', required: req });
  }
  return el('div', { class: 'gm-campo', 'data-tipo': c.tipo }, rotulo, control);
}

/**
 * `form.gm-formulario[data-exito][data-redirigir]` con inputs REALES que el Pixel de MaKo
 * reconoce (name="nombre", type="email" name="email", type="tel" name="telefono", name="empresa").
 * `method="post"` y sin `action`: si el script de la página no corriera, el envío va por POST a
 * la misma ruta (que no lo acepta) y los datos NUNCA quedan en la URL, como pasaría con un GET.
 * El mensaje de éxito ya viene escrito (oculto): el script sólo lo muestra.
 *
 * Con `ctx.completar` (la miniatura de TRABAJO), los «[ ]» de las etiquetas, las preguntas, las opciones
 * y el botón van marcados como en el texto (pendiente de los huecos resaltados, tanda 6: en la miniatura
 * el formulario era lo único sin marcar). Lo oculto (la etiqueta que lee el Pixel, el éxito) nunca, y la
 * publicada tampoco: el Pixel arma cada respuesta con `labels[0].textContent`.
 */
export function specFormulario(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsFormulario(raw);
  const redirigir = a.redirigir ? hrefDe(a.redirigir, ctx) : undefined;
  const marcar: Marcar = ctx?.completar ? hijosACompletar : tal;
  return el('form', {
    class: 'gm-formulario', method: 'post', 'data-exito': a.exito, 'data-redirigir': redirigir,
    inert: modo(ctx) === 'miniatura' ? '' : undefined,
  },
  ...a.campos.map((c, i) => specCampo(c, i, marcar)),
  el('button', { type: 'submit', class: 'gm-boton', 'data-variante': 'primario' }, ...marcar(a.boton)),
  el('p', { class: 'gm-formulario-exito', hidden: '', 'aria-live': 'polite' }, a.exito));
}

/**
 * La tinta de lo que hay que completar adentro del SVG de un gráfico: la franja de `.gm-completar`
 * (un `background`) no se dibuja en un `<tspan>`, así que va el relleno del acento, opaco (las
 * categorías y la leyenda son tenues, `fill-opacity: 0.7`).
 */
const TINTA_A_COMPLETAR_SVG = 'fill:var(--gm-acento-texto, #2f6fed);fill-opacity:1';

/** El árbol del gráfico con los «[ ]» de sus `<text>` (título, categorías, leyenda) en un `<tspan>`. El `<title>` y el `aria-label` no se ven: quedan igual. */
function graficoConACompletar(n: NodoArbol): NodoArbol {
  const [tag, ...resto] = n;
  const esTexto = tag === 'text' || tag.endsWith(' text');
  return [tag, ...resto.flatMap((h): Hijo[] => {
    if (Array.isArray(h)) return [graficoConACompletar(h as NodoArbol)];
    if (!esTexto || typeof h !== 'string') return [h];
    return tramosACompletar(h, rangosACompletar(h)).filter((t) => t.texto)
      .map((t): Hijo => (t.completar ? ['tspan', { class: CLASE_A_COMPLETAR, style: TINTA_A_COMPLETAR_SVG }, t.texto] : t.texto));
  })];
}

/**
 * `.gm-grafico > svg` (el mismo árbol que dibuja el NodeView: grafico-svg.ts). Con `ctx.completar`
 * (la miniatura de trabajo), los «[ ]» del título, las categorías y la leyenda van marcados.
 */
export function specGrafico(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const g = normalizarGrafico(raw);
  const svg = arbolDeGrafico(g);
  return el('div', { class: 'gm-grafico', 'data-tipo': g.tipo }, ctx?.completar ? graficoConACompletar(svg) : svg);
}

export function specEspaciador(raw: unknown): NodoArbol {
  return el('div', { class: 'gm-espaciador', 'data-alto': attrsEspaciador(raw).alto, 'aria-hidden': 'true' });
}

/**
 * `.gm-html > iframe[sandbox="allow-scripts"][srcdoc]`: el «HTML personalizado» corre en un
 * origen OPACO (sin `allow-same-origin`), como en Gamma: no ve la sesión de hola-mako.com, no
 * navega la pestaña de arriba ni abre ventanas. El `srcdoc` sale escapado como cualquier
 * atributo: un `"></iframe><script>` adentro no puede cerrar el iframe.
 *
 * En la página PUBLICADA (tanda 2, T6), si render.ts conoce la landing (`ctx.srcHtmlLibre`) y el bloque
 * tiene id, sale `iframe[src="/l/html/<docId>/<id>"][sandbox=SANDBOX_PUBLICO]` (html-libre.ts: scripts,
 * formularios y ventanas que salen sin el sandbox)
 * SIN `srcdoc`: ese documento trae su propia política (html-libre.ts) y su JavaScript corre — el
 * `srcdoc` hereda la política estricta de la página y no corría. `data-alto` queda como alto de
 * partida; el script de la página (pagina-publica.ts) lo ajusta con lo que el bloque mide.
 */
export function specHtmlLibre(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsHtmlLibre(raw);
  const attrsDiv: AttrsArbol = { class: 'gm-html', 'data-alto': String(a.alto) };
  if (!a.html) return el('div', { ...attrsDiv, 'data-vacia': 'si' });
  if (modo(ctx) === 'miniatura') return el('div', { ...attrsDiv, 'data-marcador': 'si' }, el('div', { class: 'gm-marcador' }));
  const src = modo(ctx) === 'publico' && a.id && ctx?.srcHtmlLibre ? ctx.srcHtmlLibre(a.id) : null;
  if (src) {
    return el('div', attrsDiv, el('iframe', {
      sandbox: SANDBOX_PUBLICO, src, title: 'HTML personalizado', loading: 'lazy',
      referrerpolicy: 'no-referrer', style: `height:${a.alto}px`,
    }));
  }
  return el('div', attrsDiv, el('iframe', {
    sandbox: 'allow-scripts', srcdoc: a.html, title: 'HTML personalizado', loading: 'lazy',
    referrerpolicy: 'no-referrer', style: `height:${a.alto}px`,
  }));
}

// ── Los de TipTap (StarterKit, listas de tareas, tablas) ─────────────────────

export function specParrafo(raw: unknown): NodoArbol {
  const a = attrsParrafo(raw);
  return el('p', { 'data-variante': a.variante ?? undefined, style: estiloAlinea(a.textAlign) }, 0);
}
/** h1..h4; `h1.gm-titulo` = el «Título» grande. */
export function specEncabezado(raw: unknown): NodoArbol {
  const a = attrsEncabezado(raw);
  return el(`h${a.level}`, { class: a.variante === 'titulo' ? 'gm-titulo' : undefined, style: estiloAlinea(a.textAlign) }, 0);
}
export const specListaVinetas = (): NodoArbol => el('ul', {}, 0);
export function specListaOrdenada(raw: unknown): NodoArbol {
  const s = attrsListaOrdenada(raw).start;
  return el('ol', { start: s !== 1 ? String(s) : undefined }, 0);
}
export const specItemLista = (): NodoArbol => el('li', {}, 0);
export const specListaTareas = (): NodoArbol => el('ul', { 'data-type': 'taskList' }, 0);
/** La casilla sale deshabilitada: en la página publicada es un dibujo, no un control. */
export function specTarea(raw: unknown): NodoArbol {
  const c = attrsTarea(raw).checked;
  return el('li', { 'data-type': 'taskItem', 'data-checked': c ? 'true' : 'false' },
    el('label', {}, el('input', { type: 'checkbox', checked: c ? '' : undefined, disabled: '' }), el('span', {})),
    el('div', {}, 0));
}
export const specCita = (): NodoArbol => el('blockquote', {}, 0);
export const specSeparador = (): NodoArbol => el('hr', {});
export const specSalto = (): NodoArbol => el('br', {});
/** `.gm-tabla > table` (sin `colgroup` ni anchos en px: la hoja reparte). */
export const specTabla = (): NodoArbol => el('div', { class: 'gm-tabla' }, el('table', {}, el('tbody', {}, 0)));
export const specFila = (): NodoArbol => el('tr', {}, 0);
function celda(tag: 'th' | 'td', raw: unknown): NodoArbol {
  const a = attrsCelda(raw);
  return el(tag, { colspan: a.colspan > 1 ? String(a.colspan) : undefined, rowspan: a.rowspan > 1 ? String(a.rowspan) : undefined }, 0);
}
export const specCeldaEncabezado = (raw: unknown): NodoArbol => celda('th', raw);
export const specCelda = (raw: unknown): NodoArbol => celda('td', raw);

/** Forma de cada nodo, por nombre. `doc` y `text` no tienen (ver `NORMALIZAR_NODOS`). */
export const SPEC_NODOS: Readonly<Record<string, (attrs: unknown, ctx?: CtxSpec) => NodoArbol>> = {
  [NODO.tarjeta]: specTarjeta,
  [NODO.columnas]: specColumnas,
  [NODO.columna]: specColumna,
  [NODO.optimizado]: specOptimizado,
  [NODO.optimizadoItem]: specOptimizadoItem,
  [NODO.botones]: specBotones,
  [NODO.boton]: specBoton,
  [NODO.recuadro]: specRecuadro,
  [NODO.desplegable]: specDesplegable,
  [NODO.desplegableTitulo]: specDesplegableTitulo,
  [NODO.desplegableCuerpo]: specDesplegableCuerpo,
  [NODO.imagen]: specImagen,
  [NODO.video]: specVideo,
  [NODO.insertado]: specInsertado,
  [NODO.formulario]: specFormulario,
  [NODO.grafico]: specGrafico,
  [NODO.espaciador]: specEspaciador,
  [NODO.htmlLibre]: specHtmlLibre,
  paragraph: specParrafo,
  heading: specEncabezado,
  bulletList: specListaVinetas,
  orderedList: specListaOrdenada,
  listItem: specItemLista,
  taskList: specListaTareas,
  taskItem: specTarea,
  blockquote: specCita,
  horizontalRule: specSeparador,
  hardBreak: specSalto,
  table: specTabla,
  tableRow: specFila,
  tableHeader: specCeldaEncabezado,
  tableCell: specCelda,
};

// ── Marcas ───────────────────────────────────────────────────────────────────

/** El enlace: href permitido (y resuelto); `target=_blank` sólo hacia afuera. */
export function specEnlace(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = NORMALIZAR_MARCAS.link(raw) as AttrsEnlace | null;
  const href = a ? hrefDe(a.href, ctx) : undefined;
  const nueva = !!a && a.target === '_blank' && !!href && esExterno(href);
  return el('a', { href, target: nueva ? '_blank' : undefined, rel: nueva ? 'noopener noreferrer' : undefined }, 0);
}
/** `span[data-color][data-tam]`: un token del tema va como `data-color`; un hex, en el estilo (con `data-color="propio"`). */
export function specTextStyle(raw: unknown): NodoArbol {
  const a = (NORMALIZAR_MARCAS.textStyle(raw) as AttrsTextStyle | null) ?? { color: null, tam: null };
  const hex = a.color && esHex(a.color) ? a.color : null;
  return el('span', { 'data-color': hex ? 'propio' : a.color ?? undefined, 'data-tam': a.tam ?? undefined, style: hex ? `color:${hex}` : undefined }, 0);
}
export function specResaltado(raw: unknown): NodoArbol {
  const c = (NORMALIZAR_MARCAS.highlight(raw) as AttrsResaltado).color;
  const hex = c && esHex(c) ? c : null;
  return el('mark', { 'data-color': hex ? 'propio' : c ?? undefined, style: hex ? `background-color:${hex}` : undefined }, 0);
}
export function specEtiqueta(raw: unknown): NodoArbol {
  const c = (NORMALIZAR_MARCAS.etiqueta(raw) as AttrsEtiqueta).color;
  return el('span', { class: 'gm-etiqueta', 'data-color': c ?? undefined }, 0);
}

/** Forma de cada marca, por nombre (el contenido va en el hueco `0`). */
export const SPEC_MARCAS: Readonly<Record<string, (attrs: unknown, ctx?: CtxSpec) => NodoArbol>> = {
  bold: () => el('strong', {}, 0),
  italic: () => el('em', {}, 0),
  underline: () => el('u', {}, 0),
  strike: () => el('s', {}, 0),
  link: specEnlace,
  textStyle: specTextStyle,
  highlight: specResaltado,
  etiqueta: specEtiqueta,
};

/**
 * El orden en que se ANIDAN las marcas (de afuera hacia adentro). El enlace va afuera para que
 * un texto con negrita en el medio no parta el `<a>` en tres.
 */
export const ORDEN_MARCAS: readonly string[] = ['link', 'etiqueta', 'textStyle', 'highlight', 'bold', 'italic', 'underline', 'strike'];

/** Helper para el editor: la forma como string (lo mismo que render.ts escribe para ese nodo vacío). */
export function htmlDeSpec(spec: NodoArbol, contenido = ''): string {
  return htmlDeArbol(spec, contenido);
}
