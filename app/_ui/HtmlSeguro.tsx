// =============================================================================
// HtmlSeguro — dibuja un HTML que YA saneó el server, traduciendo sus adjuntos
// =============================================================================
// Contrato (docs/diseno-curso-skool.md, D4):
//   <HtmlSeguro html={htmlYaSaneado} urlDeAdjunto={(ref) => string} />
//
// Lo que NO hace, a propósito: SANEAR. El saneo vive en UN lugar, `sanearHtml`
// (lib/html-seguro.ts, server-only, lista blanca con sanitize-html), y corre en el server antes
// de guardar y antes de mandar. Copiar la lista blanca acá —para «sanear también en el
// navegador»— sería la segunda implementación de la misma regla, y la que se queda vieja es la
// que nadie mira (AGENTS.md, «una cosa, un lugar»). Además sanitize-html arrastra postcss y
// htmlparser2: no tiene por qué viajar al navegador de un alumno.
//
// Lo que SÍ hace:
//   1. Una ALARMA, no un saneo (`pareceSaneado`): si lo que llega tiene la forma de algo que la
//      lista blanca nunca deja pasar (un <script>, un `on…=`, un `javascript:` en un href), no
//      se dibuja y se avisa en la consola. Es la red por si alguien le pasa a este componente
//      un HTML que no salió de `sanearHtml` — no reemplaza a la lista blanca, la acusa.
//   2. TRADUCE las referencias `mako-adjunto:<uuid>` a la URL que le toca a quien mira: el
//      equipo con su sesión (URL firmada), el alumno con su token y el candado de la etapa
//      (/api/compartido/curso/adjunto). La referencia es lo que se GUARDA; la URL es de quien
//      MIRA, vence, y no puede vivir en la base.
//   3. Los estilos de lectura (`CSS_RICO`), que comparte el editor para que lo que se escribe se
//      vea igual que lo que se lee.
//
// ⚠️ SIN 'use client' Y SIN HOOKS, a propósito: lo monta el portal del alumno (cliente) y lo
//    puede montar una página del server pasándole una función (ahí `urlDeAdjunto` corre en el
//    server y nunca cruza la frontera). Y el formato de la referencia vive ACÁ y no en un módulo
//    del curso: es del editor y de quien dibuja, y la comunidad (D8) lo va a usar igual.

import type { CSSProperties, ReactNode } from 'react';

// ── La referencia a un adjunto ───────────────────────────────────────────────

/** Cómo se nombra un adjunto adentro del HTML guardado: `mako-adjunto:<uuid>`. */
export const PREFIJO_ADJUNTO = 'mako-adjunto:';

/**
 * Un uuid en minúsculas, exacto. ⚠️ ANCLADO y sin `i`: lo que no es exactamente esto no es una
 * referencia (y el saneo la tira). `randomUUID()` de node los da en minúsculas.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const RE_UUID = new RegExp(`^${UUID}$`);
const RE_REF = new RegExp(`^mako-adjunto:(${UUID})$`);

/** El id (uuid) de una referencia `mako-adjunto:<uuid>`, o `null` si no es exactamente eso. */
export function idDeRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const m = RE_REF.exec(ref);
  return m ? m[1] : null;
}

/** La referencia de un id. `null` si el id no es un uuid. */
export function refDeId(id: unknown): string | null {
  return typeof id === 'string' && RE_UUID.test(id) ? PREFIJO_ADJUNTO + id : null;
}

/**
 * Los ids de los adjuntos que NOMBRA un HTML ya saneado (en un `src` o un `href`), sin repetir y
 * en el orden en que aparecen. Es lo que hay que firmar para dibujarlo, y lo que una clase
 * PUBLICA (la ruta del alumno sirve sólo lo que la clase nombra).
 *
 * ⚠️ MIRA LOS ATRIBUTOS, NO EL TEXTO: «mako-adjunto:…» escrito en un párrafo (alguien que lo
 *    pegó como texto) no es una referencia. Sobre un HTML saneado el `<` del texto ya viene como
 *    `&lt;`, así que un atributo sólo puede estar adentro de una etiqueta de verdad.
 */
