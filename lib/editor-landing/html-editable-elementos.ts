// =============================================================================
// html-editable-elementos — los botones, imágenes y videos de un «Diseño editable», para LEERLOS y CAMBIARLOS (25/10/2026)
// =============================================================================
// Martín (25/10): «quiero que TODO sea editable, cada botón, cada video, cada cosa que hay» y «Todo, todo siempre tiene que
// ir a la API». En el editor cada elemento se cambia con su control (diseno-elementos.ts); esto es lo mismo SIN DOM, sobre
// el HTML guardado, para la API (landing-contenido.helpers.ts): qué botones (texto y a dónde llevan), imágenes y videos
// tiene una sección de diseño, y el HTML con UNO de ellos cambiado.
//
// LA REGLA (la misma que html-editable-textos.ts): se toca SÓLO lo que se pide —un atributo de una etiqueta, o el texto de
// un botón— y el resto del HTML vuelve byte por byte. Los valores nuevos se escapan (`"`, `&`, `<`, `>`): un destino o una
// dirección nunca abren otra etiqueta ni otro atributo. El saneo del server (html-editable-seguro.ts) pasa igual después.
// ⚠️ PURO, sin DOM: lo prueba tests/html-editable-elementos.test.ts.
// =============================================================================

import { conTextos, decodificar, textosDeHtmlEditable } from './html-editable-textos';
import { ICONOS, existeIcono, svgIcono } from './iconos';

/** Un atributo entre comillas dobles o simples, o sin comillas: lo que puede traer una etiqueta. */
const ATTR = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const ENLACE = new RegExp(`<a\\b${ATTR}>([\\s\\S]*?)<\\/a\\s*>`, 'gi');
const IMAGEN = new RegExp(`<img\\b${ATTR}>`, 'gi');
const REPRODUCTOR = new RegExp(`<iframe\\b${ATTR}>`, 'gi');
const VIDEO = new RegExp(`<video\\b${ATTR}>([\\s\\S]*?)<\\/video\\s*>`, 'gi');
const FUENTE = new RegExp(`<source\\b${ATTR}>`, 'gi');
const ICONO = new RegExp(`<svg\\b${ATTR}>([\\s\\S]*?)<\\/svg\\s*>`, 'gi');
const TRAZO = new RegExp(`<path\\b${ATTR}>`, 'gi');

const escAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** El valor de un atributo de una etiqueta (decodificado), o null si no lo tiene. */
export function atributoDe(etiqueta: string, nombre: string): string | null {
  const m = new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>"']+))`, 'i').exec(etiqueta);
  if (!m) return null;
  return decodificar(m[1] ?? m[2] ?? m[3] ?? '');
}

/** La etiqueta de apertura con el atributo puesto (o sacado con `null`); el resto, igual. */
export function conAtributo(etiqueta: string, nombre: string, valor: string | null): string {
  const re = new RegExp(`\\s${nombre}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>"']+)`, 'i');
  if (valor === null) return etiqueta.replace(re, '');
  const nuevo = ` ${nombre}="${escAttr(valor)}"`;
  if (re.test(etiqueta)) return etiqueta.replace(re, () => nuevo);
  return etiqueta.replace(/\s*(\/?)>$/, (_m, barra: string) => `${nuevo}${barra ? ' /' : ''}>`);
}

/** La etiqueta de apertura de un elemento (respeta los `>` adentro de un atributo entre comillas). */
const APERTURA = new RegExp(`^<[a-z][a-z0-9]*\\b${ATTR}>`, 'i');
const apertura = (completo: string): string => APERTURA.exec(completo)?.[0] ?? completo;
/** Un elemento armado de nuevo: apertura + adentro + el cierre que traía (sin buscar el interior por su texto). */
const rearmar = (completo: string, interior: string, tag: string, adentro: string): string =>
  tag + adentro + completo.slice(apertura(completo).length + interior.length);

export type EnlaceDeDiseno = { tipo: 'enlace'; n: number; texto: string; destino: string | null; nuevaPestana: boolean };
export type ImagenDeDiseno = { tipo: 'imagen'; n: number; src: string; alt: string | null };
export type VideoDeDiseno = { tipo: 'video'; n: number; src: string; reproductor: boolean };
export type ElementoDeDiseno = EnlaceDeDiseno | ImagenDeDiseno | VideoDeDiseno;

const textoVisible = (html: string) => textosDeHtmlEditable(html).join(' ').replace(/\s+/g, ' ').trim();

