// =============================================================================
// fondo-de-diseno — el color de fondo de una sección de «Diseño editable», para LEERLO y CAMBIARLO (25/10/2026)
// =============================================================================
// Martín (25/10): «tampoco puedo editar el color del bg de cada sección». Una sección de diseño (las páginas de MaKo) es
// su HTML tal cual: el estilo de la sección del editor (fondo, ancho…) no llega a lo publicado (render.ts). Medido en las
// landings de MaKo, el fondo que se ve sale de tres lados distintos:
//   · el `style` de la raíz (`<section style="background:#F5F7FA">`, la #32);
//   · una clase de la hoja del diseño (`.mkv-sec-gris`, las 14 nuevas), o una regla con `!important` (`#beta`, la #32);
//   · nada: la raíz es una COLUMNA angosta (`max-width:1120px; margin:0 auto`) y se ve el fondo de la página.
// Y entre secciones hay MÁRGENES (`margin-top:96px` en «historia» de la #32) que muestran el fondo de la página: pintada una
// sección, ese margen quedaba como una franja («en muchas secciones hay como una separación»).
// Por eso el color va al HTML, que es lo que se publica, en una ENVOLTURA de ancho completo:
//   `<div data-gm-fondo="<color>" data-gm-envoltura style="background:<color>;display:flow-root">`
//   · `flow-root` deja los márgenes de la raíz ADENTRO: lo pintado los incluye, y dos secciones pintadas se tocan sin franja;
//   · si la raíz trae fondo propio, `background:transparent !important` al final de su `style` (gana también a una regla
//     `!important` de la hoja), con la marca `data-gm-fondo="transparent"`: se ve el de la envoltura, de punta a punta;
//   · una raya de arriba (o de abajo) con margen del mismo lado quedaría flotando adentro de lo pintado: se hace
//     transparente (`data-gm-sin-borde`). Sin margen, la raya sigue en el borde y se queda;
//   · el padding de la raíz no se toca (el diseño lo cambia por pantalla con @media).
// Sin pintar, la sección no cambia en nada; «Del diseño» la vuelve byte por byte (lo que traía queda escrito).
// La excepción, una raíz pegajosa (el encabezado): envuelta dejaría de pegarse. El color va a su `style`, `!important`.
// ⚠️ PURO, sin DOM: lo usan el panel «Color de sección» (EstiloSeccion.tsx) y la API (configurar_seccion_landing).
// Lo prueba tests/fondo-de-diseno.test.ts.
// =============================================================================

import { DEGRADADOS, type Degradado } from './doc';
import { atributoDe, conAtributo } from './html-editable-elementos';

/** El fondo que se le pone a una sección de diseño: un color (#rrggbb) o un degradado de doc.ts. */
export type FondoDeDiseno = { color: string } | { degradado: Degradado };

const MARCA = 'data-gm-fondo';
const ENVOLTURA = 'data-gm-envoltura';
const SIN_BORDE = 'data-gm-sin-borde';
const ATTR = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const APERTURA = new RegExp(`^<([a-z][a-z0-9-]*)\\b${ATTR}>`, 'i');
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** El valor CSS de un fondo, o null si no es uno válido (un color que no es #rrggbb, un degradado que no existe). */
export function valorDeFondo(f: FondoDeDiseno): string | null {
  if ('color' in f) return HEX.test(f.color.trim()) ? f.color.trim().toLowerCase() : null;
  return Object.prototype.hasOwnProperty.call(DEGRADADOS, f.degradado) ? DEGRADADOS[f.degradado] : null;
}

/** El fondo que tiene un valor CSS (el de la marca), como color o degradado. */
function fondoDeValor(v: string): FondoDeDiseno | null {
  if (HEX.test(v)) return { color: v.toLowerCase() };
  const k = (Object.keys(DEGRADADOS) as Degradado[]).find((d) => DEGRADADOS[d] === v);
  return k ? { degradado: k } : null;
}

type Raiz = { tag: string; apertura: string; inicio: number; fin: number };

/** El ÚNICO elemento de arriba del HTML (su etiqueta, su apertura y dónde termina), o null si hay varios o texto suelto. */
function raizUnica(html: string): Raiz | null {
  const inicio = html.length - html.trimStart().length;
  const fin = html.trimEnd().length;
  const m = APERTURA.exec(html.slice(inicio));
  if (!m) return null;
  const tag = m[1].toLowerCase();
  const re = new RegExp(`<(/?)${tag}\\b${ATTR}>`, 'gi');
  re.lastIndex = inicio;
  let prof = 0;
  for (let t = re.exec(html); t; t = re.exec(html)) {
    if (t[1]) {
      prof--;
      if (prof === 0) return re.lastIndex === fin ? { tag, apertura: m[0], inicio, fin } : null;
    } else if (!/\/>$/.test(t[0])) prof++;
  }
  return null;
}

type Decl = { prop: string; valor: string; importante: boolean };

/** Las declaraciones de un bloque de estilo (`a:b; c:d !important`), en orden. */
function declaraciones(cuerpo: string): Decl[] {
  const out: Decl[] = [];
  for (const m of cuerpo.matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/gi)) {
    const v = m[2].trim();
    const importante = /!\s*important\s*$/i.test(v);
    out.push({ prop: m[1].toLowerCase(), valor: v.replace(/\s*!\s*important\s*$/i, '').trim(), importante });
  }
  return out;
}