export function refsEnHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const out: string[] = [];
  const re = new RegExp(`<[a-z][a-z0-9]*\\s[^>]*?\\b(?:src|href)="mako-adjunto:(${UUID})"`, 'g');
  for (const m of html.matchAll(re)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

// ── La alarma ────────────────────────────────────────────────────────────────

/**
 * ¿Tiene la forma de algo que salió de `sanearHtml`? Mira sólo adentro de las ETIQUETAS (sobre un
 * HTML saneado, el `<` del texto viene escapado): un párrafo que diga «usa onclick= en tu botón»
 * no es un ataque y no puede dejar la descripción en blanco.
 *
 * ⚠️ ES UNA ALARMA Y NO UN FILTRO: una lista negra no protege (es justo lo que se reemplazó, el
 *    `sanitizeHtml` viejo de app/plan/board/RichText.tsx). Lo que protege es la lista blanca del
 *    server; esto sólo se niega a dibujar lo que de seguro NO pasó por ahí.
 */
export function pareceSaneado(html: string): boolean {
  if (/<\s*\/?\s*(script|style|iframe|frame|object|embed|svg|math|form|input|button|textarea|select|base|meta|link|template|noscript)\b/i.test(html)) return false;
  if (/<!--/.test(html)) return false;
  for (const m of html.matchAll(/<[a-z][^>]*>/gi)) {
    const tag = m[0];
    // El `on…=` se busca con los VALORES vaciados: un `title="ve online=sí"` es texto, no un
    // manejador, y no puede dejar la descripción en blanco.
    if (/\son[a-z]+\s*=/i.test(tag.replace(/"[^"]*"|'[^']*'/g, '""'))) return false;
    if (/\s(?:href|src|action|formaction|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data|file):/i.test(tag)) return false;
  }
  return true;
}

// ── La traducción ────────────────────────────────────────────────────────────

/**
 * ¿Esta URL se puede poner en un `src`/`href`? Absoluta http(s), relativa a la raíz de ESTE sitio
 * (`/api/...`, y no `//otro.sitio`), o un `blob:` (la vista local de una imagen recién subida).
 * Quien la arma es nuestro código, pero un `javascript:` acá dibujaría un link vivo adentro de la
 * descripción: se pregunta igual.
 */
export function urlDibujable(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false;
  if (/^\/(?![/\\])/.test(url)) return true;
  return /^(https?:\/\/|blob:)/i.test(url) && !/[\s"'<>]/.test(url);
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Cambia cada `mako-adjunto:<uuid>` de un `src`/`href` por la URL de quien mira.
 *
 *   · Una imagen cuya URL no se puede resolver SE SACA: un `<img>` sin destino es el ícono de
 *     imagen rota adentro de la clase, que se lee como que el curso está roto.
 *   · Un archivo (el chip) cuya URL no se puede resolver queda SIN `href`: el nombre se sigue
 *     leyendo, y no es un link que lleva a ningún lado.
 *
 * Trabaja sobre un HTML YA saneado: las etiquetas tienen la forma regular que emite el saneo
 * (atributos con comillas dobles, sin comentarios), y por eso alcanza con una expresión.
 */
export function traducirAdjuntos(html: string, urlDeAdjunto: (ref: string) => string | null | undefined): string {
  return html.replace(/<(img|a)\b([^>]*)>/gi, (todo, tag: string, attrs: string) => {
    const m = /\s(src|href)="(mako-adjunto:[^"]*)"/i.exec(attrs);
    if (!m) return todo;
    const ref = m[2];
    let url: string | null | undefined = null;
    if (idDeRef(ref)) {
      try { url = urlDeAdjunto(ref); } catch { url = null; }
    }
    if (!urlDibujable(url)) {
      if (tag.toLowerCase() === 'img') return '';
      return `<${tag}${attrs.replace(m[0], () => '')}>`;
    }
    // ⚠️ EL REEMPLAZO VA COMO FUNCIÓN, nunca como cadena: en una cadena de reemplazo, el signo de
    //    pesos seguido de `&`, de comilla simple o de otro signo de pesos es una SUSTITUCIÓN
    //    (AGENTS.md, «un reescritor de código fuente…»), y la URL la arma quien monta. Medido
    //    (revisión del 08/10/2026): una URL con «$&» metía el atributo viejo, entero, adentro del
    //    nuevo.
    const nuevo = ` ${m[1]}="${escAttr(url)}"`;
    return `<${tag}${attrs.replace(m[0], () => nuevo)}>`;
  });
}

// ── Los estilos de lectura ───────────────────────────────────────────────────

/**
 * Cómo se LEE un texto rico: tipografía, listas, citas, imágenes al 100% de ancho como máximo.
 * Lo usa también el editor (la misma clase `mk-rico` en el área de escritura), así que lo que se
 * escribe se ve como lo que se lee.
 *
 * ⚠️ CADA `var(--token)` LLEVA SU RESPALDO: esto se dibuja también en el portal del alumno, que no
 *    es la app, y un token que no existe ahí no falla — hereda nada (AGENTS.md, «tres topes»).
 * ⚠️ SIN COMILLAS INVERTIDAS NI SIGNO DE PESOS CON LLAVE adentro: es una cadena (AGENTS.md).
 * ⚠️ El texto de un resaltado va OSCURO con !important: el resaltado trae `color: inherit` en
 *    línea, y en un fondo oscuro eso deja letra clara sobre amarillo claro — ilegible.
 */
export const CSS_RICO = `
.mk-rico { font-size: var(--fs-md, 14px); line-height: 1.65; color: inherit; overflow-wrap: anywhere; word-break: normal; }
.mk-rico > :first-child { margin-top: 0; }
.mk-rico > :last-child { margin-bottom: 0; }
.mk-rico p { margin: 0 0 .75em; min-height: 1em; }
.mk-rico h2 { font-size: 1.32em; line-height: 1.3; font-weight: 700; margin: 1.15em 0 .45em; letter-spacing: -.01em; }
.mk-rico h3 { font-size: 1.1em; line-height: 1.35; font-weight: 700; margin: 1em 0 .4em; }
.mk-rico ul, .mk-rico ol { margin: 0 0 .75em; padding-left: 1.45em; }
.mk-rico ul { list-style: disc; }
.mk-rico ol { list-style: decimal; }
.mk-rico li { margin: .2em 0; }
.mk-rico li > p { margin: 0; }
.mk-rico li > ul, .mk-rico li > ol { margin: .2em 0 .2em; }
.mk-rico blockquote { margin: 0 0 .75em; padding: .15em 0 .15em .95em; border-left: 3px solid var(--border-strong, #DCE0E7); color: var(--dim, #454C57); }
.mk-rico blockquote > :last-child { margin-bottom: 0; }
.mk-rico code { font-family: 'Geist Mono', ui-monospace, monospace; font-size: .9em; background: var(--surface-2, #F5F7FA); border: 1px solid var(--border, #EAECF1); border-radius: 5px; padding: .05em .35em; }
.mk-rico pre { margin: 0 0 .75em; padding: .8em 1em; background: var(--surface-2, #F5F7FA); border: 1px solid var(--border, #EAECF1); border-radius: 8px; overflow-x: auto; white-space: pre; }
.mk-rico pre code { background: none; border: 0; padding: 0; font-size: .88em; }
.mk-rico hr { border: 0; border-top: 1px solid var(--border-strong, #DCE0E7); margin: 1.2em 0; }
.mk-rico a { color: var(--primary, #2F6FED); text-decoration: underline; text-underline-offset: 2px; }
.mk-rico img { display: block; max-width: 100%; height: auto; border-radius: 8px; margin: .4em 0 .9em; }
.mk-rico mark { color: #12151B !important; border-radius: 3px; padding: 0 .1em; }
.mk-rico s { opacity: .8; }
.mk-rico .mk-adjunto { display: inline-flex; align-items: center; gap: .4em; max-width: 100%; padding: .2em .7em .2em .55em; margin: .1em 0; border: 1px solid var(--border-strong, #DCE0E7); border-radius: 999px; background: var(--surface, #FFFFFF); color: inherit; text-decoration: none; font-size: .92em; line-height: 1.4; vertical-align: baseline; }
.mk-rico a.mk-adjunto:hover { border-color: var(--primary, #2F6FED); }
.mk-rico .mk-adjunto::before { content: ''; flex: none; width: 1em; height: 1em; background: currentColor; opacity: .7; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5'/%3E%3C/svg%3E") center / contain no-repeat; }
.mk-rico ul[data-type="taskList"] { list-style: none; padding-left: .1em; }
.mk-rico ul[data-type="taskList"] > li { display: flex; align-items: flex-start; gap: .55em; }
.mk-rico ul[data-type="taskList"] > li::before { content: ''; flex: none; box-sizing: border-box; width: 1.05em; height: 1.05em; margin-top: .3em; border: 1.5px solid var(--border-strong, #C9CED8); border-radius: 4px; background: var(--surface, #FFFFFF); }
.mk-rico ul[data-type="taskList"] > li[data-checked="true"]::before { border-color: var(--good, #1E9E57); background: var(--good, #1E9E57) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") center / 78% no-repeat; }
.mk-rico ul[data-type="taskList"] > li[data-checked="true"] > * { color: var(--faint, #66707F); text-decoration: line-through; }
.mk-rico ul[data-type="taskList"] > li > * { flex: 1; min-width: 0; }
`;

/**
 * Dibuja el HTML. `vacio` es lo que se muestra si no hay nada (por default, nada).
 *
 * ⚠️ `html` TIENE QUE HABER PASADO POR `sanearHtml` EN EL SERVER. Lo que viene de la base ya pasó
 *    al guardarse; quien lo manda al navegador lo vuelve a pasar (es idempotente y barato) para
 *    cubrir las filas escritas por otro camino.
 */
export function HtmlSeguro({ html, urlDeAdjunto, className, style, vacio = null }: {
  html: string | null | undefined;
  urlDeAdjunto: (ref: string) => string | null | undefined;
  className?: string;
  style?: CSSProperties;
  vacio?: ReactNode;
}) {
  const crudo = typeof html === 'string' ? html.trim() : '';
  if (!crudo) return <>{vacio}</>;
  if (!pareceSaneado(crudo)) {
    console.error('[HtmlSeguro] me llegó un HTML que no pasó por sanearHtml: no lo dibujo.');
    return <>{vacio}</>;
  }
  const listo = traducirAdjuntos(crudo, urlDeAdjunto);
  return (
    <>
      {/* React 19 sube este <style> al <head> UNA vez aunque haya veinte descripciones en la
          pantalla (lo deduplica por `href`). */}
      <style href="mk-rico" precedence="medium">{CSS_RICO}</style>
      <div
        className={className ? `mk-rico ${className}` : 'mk-rico'}
        style={style}
        dangerouslySetInnerHTML={{ __html: listo }}
      />
    </>
  );
}

export default HtmlSeguro;