/** Los botones y enlaces, las imágenes y los videos del diseño, en el orden del HTML (`n` empieza en 1, por tipo). */
export function elementosDeHtmlEditable(html: string): ElementoDeDiseno[] {
  const out: Array<ElementoDeDiseno & { pos: number }> = [];
  let n = 0;
  for (const m of html.matchAll(ENLACE)) {
    const tag = apertura(m[0]);
    out.push({ tipo: 'enlace', n: ++n, texto: textoVisible(m[1]), destino: atributoDe(tag, 'href'), nuevaPestana: atributoDe(tag, 'target') === '_blank', pos: m.index ?? 0 });
  }
  n = 0;
  for (const m of html.matchAll(IMAGEN)) out.push({ tipo: 'imagen', n: ++n, src: atributoDe(m[0], 'src') ?? '', alt: atributoDe(m[0], 'alt'), pos: m.index ?? 0 });
  const videos: Array<{ pos: number; src: string; reproductor: boolean }> = [];
  for (const m of html.matchAll(REPRODUCTOR)) videos.push({ pos: m.index ?? 0, src: atributoDe(m[0], 'src') ?? '', reproductor: true });
  for (const m of html.matchAll(VIDEO)) {
    const propio = atributoDe(apertura(m[0]), 'src');
    const fuente = propio ?? [...m[1].matchAll(FUENTE)].map((f) => atributoDe(f[0], 'src')).find(Boolean) ?? '';
    videos.push({ pos: m.index ?? 0, src: fuente, reproductor: false });
  }
  videos.sort((a, b) => a.pos - b.pos).forEach((v, i) => out.push({ tipo: 'video', n: i + 1, src: v.src, reproductor: v.reproductor, pos: v.pos }));
  return out.sort((a, b) => a.pos - b.pos).map(({ pos: _pos, ...e }) => e as ElementoDeDiseno);
}

type Falla = { error: string };

/** Reemplaza la coincidencia número `n` (desde 1) de `re` en `html` con lo que devuelva `cambio`. */
function enLaEnesima(html: string, re: RegExp, n: number, cambio: (completo: string, m: RegExpMatchArray) => string | Falla): string | Falla {
  let i = 0;
  let falla: Falla | null = null;
  const out = html.replace(new RegExp(re.source, re.flags), (...args) => {
    const completo = args[0] as string;
    i++;
    if (i !== n || falla) return completo;
    const m = [completo, ...args.slice(1, -2)] as unknown as RegExpMatchArray;
    const r = cambio(completo, m);
    if (typeof r !== 'string') { falla = r; return completo; }
    return r;
  });
  if (falla) return falla;
  return i >= n ? out : { error: 'Ese elemento ya no está en la sección.' };
}

/**
 * El HTML con el botón o enlace `n` cambiado: a dónde lleva (`destino`, null = sin destino), si abre en otra pestaña y
 * su texto. El texto sólo si el botón tiene UN texto: uno con título y bajada (las tarjetas de funcionalidades) se cambia
 * con cambiar_texto_landing, que sabe cuál de los dos.
 */
export function conEnlaceDeDiseno(html: string, n: number, cambio: { destino?: string | null; nuevaPestana?: boolean; texto?: string }): string | Falla {
  return enLaEnesima(html, ENLACE, n, (completo, m) => {
    let tag = apertura(completo);
    let adentro = m[1];
    if (cambio.destino !== undefined) tag = conAtributo(tag, 'href', cambio.destino);
    const nueva = cambio.nuevaPestana ?? (atributoDe(tag, 'target') === '_blank');
    if (cambio.nuevaPestana !== undefined || cambio.destino !== undefined) {
      tag = conAtributo(conAtributo(tag, 'target', nueva ? '_blank' : null), 'rel', nueva ? 'noopener noreferrer' : null);
    }
    if (cambio.texto !== undefined) {
      const piezas = textosDeHtmlEditable(adentro);
      if (piezas.length !== 1) return { error: `Ese botón tiene ${piezas.length} textos (por ejemplo, un título y una bajada): cada uno se cambia con cambiar_texto_landing.` };
      const nuevo = conTextos(adentro, [cambio.texto]);
      if (nuevo === null) return { error: 'No pude cambiar el texto de ese botón.' };
      adentro = nuevo;
    }
    return rearmar(completo, m[1], tag, adentro);
  });
}

/** El HTML con la imagen `n` mostrando `src` (sin `srcset`, que mostraría la vieja en otras pantallas). */
export function conImagenDeDiseno(html: string, n: number, src: string): string | Falla {
  return enLaEnesima(html, IMAGEN, n, (tag) => conAtributo(conAtributo(tag, 'srcset', null), 'src', src));
}

/**
 * El HTML con el video `n` en `src`. Un reproductor (`iframe`) recibe el de otro reproductor; un `<video>`, otro archivo
 * (sus `<source>` se van: ganarían sobre el `src` nuevo). Cambiar un reproductor por un archivo, o al revés, cambia la
 * forma de la sección: eso va por «Código».
 */