/**
 * Las reglas de la hoja del diseño que tocan a la raíz con un selector SIMPLE (`#beta`, `.mkv-sec-gris`, `section.x`,
 * con o sin `.gm-libre ` adelante), en orden. Sin @media ni @keyframes: lo que vale en cualquier pantalla.
 */
function reglasDeRaiz(css: string, raiz: Raiz): Decl[] {
  const id = atributoDe(raiz.apertura, 'id');
  const clases = (atributoDe(raiz.apertura, 'class') ?? '').split(/\s+/).filter(Boolean);
  const casa = (sel: string) => {
    const m = /^([a-z][a-z0-9-]*)?((?:[.#][\w-]+)*)$/i.exec(sel.trim().replace(/^\.gm-libre\s+/, ''));
    if (!m || (!m[1] && !m[2])) return false;
    if (m[1] && m[1].toLowerCase() !== raiz.tag) return false;
    return (m[2].match(/[.#][\w-]+/g) ?? []).every((p) => (p[0] === '#' ? p.slice(1) === id : clases.includes(p.slice(1))));
  };
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@[a-z-]+[^{;]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, '');
  const out: Decl[] = [];
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].split(',').some(casa)) out.push(...declaraciones(m[2]));
  }
  return out;
}

/** Lo que gana entre la hoja y el `style` (la cascada: hoja < style < hoja !important < style !important). */
function ganador(hoja: Decl[], estilo: Decl[], props: RegExp): Decl | null {
  const ultimo = (ds: Decl[], imp: boolean) => ds.filter((d) => props.test(d.prop) && d.importante === imp).at(-1) ?? null;
  return ultimo(estilo, true) ?? ultimo(hoja, true) ?? ultimo(estilo, false) ?? ultimo(hoja, false);
}

/** Lo que gana para unas propiedades en la raíz, entre la hoja y su `style`. */
const deRaiz = (r: Raiz, css: string, props: RegExp): Decl | null =>
  ganador(reglasDeRaiz(css, r), declaraciones(atributoDe(r.apertura, 'style') ?? ''), props);

/** El fondo propio de la raíz (un valor CSS), o null si es transparente. */
function fondoDeRaiz(r: Raiz, css: string): string | null {
  const d = deRaiz(r, css, /^background(-color|-image)?$/);
  return d && !/^(none|transparent|initial|unset|inherit)$/i.test(d.valor) ? d.valor : null;
}

/**
 * Los bordes de la raíz que, pintada, quedarían FLOTANDO: un borde de arriba (o de abajo) con un margen del mismo lado.
 * El margen queda adentro de lo pintado y la raya, que marcaba el comienzo de la sección, aparece 96 px más abajo (medido
 * en «historia» de la #32). Sin margen, la raya sigue en el borde de lo pintado y se queda.
 */
function bordesQueFlotan(r: Raiz, css: string): Array<'top' | 'bottom'> {
  return (['top', 'bottom'] as const).filter((lado) => {
    const m = deRaiz(r, css, new RegExp(`^margin(-${lado})?$`));
    const partes = m ? m.valor.split(/\s+/) : [];
    const margen = !m ? '' : m.prop !== 'margin' ? m.valor : lado === 'top' ? partes[0] : (partes[2] ?? partes[0]);
    if (!(Number.parseFloat(margen) > 0)) return false;
    const b = deRaiz(r, css, new RegExp(`^border(-${lado})?$`));
    return !!b && !/^(none|hidden|0|0px)\b/i.test(b.valor);
  });
}

/** ¿La raíz es pegajosa o fija (el encabezado)? Envuelta, dejaría de pegarse. */
function pegada(r: Raiz, css: string): boolean {
  const pos = deRaiz(r, css, /^position$/);
  return !!pos && /^(sticky|fixed)$/i.test(pos.valor);
}

/** El fondo que MaKo le puso a la sección (la marca de afuera), o null si tiene el del diseño. */
export function fondoPuestoDe(html: string): FondoDeDiseno | null {
  const r = raizUnica(html);
  const v = r ? atributoDe(r.apertura, MARCA) : null;
  return v ? fondoDeValor(v) : null;
}

/**
 * El fondo que SE VE en la sección (un valor CSS: `#F5F7FA`, `linear-gradient(…)`, `var(--noche)`), o null si no tiene
 * uno propio (se ve el de la página) o no se puede saber (varias cosas sueltas arriba). La hoja, por sus reglas simples.
 */
export function fondoVisibleDe(html: string, css = ''): string | null {
  const r = raizUnica(html);
  if (!r) return null;
  return atributoDe(r.apertura, MARCA) ?? fondoDeRaiz(r, css);
}

/**
 * La raíz con declaraciones `!important` AL FINAL de su `style` y sus marcas: `fondo` (con `data-gm-fondo`) y los bordes que
 * se hacen transparentes (con `data-gm-sin-borde`). Lo que traía queda escrito, y el `;` que separa es siempre uno nuevo
 * (aunque ya terminara en `;`): así sacarlo deja el `style` byte por byte.
 */
function conRaizMarcada(html: string, r: Raiz, fondo: string | null, bordes: ReadonlyArray<'top' | 'bottom'> = []): string {
  const decl = [
    ...(fondo !== null ? [`background:${fondo} !important`] : []),
    ...bordes.map((b) => `border-${b}-color:transparent !important`),
  ].join(';');
  const previo = atributoDe(r.apertura, 'style') ?? '';
  let ap = conAtributo(r.apertura, 'style', previo.trim() ? `${previo};${decl}` : decl);
  if (fondo !== null) ap = conAtributo(ap, MARCA, fondo);
  if (bordes.length) ap = conAtributo(ap, SIN_BORDE, bordes.join(' '));
  return html.slice(0, r.inicio) + ap + html.slice(r.inicio + r.apertura.length);
}

/** El `style` sin UNA declaración `!important` que puso MaKo (con el `;` que se le agregó adelante). */
const sinDecl = (estilo: string, prop: string, valor: string): string =>
  estilo.replace(new RegExp(`(^|;)\\s*${prop}\\s*:\\s*${escRegex(valor)}\\s*!\\s*important\\s*(?=;|$)`, 'i'), '');

/** El HTML sin el fondo que puso MaKo (la sección vuelve EXACTA a como la trajo el diseño). */
function sinFondoPuesto(html: string): string {
  const r = raizUnica(html);
  if (!r) return html;
  const v = atributoDe(r.apertura, MARCA);
  const bordes = atributoDe(r.apertura, SIN_BORDE);
  if (v === null && bordes === null) return html;
  if (v !== null && r.tag === 'div' && new RegExp(`\\s${ENVOLTURA}\\b`, 'i').test(r.apertura)) {
    // La envoltura se va, y la raíz de adentro vuelve a su fondo y sus bordes (si se los había hecho transparentes).
    return sinFondoPuesto(html.slice(r.inicio + r.apertura.length, html.lastIndexOf('</', r.fin)));
  }
  let estilo = atributoDe(r.apertura, 'style') ?? '';
  if (v !== null) estilo = sinDecl(estilo, 'background', v);
  for (const b of (bordes ?? '').split(/\s+/).filter(Boolean)) estilo = sinDecl(estilo, `border-${b}-color`, 'transparent');
  let ap = conAtributo(conAtributo(r.apertura, MARCA, null), SIN_BORDE, null);
  ap = conAtributo(ap, 'style', estilo.trim() ? estilo : null);
  return html.slice(0, r.inicio) + ap + html.slice(r.inicio + r.apertura.length);
}

/**
 * El HTML con el fondo de la sección cambiado (`null`: vuelve al del diseño). Siempre parte de la sección SIN lo que
 * haya puesto antes MaKo, así cambiar dos veces no apila nada. Un fondo inválido devuelve el HTML igual.
 */
export function conFondoDeDiseno(html: string, fondo: FondoDeDiseno | null, css = ''): string {
  const base = sinFondoPuesto(html);
  if (!fondo) return base;
  const v = valorDeFondo(fondo);
  if (!v) return html;
  const r = raizUnica(base);
  if (r && pegada(r, css)) return conRaizMarcada(base, r, v);
  const propio = r ? fondoDeRaiz(r, css) !== null : false;
  const bordes = r ? bordesQueFlotan(r, css) : [];
  const interior = r && (propio || bordes.length) ? conRaizMarcada(base, r, propio ? 'transparent' : null, bordes) : base;
  return `<div ${MARCA}="${esc(v)}" ${ENVOLTURA}="" style="background:${esc(v)};display:flow-root">${interior}</div>`;
}
