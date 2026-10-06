// =============================================================================
// La FOTO de la página para el mapa de calor, sacada de una grabación
// =============================================================================
// El mapa se dibuja ENCIMA de la página. De dónde sale la página:
//
//   · NO de un iframe con la página en vivo: el Pixel corre adentro, así que cada
//     vez que alguien abre el mapa se registra una visita y —con la grabación
//     prendida— se graba al que mira. Y de otro origen no se puede leer ni su alto
//     ni dónde está cada elemento.
//   · SÍ de la FOTO COMPLETA que guarda cada grabación (rrweb, el evento de tipo 2):
//     es el DOM que vio la gente, con los estilos adentro, sin un solo script. Se
//     reconstruye como HTML en un iframe propio, sin scripts, y ahí sí se puede
//     medir el alto y encontrar cada elemento por su selector.
//
// SIN `server-only`: la reconstrucción es lo que se puede equivocar y se testea.
// =============================================================================

/** Los tipos de nodo de una foto de rrweb (rrweb-snapshot, `NodeType`). */
const DOCUMENTO = 0;
const DOCTYPE = 1;
const ELEMENTO = 2;
const TEXTO = 3;
const CDATA = 4;
const COMENTARIO = 5;

export type NodoFoto = {
  type: number;
  id?: number;
  tagName?: string;
  attributes?: Record<string, string | number | boolean | null>;
  childNodes?: NodoFoto[];
  textContent?: string;
  isStyle?: boolean;
  isSVG?: boolean;
  name?: string;
};

export type FotoDePagina = { ancho: number; alto: number; nodo: NodoFoto };

/**
 * Saca de una grabación (JSON Lines) la foto de la página: el tamaño de la ventana
 * (evento de tipo 4) y el DOM completo (tipo 2), lo PRIMERO que se grabó.
 *
 * ⚠️ PUEDE NO HABER FOTO. Medido el 06/10/2026: 3 de 13 grabaciones selladas no la
 * tienen (se perdió el primer lote). Eso devuelve null y quien llama prueba con la
 * siguiente grabación — no se dibuja un mapa sobre nada.
 *
 * ⚠️ CADA LÍNEA ES UN LOTE, no un evento: el cuerpo sellado guarda un ARRAY de
 * eventos por renglón (lib/replay-ingesta.ts). La primera versión leía cada renglón
 * como un evento suelto, no encontraba nunca el tamaño de la ventana, y el mapa
 * decía «no hay una grabación de esta página» sobre diez grabaciones con foto. Se
 * aceptan las dos formas.
 */
export function fotoDeEventos(texto: string): FotoDePagina | null {
  type Ev = { type?: number; data?: { width?: number; height?: number; node?: NodoFoto } };
  let meta: { width: number; height: number } | null = null;
  for (const linea of texto.split('\n')) {
    const l = linea.trim();
    if (!l) continue;
    let crudo: unknown;
    try { crudo = JSON.parse(l); } catch { continue; }
    for (const ev of (Array.isArray(crudo) ? crudo : [crudo]) as Ev[]) {
      if (!ev || typeof ev !== 'object') continue;
      if (ev.type === 4 && typeof ev.data?.width === 'number' && typeof ev.data?.height === 'number') {
        meta = { width: ev.data.width, height: ev.data.height };
      } else if (ev.type === 2 && ev.data?.node && meta) {
        return { ancho: meta.width, alto: meta.height, nodo: ev.data.node };
      }
    }
  }
  return null;
}

/** Etiquetas sin cierre. */
const VACIAS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Lo que no se reconstruye nunca: código y lo que sólo existe sin código. */
const FUERA = new Set(['script', 'noscript']);

const escTexto = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * ⚠️ LAS UNIDADES DE VENTANA SE CONGELAN AL ALTO QUE TENÍA LA VENTANA. La foto se
 * dibuja en un iframe tan alto como la página entera, y adentro de ese iframe un
 * `100vh` vale TODA la página: una portada de `min-height: 100vh` se estira, el
 * documento crece, y el mapa queda sobre una página que nadie vio. Se reescriben a
 * píxeles con el alto real de la ventana de quien grabó.
 */
export function congelarVh(css: string, altoVentana: number): string {
  if (!(altoVentana > 0)) return css;
  return css.replace(/(-?\d*\.?\d+)(d|s|l)?vh\b/g, (_, n: string) => `${+((Number(n) * altoVentana) / 100).toFixed(2)}px`);
}

/**
 * Lo mismo sobre una HOJA entera, y sólo adentro de los bloques de declaraciones.
 *
 * ⚠️ `congelarVh` sobre la hoja cruda también reescribía los SELECTORES: una clase de
 * Tailwind con valor arbitrario (`.h-\[50vh\]`) pasaba a `.h-\[400px\]`, dejaba de
 * coincidir con el elemento, y su regla desaparecía de la foto sin un error (revisión
 * del 06/10/2026). Un selector o una condición de `@media` no son medidas: se tocan
 * sólo los bloques más internos, que son los que traen las declaraciones.
 */