export function conVideoDeDiseno(html: string, n: number, src: string, esReproductor: boolean): string | Falla {
  const enOrden = elementosDeHtmlEditable(html).filter((e): e is VideoDeDiseno => e.tipo === 'video');
  const v = enOrden[n - 1];
  if (!v) return { error: 'Ese video ya no está en la sección.' };
  if (v.reproductor !== esReproductor) {
    return { error: v.reproductor
      ? 'Ese video es un reproductor (YouTube, Vimeo, Panda…): se cambia por el enlace de otro reproductor.'
      : 'Ese video es un archivo: se cambia por el enlace de otro archivo de video (.mp4, .webm).' };
  }
  const k = enOrden.filter((x) => x.reproductor === esReproductor).indexOf(v) + 1;
  if (esReproductor) return enLaEnesima(html, REPRODUCTOR, k, (tag) => conAtributo(tag, 'src', src));
  return enLaEnesima(html, VIDEO, k, (completo, m) => {
    const tag = conAtributo(apertura(completo), 'src', src);
    return rearmar(completo, m[1], tag, m[1].replace(FUENTE, ''));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Los íconos (25/10/2026): cada `<svg>` del diseño, como el control «Ícono» del editor (HtmlEditableVista, ponerIcono)
// ─────────────────────────────────────────────────────────────────────────────

/** Un ícono del diseño: su lugar (`n` desde 1), el nombre en la biblioteca si es uno de MaKo, su tamaño y el texto junto. */
export type IconoDeDiseno = { n: number; nombre: string | null; tam: number; junto: string };

let porTrazo: Map<string, string> | null = null;
/**
 * El nombre del ícono de la biblioteca (iconos.ts) que dibuja este `<svg>`, o null. Uno puesto por MaKo (el editor o la
 * API) es UN path con el `d` de la biblioteca; los que trajo el diseño (en la #32, de otra familia) no tienen nombre.
 */
function nombreDeIcono(interior: string): string | null {
  const trazos = [...interior.matchAll(TRAZO)];
  if (trazos.length !== 1) return null;
  porTrazo ??= new Map(Object.entries(ICONOS).map(([k, v]) => [v.d, k]));
  return porTrazo.get(atributoDe(trazos[0][0], 'd') ?? '') ?? null;
}

const tamDeIcono = (tag: string): number => {
  const v = Number.parseFloat(atributoDe(tag, 'width') ?? atributoDe(tag, 'height') ?? '');
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 24;
};

const corto = (t: string, max = 50): string => (t.length <= max ? t : `${t.slice(0, max).replace(/\s+\S*$/, '')}…`);

/** Lo que dice junto al ícono: el texto del botón que lo tiene, o el que le sigue (el título de una tarjeta, un renglón). */
function textoJunto(html: string, desde: number, hasta: number): string {
  for (const m of html.matchAll(ENLACE)) {
    const i = m.index ?? 0;
    if (i <= desde && i + m[0].length >= hasta) {
      const t = textoVisible(m[1]);
      if (t) return corto(t);
    }
  }
  // El PRIMER texto que sigue (el que sigue al siguiente ya es de otra tarjeta), o el último de antes. Un tramo cortado a
  // mitad de una etiqueta la leería como texto: se corta en el último `>`, o desde el primer `<`.
  const piezas = (tramo: string) => textosDeHtmlEditable(tramo).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const despues = html.slice(hasta, hasta + 1500);
  const sigue = piezas(despues.slice(0, despues.lastIndexOf('>') + 1));
  if (sigue.length) return corto(sigue[0].length < 12 && sigue[1] ? `${sigue[0]} ${sigue[1]}` : sigue[0]);
  const antes = html.slice(Math.max(0, desde - 1500), desde);
  const previo = piezas(antes.slice(Math.max(0, antes.indexOf('<')))).at(-1) ?? '';
  return previo.length <= 50 ? previo : `…${previo.slice(-50).replace(/^\S*\s+/, '')}`;
}

/** Los íconos del diseño, en el orden del HTML (el mismo en que el editor los encuentra). */
export function iconosDeHtmlEditable(html: string): IconoDeDiseno[] {
  return [...html.matchAll(ICONO)].map((m, i) => {
    const desde = m.index ?? 0;
    return { n: i + 1, nombre: nombreDeIcono(m[1]), tam: tamDeIcono(apertura(m[0])), junto: textoJunto(html, desde, desde + m[0].length) };
  });
}

/**
 * El HTML con el ícono `n` cambiado por `nombre` de la biblioteca: el `<svg>` de la casa, con el tamaño, la clase, el
 * `style` (ahí suele estar su color: `color:#2F6FED` con `currentColor`) y lo de accesibilidad del que estaba. Lo mismo
 * que hace el control «Ícono» del editor.
 */
export function conIconoDeDiseno(html: string, n: number, nombre: string): string | Falla {
  if (!existeIcono(nombre)) return { error: `No hay un ícono «${nombre}» en la biblioteca.` };
  return enLaEnesima(html, ICONO, n, (completo) => {
    const viejo = apertura(completo);
    const nuevo = svgIcono(nombre, tamDeIcono(viejo), atributoDe(viejo, 'class') ?? undefined);
    let tag = apertura(nuevo);
    for (const at of ['style', 'width', 'height', 'aria-hidden', 'aria-label', 'role']) {
      const v = atributoDe(viejo, at);
      if (v !== null) tag = conAtributo(tag, at, v);
    }
    return tag + nuevo.slice(apertura(nuevo).length);
  });
}
