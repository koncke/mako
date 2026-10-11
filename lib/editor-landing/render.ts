// =============================================================================
// editor-landing/render — JSON de la landing + tema → HTML (la ÚNICA fábrica de HTML público)
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D3).
//
// Lo usan la publicación (la foto en `landing_docs.publicado`, publicar.ts), la vista privada
// del borrador, la exportación (HTML, PDF, PNG, PPTX), las miniaturas de la tira y del Panel, y
// el modo Presentar. El documento HTML completo (head, SEO, fuentes, Pixel, script del
// formulario) lo arma pagina-publica.ts sobre `htmlDePagina`.
//
// La forma de cada nodo NO se decide acá: sale de especificacion.ts (la misma función que usa
// el `renderHTML` del editor). Este módulo recorre el JSON, aplica las marcas, escapa todo
// texto y todo atributo (`htmlDeArbol`, grafico-svg.ts) y arma la raíz con el tema.
//
// ⚠️ Sólo conoce los nodos y marcas de doc.ts: lo que no conoce NO SALE (ni su contenido).
// ⚠️ No confía en que el JSON venga saneado: cada nodo normaliza sus atributos (especificación),
//    una imagen o un video que no son del bucket propio no se dibujan, un href que no está en
//    la lista (http(s), mailto:, tel:, `#t-<id>`, `pagina:<id>`) se escribe sin destino.
// ⚠️ Las secciones ocultas (`oculta: true`) no salen salvo `incluirOcultas` (la tira las muestra
//    atenuadas). Las notas del orador y el «bloquear para la IA» no salen nunca.
// ⚠️ PURO: sin DOM ni server-only; mismo input → mismo HTML (no hay azar ni fechas).
// =============================================================================

import { NODO, TOPES, type JsonNodo, type LandingContenido, type Pagina } from './doc';
import type { ConfigLanding } from './api-tipos';
import { estiloDeTema, varsDeFondoPropio, type Tema } from './temas';
import { svgIcono } from './iconos';
import {
  NORMALIZAR_MARCAS, ORDEN_MARCAS, SPEC_MARCAS, SPEC_NODOS, attrsHtmlLibre, attrsImagen, attrsInsertado,
  attrsTarjeta, attrsVideo, hrefPermitido, idValido, srcImagen, type CtxSpec, type ModoRender,
} from './especificacion';
import { HtmlCrudo, escaparTexto, htmlDeArbol, type AttrsArbol, type HijoArbol, type NodoArbol } from './grafico-svg';
import { sanearConfig } from './validar';

export { ORIGEN_IMAGENES, origenImagenes, srcPermitido, hrefPermitido } from './especificacion';
export type { ModoRender } from './especificacion';

/**
 * Cómo se pide el HTML. `urlBase` es la dirección de la página de inicio del sitio publicado
 * (`/l/<slug>` o `https://hola-mako.com/l/<slug>`): con ella `pagina:<id>` se resuelve a
 * `<urlBase>/<ruta>`. `paginas` es la lista de páginas del sitio (id y ruta) para esa resolución;
 * `htmlDeContenido` la arma sola.
 */
export type OpRender = {
  modo: ModoRender;
  incluirOcultas?: boolean;
  urlBase?: string;
  paginas?: ReadonlyArray<Pick<Pagina, 'id' | 'ruta'>>;
};

/** La dirección de MaKo del sello «Hecho con MaKo». */
const URL_MAKO = 'https://hola-mako.com';
/** Tope de anidamiento y de nodos por render: un JSON hostil no puede colgar el server. */
const PROFUNDIDAD_MAX = 32;
const NODOS_MAX = 120_000;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