export function congelarVhEnHoja(css: string, altoVentana: number): string {
  if (!(altoVentana > 0)) return css;
  return css.replace(/\{[^{}]*\}/g, (bloque) => congelarVh(bloque, altoVentana));
}

/**
 * La foto como un documento HTML, listo para un `srcdoc` SIN scripts.
 *
 * Lo que hace con cada cosa, y por qué:
 *   · `<script>` y `<noscript>` no se escriben (y el iframe además va sin
 *     `allow-scripts`: son dos candados, uno no alcanza si el otro se cae);
 *   · ningún atributo `on…` (un `onerror` en una imagen ES código);
 *   · un `<link>` cuya hoja quedó guardada adentro (`_cssText`) se escribe como
 *     `<style>`: la página no se vuelve a pedir a ningún lado;
 *   · un `<iframe>` (el reproductor del video, una agenda) queda VACÍO, del mismo
 *     tamaño: no se carga nada de un tercero;
 *   · lo que la grabación tapó a propósito (`rr_width`/`rr_height`) es una caja gris
 *     del mismo tamaño;
 *   · y las unidades de ventana se congelan (ver `congelarVh`).
 */
export function htmlDeFoto(foto: FotoDePagina): string {
  const vh = foto.alto;
  const partes: string[] = [];

  const atributos = (tag: string, attrs: NodoFoto['attributes']): { texto: string; css: string | null } => {
    let css: string | null = null;
    let texto = '';
    let tapado: { w: string; h: string } | null = null;
    for (const [nombreCrudo, valorCrudo] of Object.entries(attrs ?? {})) {
      const nombre = nombreCrudo.trim();
      if (!/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(nombre)) continue;
      if (/^on/i.test(nombre)) continue;
      if (nombre === '_cssText') { css = String(valorCrudo ?? ''); continue; }
      if (nombre === 'rr_width' || nombre === 'rr_height') {
        tapado = tapado ?? { w: '', h: '' };
        if (nombre === 'rr_width') tapado.w = String(valorCrudo); else tapado.h = String(valorCrudo);
        continue;
      }
      if (nombre.startsWith('rr_')) continue;
      if (tag === 'iframe' && (nombre === 'src' || nombre === 'srcdoc')) continue;
      if (valorCrudo === null || valorCrudo === false) continue;
      let valor = valorCrudo === true ? '' : String(valorCrudo);
      if (/^\s*javascript:/i.test(valor)) continue;
      if (nombre === 'style') valor = congelarVh(valor, vh);
      texto += valor === '' && valorCrudo === true ? ` ${nombre}` : ` ${nombre}="${escAttr(valor)}"`;
    }
    if (tapado) texto += ` style="display:block;width:${escAttr(tapado.w || '100%')};height:${escAttr(tapado.h || '0')};background:#e7e7e4"`;
    if (tag === 'iframe') texto += ' srcdoc=""';
    return { texto, css };
  };

  const escribir = (n: NodoFoto, enEstilo: boolean) => {
    switch (n.type) {
      case DOCUMENTO:
        for (const h of n.childNodes ?? []) escribir(h, false);
        return;
      case DOCTYPE:
        partes.push(`<!DOCTYPE ${n.name || 'html'}>`);
        return;
      case TEXTO: {
        const t = n.textContent ?? '';
        // El texto de un <style> es CSS: va sin escapar (escapar rompería los
        // selectores con > y los content: "…"), pero sin dejar que lo cierre.
        partes.push(enEstilo || n.isStyle ? congelarVhEnHoja(t, vh).replace(/<\/(style)/gi, '<\\/$1') : escTexto(t));
        return;
      }
      case CDATA:
        return;
      case COMENTARIO:
        return;
      case ELEMENTO: {
        const tag = String(n.tagName ?? '').toLowerCase().replace(/[^a-z0-9-:]/g, '');
        if (!tag || FUERA.has(tag)) return;
        const { texto, css } = atributos(tag, n.attributes);
        if (tag === 'link' && css != null) {
          partes.push(`<style>${congelarVhEnHoja(css, vh).replace(/<\/(style)/gi, '<\\/$1')}</style>`);
          return;
        }
        partes.push(`<${tag}${texto}>`);
        if (VACIAS.has(tag)) return;
        const esEstilo = tag === 'style';
        if (esEstilo && css != null && !(n.childNodes ?? []).length) {
          partes.push(congelarVhEnHoja(css, vh).replace(/<\/(style)/gi, '<\\/$1'));
        }
        for (const h of n.childNodes ?? []) escribir(h, esEstilo);
        partes.push(`</${tag}>`);
        return;
      }
      default:
        return;
    }
  };

  escribir(foto.nodo, false);
  // Sin scroll propio y sin márgenes que no tenía: el iframe va del tamaño de la
  // página, y una barra de scroll le comería ancho a la foto.
  partes.push('<style>html,body{overflow:hidden !important}</style>');
  return partes.join('');
}