type Ctx = {
  modo: ModoRender;
  incluirOcultas: boolean;
  urlBase: string | null;
  rutas: Map<string, string>;
  /** La sección que tiene el formulario en lo que se está dibujando (red de `#t-formulario`). */
  formulario: string | null;
  spec: CtxSpec;
  nodos: number;
};

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Una base sana: una ruta absoluta del sitio o una URL http(s), sin comillas ni espacios. */
function baseValida(b: unknown): string | null {
  if (typeof b !== 'string') return null;
  const t = b.trim();
  if (!/^(https?:\/\/[^\s"'<>`]+|\/[^\s"'<>`]*)$/i.test(t)) return null;
  return t.replace(/\/+$/, '') || '/';
}

/** El ancla que deja la IA cuando la tanda no tiene el formulario (ia-bloques.ts, ANCLA_FORMULARIO). */
const ANCLA_FORMULARIO_PENDIENTE = '#t-formulario';

/** El id de la primera sección que tiene un formulario adentro, o null. */
function idConFormulario(tarjetas: readonly unknown[]): string | null {
  const tiene = (n: unknown): boolean => esObj(n) && (n.type === NODO.formulario || (Array.isArray(n.content) && n.content.some(tiene)));
  for (const t of tarjetas) {
    if (!esObj(t) || !tiene(t)) continue;
    const id = esObj(t.attrs) ? idValido(t.attrs.id) : null;
    if (id) return id;
  }
  return null;
}

function ctxDe(op?: Partial<OpRender>, tema?: Tema, formulario: string | null = null): Ctx {
  const modo: ModoRender = op?.modo === 'editor' || op?.modo === 'miniatura' || op?.modo === 'exportar' ? op.modo : 'publico';
  const rutas = new Map<string, string>();
  for (const p of op?.paginas ?? []) {
    if (p && typeof p.id === 'string' && typeof p.ruta === 'string') rutas.set(p.id, p.ruta);
  }
  const ctx: Ctx = { modo, incluirOcultas: op?.incluirOcultas === true, urlBase: baseValida(op?.urlBase), rutas, formulario, spec: { modo }, nodos: 0 };
  ctx.spec = {
    modo,
    resolverHref: (h) => resolverHref(h, ctx),
    // La tinta de una sección con fondo propio la calcula el tema (temas.ts).
    varsFondo: tema ? (relleno) => varsDeFondoPropio(tema, relleno) : undefined,
  };
  return ctx;
}

/**
 * `pagina:<id>` → la dirección de esa página (`<urlBase>` o `<urlBase>/<ruta>`). Sin `urlBase`
 * o con una página que ya no existe, el enlace queda en `#`: un `pagina:` crudo en un `<a>`
 * haría que el navegador busque una aplicación para ese esquema.
 */
function resolverHref(h: string, ctx: Ctx): string | null {
  // RED: un botón «al formulario» que nadie resolvió (`resolverAnclas` de ia-bloques.ts lo resuelve
  // al juntar las tandas y al aceptar una edición de la IA) apunta a la sección que lo tiene.
  if (h === ANCLA_FORMULARIO_PENDIENTE) return ctx.formulario ? `#t-${ctx.formulario}` : h;
  if (!h.startsWith('pagina:')) return h;
  const ruta = ctx.rutas.get(h.slice('pagina:'.length));
  if (ruta === undefined || !ctx.urlBase) return '#';
  if (!ruta) return ctx.urlBase;
  return `${ctx.urlBase === '/' ? '' : ctx.urlBase}/${ruta}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Íconos: el SVG lo pone el catálogo (iconos.ts), nunca el dato
// ─────────────────────────────────────────────────────────────────────────────

/** El SVG del catálogo para un nombre, o null si lo que vuelve no tiene la forma esperada. */
function iconoSvg(nombre: string): string | null {
  try {
    const s = svgIcono(nombre, 24);
    return typeof s === 'string' && /^<svg[\s>]/i.test(s) && !/<script|\son[a-z]+\s*=/i.test(s) ? s : null;
  } catch {
    return null;
  }
}

/** Le agrega el SVG a cada `<span data-icono>` vacío de la especificación. No muta el árbol. */
function conIconos(n: NodoArbol): NodoArbol {
  const [tag, ...resto] = n;
  const attrs = esObj(resto[0]) && !(resto[0] instanceof HtmlCrudo) ? (resto[0] as AttrsArbol) : null;
  const hijos = (attrs ? resto.slice(1) : resto).map((h): HijoArbol => (Array.isArray(h) ? conIconos(h as NodoArbol) : h));
  const nombre = attrs?.['data-icono'];
  if (attrs && typeof nombre === 'string' && hijos.length === 0) {
    const svg = iconoSvg(nombre);
    if (svg) return [tag, attrs, new HtmlCrudo(svg)];
  }
  return attrs ? [tag, attrs, ...hijos] : [tag, ...hijos];
}

/**
 * La miniatura (Panel, tira de secciones, Agente) es DECORATIVA y vive adentro de un `<a>` o un
 * `<button>`: sin enlaces, formularios ni botones de verdad. No es sólo prolijidad: el Panel se
 * dibuja en el server, y el `<a>` de un Botón de la landing adentro del `<a>` de la tarjeta lo
 * PARTE el parser del navegador (no admite un `<a>` dentro de otro) → el DOM no coincide con el
 * de React y la hidratación falla («Hydration failed … <div className="gp-card-mini">», medido el
 * 11/10/2026 con un Botón en la primera sección). `data-gm-a` conserva el aspecto del enlace
 * (css.ts). No muta el árbol.
 */
const INTERACTIVO_A_DECORATIVO: Readonly<Record<string, string>> = { a: 'span', button: 'span', form: 'div' };
const ATTRS_INTERACTIVOS = new Set(['href', 'target', 'rel', 'type', 'method', 'action']);
function sinInteractivos(n: NodoArbol): NodoArbol {
  const [tag, ...resto] = n;
  const attrs = esObj(resto[0]) && !(resto[0] instanceof HtmlCrudo) ? (resto[0] as AttrsArbol) : null;
  const hijos = (attrs ? resto.slice(1) : resto).map((h): HijoArbol => (Array.isArray(h) ? sinInteractivos(h as NodoArbol) : h));
  const nombre = tag.includes(' ') ? tag.slice(tag.indexOf(' ') + 1) : tag;
  const nuevo = INTERACTIVO_A_DECORATIVO[nombre];
  if (!nuevo) return attrs ? [tag, attrs, ...hijos] : [tag, ...hijos];
  const limpios: Record<string, string | undefined> = {};
  for (const k of Object.keys(attrs ?? {})) if (!ATTRS_INTERACTIVOS.has(k)) limpios[k] = attrs?.[k];
  if (nombre === 'a') limpios['data-gm-a'] = '';
  return [nuevo, limpios, ...hijos];
}

// ─────────────────────────────────────────────────────────────────────────────
// El recorrido
// ─────────────────────────────────────────────────────────────────────────────

type MarcaLista = { clave: string; abre: string; cierra: string };

/** Las marcas de un texto: conocidas, normalizadas, sin repetir y en el orden de anidado. */
function marcasDe(raw: unknown, ctx: Ctx): MarcaLista[] {
  if (!Array.isArray(raw)) return [];
  const vistas = new Set<string>();
  const out: { orden: number; m: MarcaLista }[] = [];
  for (const m of raw) {
    if (!esObj(m) || typeof m.type !== 'string') continue;
    const tipo = m.type;
    const norm = NORMALIZAR_MARCAS[tipo];
    const spec = SPEC_MARCAS[tipo];
    if (!norm || !spec || vistas.has(tipo)) continue;
    const attrs = norm(m.attrs);
    if (!attrs) continue;
    vistas.add(tipo);
    // El hueco se marca con un carácter de control que `escaparTexto` borra de todo texto y de
    // todo atributo: el único que queda en el string es el del hueco.
    const arbol = conIconos(spec(attrs, ctx.spec));
    const html = htmlDeArbol(ctx.modo === 'miniatura' ? sinInteractivos(arbol) : arbol, '\u0001');
    const i = html.indexOf('\u0001');
    out.push({ orden: ORDEN_MARCAS.indexOf(tipo), m: { clave: `${tipo}${JSON.stringify(attrs)}`, abre: html.slice(0, i), cierra: html.slice(i + 1) } });
  }
  return out.sort((a, b) => a.orden - b.orden).map((x) => x.m);
}

/**
 * Los hijos de un nodo. Los textos seguidos que comparten marcas comparten la etiqueta (como el
 * serializador de ProseMirror): «**Hola _mundo_**» sale `<strong>Hola <em>mundo</em></strong>`,
 * no dos `<strong>`.
 */
function htmlDeHijos(hijos: unknown, ctx: Ctx, prof: number): string {
  if (!Array.isArray(hijos)) return '';
  let out = '';
  const abiertas: MarcaLista[] = [];
  const cerrarHasta = (n: number) => { while (abiertas.length > n) out += abiertas.pop()!.cierra; };
  for (const h of hijos) {
    if (!esObj(h) || typeof h.type !== 'string') continue;
    if (h.type === 'text' || h.type === 'hardBreak') {
      const marcas = marcasDe(h.marks, ctx);
      let comun = 0;
      while (comun < abiertas.length && comun < marcas.length && abiertas[comun].clave === marcas[comun].clave) comun++;
      cerrarHasta(comun);
      for (let i = comun; i < marcas.length; i++) { out += marcas[i].abre; abiertas.push(marcas[i]); }
      if (h.type === 'hardBreak') out += '<br>';
      else if (typeof h.text === 'string') out += escaparTexto(h.text.replace(CONTROL, '').slice(0, TOPES.caracteresTexto));
      continue;
    }
    cerrarHasta(0);
    out += htmlDeNodo(h, ctx, prof);
  }
  cerrarHasta(0);
  return out;
}

/** Un nodo (y su contenido) a HTML. Desconocido, demasiado profundo o vacío: ''. */
function htmlDeNodo(n: Record<string, unknown>, ctx: Ctx, prof: number): string {
  if (prof > PROFUNDIDAD_MAX || ++ctx.nodos > NODOS_MAX) return '';
  const tipo = typeof n.type === 'string' ? n.type : '';
  const spec = SPEC_NODOS[tipo];
  if (!spec) return '';
  const attrs = n.attrs;
  // Lo que no se dibuja: la sección oculta y los átomos sin un origen permitido (una figura
  // vacía en la página publicada sería un hueco sin explicación).
  if (tipo === NODO.tarjeta && attrsTarjeta(attrs).oculta && !ctx.incluirOcultas) return '';
  if (tipo === NODO.imagen && !attrsImagen(attrs).src) return '';
  if (tipo === NODO.video && !attrsVideo(attrs).src) return '';
  if (tipo === NODO.insertado && !attrsInsertado(attrs).src) return '';
  if (tipo === NODO.htmlLibre && !attrsHtmlLibre(attrs).html) return '';
  const conSvg = conIconos(spec(attrs, ctx.spec));
  const arbol = ctx.modo === 'miniatura' ? sinInteractivos(conSvg) : conSvg;
  const contenido = Array.isArray(n.content) ? htmlDeHijos(n.content, ctx, prof + 1) : '';
  return htmlDeArbol(arbol, contenido);
}

/** La raíz `.gm-doc` con las variables del tema INLINE (así conviven miniaturas de temas distintos). */
function raiz(interior: string, tema: Tema, ctx: Ctx, extra: AttrsArbol = {}): string {
  let estilo = '';
  try { estilo = String(estiloDeTema(tema) ?? ''); } catch { estilo = ''; }
  return htmlDeArbol(['div', { class: 'gm-doc', style: estilo || undefined, 'data-modo': ctx.modo, ...extra }, 0], interior);
}

const tarjetasDePagina = (p: unknown): Record<string, unknown>[] => {
  const doc = esObj(p) ? p.doc : null;
  const content = esObj(doc) && Array.isArray(doc.content) ? doc.content : [];
  return content.filter((n): n is Record<string, unknown> => esObj(n) && n.type === NODO.tarjeta).slice(0, TOPES.tarjetasPorPagina);
};

// ─────────────────────────────────────────────────────────────────────────────
// El sitio: barra de navegación, pie y sello
// ─────────────────────────────────────────────────────────────────────────────

const destino = (raw: unknown, ctx: Ctx): string | undefined => {
  const h = hrefPermitido(raw);
  return h ? resolverHref(h, ctx) ?? undefined : undefined;
};

/** `nav.gm-nav`: logo (o nombre) que lleva al inicio, enlaces y hasta dos botones. */
function navArbol(cfg: ConfigLanding, ctx: Ctx): NodoArbol | null {
  const s = cfg.sitio;
  const logo = srcImagen(s.nav.logo);
  const marca: HijoArbol[] = logo ? [['img', { class: 'gm-nav-logo', src: logo, alt: s.nombre || 'Inicio' }]] : s.nombre ? [s.nombre] : [];
  const enlaces = s.nav.enlaces.map((e): NodoArbol => ['li', {}, ['a', { class: 'gm-nav-enlace', href: destino(e.destino, ctx) }, e.texto]]);
  const botones = s.nav.botones.map((b): NodoArbol => ['a', { class: 'gm-boton', 'data-variante': b.estilo, href: destino(b.destino, ctx) }, b.texto]);
  if (!marca.length && !enlaces.length && !botones.length) return null;
  const interior: HijoArbol[] = [];
  if (marca.length) interior.push(['a', { class: 'gm-nav-marca', href: ctx.urlBase ?? '#' }, ...marca]);
  if (enlaces.length) interior.push(['ul', { class: 'gm-nav-enlaces' }, ...enlaces]);
  if (botones.length) interior.push(['div', { class: 'gm-nav-botones' }, ...botones]);
  return ['nav', { class: 'gm-nav' }, ['div', { class: 'gm-nav-interior' }, ...interior]];
}

/** `footer.gm-pie`: el texto del pie, con sus saltos de línea. */
function pieArbol(texto: string): NodoArbol {
  const lineas = texto.split(/\r?\n/);
  const hijos: HijoArbol[] = [];
  lineas.forEach((l, i) => { if (i) hijos.push(['br', {}]); hijos.push(l); });
  return ['footer', { class: 'gm-pie' }, ['p', {}, ...hijos]];
}

// ─────────────────────────────────────────────────────────────────────────────
// La API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una sección sola, dentro de su raíz `.gm-doc` (con el tema) > `.gm-fondo` > `.gm-pagina`: la
 * miniatura de la tira y del Panel, una diapositiva de Presentar, un PNG exportado. '' si no es
 * una tarjeta o si está oculta y no se pidió `incluirOcultas`.
 */
export function htmlDeTarjeta(tarjeta: JsonNodo, tema: Tema, op?: Partial<OpRender>): string {
  if (!esObj(tarjeta) || tarjeta.type !== NODO.tarjeta) return '';
  const ctx = ctxDe(op, tema, idConFormulario([tarjeta]));
  const seccion = htmlDeNodo(tarjeta as unknown as Record<string, unknown>, ctx, 0);
  if (!seccion) return '';
  return raiz(htmlDeArbol(['div', { class: 'gm-fondo' }, ['div', { class: 'gm-pagina' }, 0]], seccion), tema, ctx);
}

/**
 * Una página entera: `.gm-doc` > `.gm-fondo` > `nav.gm-nav` + `main.gm-pagina` (las secciones) +
 * `footer.gm-pie` + `a.gm-marca`, según `config.sitio`. La configuración se vuelve a sanear acá
 * (es barato, y el render es la última puerta antes del HTML público).
 */
export function htmlDePagina(pagina: Pagina, config: ConfigLanding, tema: Tema, op?: Partial<OpRender>): string {
  const tarjetas = tarjetasDePagina(pagina);
  const ctx = ctxDe(op, tema, idConFormulario(tarjetas));
  const cfg = sanearConfig(config).config;
  const secciones = tarjetas.map((t) => htmlDeNodo(t, ctx, 0)).join('');
  const nav = cfg.sitio.nav.mostrar ? navArbol(cfg, ctx) : null;
  const pieTexto = cfg.sitio.pie.texto.trim();
  const fondoImagen = srcImagen(cfg.pagina.fondoImagen);
  const interior =
    (nav ? htmlDeArbol(nav) : '') +
    htmlDeArbol(['main', { class: 'gm-pagina' }, 0], secciones) +
    (cfg.sitio.pie.mostrar && pieTexto ? htmlDeArbol(pieArbol(pieTexto)) : '') +
    (cfg.sitio.marcaMako ? htmlDeArbol(['a', { class: 'gm-marca', href: URL_MAKO, target: '_blank', rel: 'noopener' }, 'Hecho con MaKo']) : '');
  const fondo = htmlDeArbol(['div', {
    class: 'gm-fondo',
    style: fondoImagen ? `background-image:url("${fondoImagen}")` : undefined,
    'data-imagen': fondoImagen ? 'si' : undefined,
  }, 0], interior);
  return raiz(fondo, tema, ctx, {
    'data-tema': cfg.tema,
    'data-animaciones': cfg.pagina.animaciones ? 'si' : undefined,
    'data-pagina': esObj(pagina) ? idValido(pagina.id) ?? undefined : undefined,
  });
}

export type PaginaHtml = { id: string; ruta: string; titulo: string; html: string };

/**
 * Todas las páginas del sitio, cada una con su HTML (los enlaces entre páginas ya resueltos con
 * `op.urlBase`). Para la exportación y para quien necesite el sitio entero.
 */
export function htmlDeContenido(contenido: LandingContenido, config: ConfigLanding, tema: Tema, op?: Partial<OpRender>): PaginaHtml[] {
  const paginas = esObj(contenido) && Array.isArray(contenido.paginas) ? contenido.paginas.filter(esObj) as Pagina[] : [];
  const lista = paginas.map((p) => ({ id: String(p.id ?? ''), ruta: typeof p.ruta === 'string' ? p.ruta : '' }));
  return paginas.slice(0, TOPES.paginas).map((p) => ({
    id: String(p.id ?? ''),
    ruta: typeof p.ruta === 'string' ? p.ruta : '',
    titulo: typeof p.titulo === 'string' ? p.titulo : '',
    html: htmlDePagina(p, config, tema, { ...op, modo: op?.modo ?? 'publico', paginas: op?.paginas ?? lista }),
  }));
}

/**
 * Unos nodos sueltos, SIN raíz ni tema (un fragmento: la vista «Original / Modificado» de la IA,
 * una tarjeta dentro de una raíz que ya existe). Lo que no conoce no sale.
 */
export function htmlDeFragmento(nodos: JsonNodo | JsonNodo[], op?: Partial<OpRender>): string {
  const ctx = ctxDe(op);
  return htmlDeHijos(Array.isArray(nodos) ? nodos : [nodos], ctx, 0);
}

/** El SVG de un ícono del catálogo (el mismo que pone el render en un `data-icono`), para un NodeView. */
export function htmlDeIcono(nombre: string): string {
  return iconoSvg(nombre) ?? '';
}
