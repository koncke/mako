// =============================================================================
// editor-landing/lector-pagina — la VENTANA de lectura: la página de afuera servida por MaKo (tanda 6, b)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto de
// esa página.". Soluciona eso...», con su decisión: «si detecta que tenes el pixel instalado, que lo haga
// desde allí y sino desde la ventana emergente». La ventana que abre la pantalla (lector-navegador.ts)
// navega a la MISMA ruta que el Diagnóstico usa para su iframe (`RUTA_PAGINA_DIAGNOSTICO`) con
// `?lector=<id>`, y esa ruta decide con UNA sola bajada de la página:
//   · la página trae el Pixel con lector (la línea de `/m.js`, o el código pegado desde la v24) → la
//     ventana se REDIRIGE a la página real con `?mako_leer=<id>` y el Pixel carga el lector;
//   · si no → la página se sirve AISLADA (la política `sandbox` del Diagnóstico: origen opaco, no ve la
//     sesión de MaKo), con el preludio y el lector adelante (`documentoLector`).
// Todo lo que decide es puro y vive acá (con test); la ruta sólo enchufa la bajada.
//
// ⚠️ LAS APPS DE VITE NO CORREN ASÍ COMO VIENEN. Medido el 14/10/2026 con la landing real del caso (sólo
//    lectura por HTTP): su HTML trae `<script type="module" crossorigin src="/assets/index-….js">` y
//    `<link rel="stylesheet" crossorigin …>`, y sus assets NO mandan `Access-Control-Allow-Origin`. Un
//    módulo se pide SIEMPRE con CORS, así que desde la ventana (origen opaco, `Origin: null`) el script
//    no carga y la página queda en blanco (medido en Chromium: `error` en el módulo, `load` en el blob).
//    Por eso: la hoja de estilos y los scripts clásicos van SIN `crossorigin` (sin él no hace falta
//    CORS), y el módulo de entrada, si es UNO SOLO sin imports (el caso: 326 KB, ni un `import`), lo
//    baja el server y va en línea como un blob (`modulosDelDocumento` + `esModuloSuelto`). Una app
//    partida en varios módulos sigue sin correr acá: para esa está el camino del Pixel o «Pega el texto».
// =============================================================================

import { CABECERAS_PAGINA_DIAGNOSTICO, sinPixelDeMako } from './diagnostico';
import { baseDeDocumento, sinRastreadores, urlParaReplicar } from './replicar-reglas';
import { versionEnHtml } from '../pixel-aviso';
import {
  PARAM_CAMINO, PARAM_LECTOR, TIPO_MENSAJE_LECTURA, TOPES_LECTOR, VERSION_PIXEL_LECTOR,
  caminoPedidoValido, idLecturaValido, urlConLectura, type CaminoPedido,
} from './lector';
import { literalJs, origenValido, scriptLector, scriptPreludio } from './lector-script';

export { PARAM_CAMINO, PARAM_LECTOR };

/** Cuántos módulos se bajan para ir en línea, y cuánto pesan como mucho entre todos. */
export const TOPES_MODULOS = { cantidad: 3, bytes: 6_000_000 } as const;

/**
 * ¿La navegación que llega es la ventana de lectura que abrió MaKo? Una navegación de nivel superior
 * (`document` + `navigate`) iniciada desde una página de MaKo (`same-origin`). Un link desde un mail o
 * desde otra página llega `cross-site` o `none`: así nadie puede mandarle a un admin un link que le
 * muestre una página cualquiera bajo el dominio de MaKo (aislada, pero con nuestra dirección arriba).
 */
export function pedidoDeLector(req: Request): boolean {
  const h = (k: string) => (req.headers.get(k) ?? '').toLowerCase();
  return h('sec-fetch-dest') === 'document' && h('sec-fetch-mode') === 'navigate' && h('sec-fetch-site') === 'same-origin';
}

/**
 * ¿La página trae un Pixel que sabe cargar el lector? La línea del cargador sirve siempre la versión de
 * hoy (`actual`); el código pegado, desde `VERSION_PIXEL_LECTOR`. Si hay dos copias manda la más vieja
 * (`versionEnHtml`): la que corre primero se queda con la página y la otra no hace nada.
 */
export function tienePixelConLector(html: string | null | undefined, actual: number): boolean {
  return (versionEnHtml(html, actual) ?? 0) >= VERSION_PIXEL_LECTOR;
}

// ─────────────────────────────────────────────────────────────────────────────
// Los módulos de una app
// ─────────────────────────────────────────────────────────────────────────────

const RE_SCRIPT_MODULO = /<script\b(?=[^>]*\btype\s*=\s*["']?module\b)[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>\s*<\/script\s*>/gi;

/** Las direcciones (absolutas) de los `<script type="module" src>` de un HTML, hasta el tope. */
export function modulosDelDocumento(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of String(html ?? '').matchAll(RE_SCRIPT_MODULO)) {
    try {
      const u = new URL((m[1] ?? m[2] ?? m[3] ?? '').replace(/&amp;/g, '&'), base);
      if ((u.protocol === 'https:' || u.protocol === 'http:') && !out.includes(u.toString())) out.push(u.toString());
    } catch { /* el siguiente */ }
    if (out.length >= TOPES_MODULOS.cantidad) break;
  }
  return out;
}

/**
 * ¿El módulo corre solo, sin traer otros? Sin `import … from`, sin `import "…"`, sin `export … from` y
 * sin `import(` (un blob no tiene dónde resolver un camino relativo). Ante la duda, no: un módulo que no
 * va en línea queda como estaba.
 */
export function esModuloSuelto(codigo: string): boolean {
  const c = String(codigo ?? '');
  if (!c.trim()) return false;
  if (/\bimport\s*\(/.test(c)) return false;
  if (/(?:^|[;}\n\r])\s*import\s*(?:[\w$*{]|["'])/.test(c)) return false;
  if (/(?:^|[;}\n\r])\s*export\s*(?:\*|\{[^}]*\})\s*from\b/.test(c)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// El documento
// ─────────────────────────────────────────────────────────────────────────────

const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** El camino de la landing (lo que ve su router): `/ruta?query#hash`. */
function caminoDe(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname || '/'}${u.search}${u.hash}`;
  } catch {
    return '/';
  }
}

/** Saca `crossorigin` (e `integrity`, que sin CORS no se puede comprobar) de los `<link>` y de los scripts clásicos. */
function sinCrossorigin(html: string): string {
  return html.replace(/<(link|script)\b[^>]*>/gi, (tag, nombre: string) => {
    if (nombre.toLowerCase() === 'script' && /\btype\s*=\s*["']?module\b/i.test(tag)) return tag;
    if (nombre.toLowerCase() === 'link' && /\brel\s*=\s*["']?modulepreload\b/i.test(tag)) return '';
    return tag.replace(/\s+(?:crossorigin|integrity)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
  });
}

/** Un módulo en línea: el código como blob, cargado como módulo (el código no toca el HTML: va como literal). */
const cargadorDeModulo = (codigo: string): string =>
  `<script>(function(){try{var u=URL.createObjectURL(new Blob([${literalJs(codigo)}],{type:'text/javascript'}));`
  + `var s=document.createElement('script');s.type='module';s.src=u;document.head.appendChild(s);}catch(e){}})();</script>`;

/**
 * El documento de la ventana sin Pixel: el HTML de afuera limpio (sin rastreadores ni el Pixel de MaKo:
 * leerla no es una visita), con TODO lo nuestro ADELANTE de lo de la página (el preludio tiene que correr
 * primero: ver `JS_PRELUDIO_VENTANA`), sin `crossorigin` donde no hace falta, y con los módulos que se
 * bajaron (`modulos`: dirección absoluta → código) en línea.
 */
export function documentoLector(
  html: string,
  urlPedida: string,
  id: string,
  origenMako: string,
  modulos: ReadonlyMap<string, string> = new Map(),
): string | null {
  const lector = scriptLector(id, 'ventana', origenMako);
  if (!lector) return null;
  const crudo = String(html ?? '');
  const base = baseDeDocumento(crudo, urlPedida);
  let doc = sinPixelDeMako(sinRastreadores(crudo))
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?(?:content-security-policy|refresh|x-frame-options)["']?[^>]*>/gi, '');
  doc = sinCrossorigin(doc);
  if (modulos.size) {
    doc = doc.replace(RE_SCRIPT_MODULO, (tag, a?: string, b?: string, c?: string) => {
      try {
        const u = new URL(String(a ?? b ?? c ?? '').replace(/&amp;/g, '&'), base).toString();
        const codigo = modulos.get(u);
        return codigo != null ? cargadorDeModulo(codigo) : tag;
      } catch {
        return tag;
      }
    });
  }
  // Con funciones y no con un string de reemplazo: un `$&` en el HTML no se expande.
  const cabeza = `<meta charset="utf-8"><script>${scriptPreludio(caminoDe(urlPedida))}</script>`
    + `<base href="${escAttr(base)}"><meta name="referrer" content="no-referrer"><script>${lector}</script>`;
  // ADELANTE de todo, no después del <head> de la página: un script suelto antes de su <head> correría
  // antes que la guarda. El `<html>` y el `<head>` de la página que vienen después el navegador los funde.
  return `<!doctype html><html><head>${cabeza}${doc}`;
}

/** El documento cuando la página no se pudo bajar: se lo dice a MaKo (que cierra la ventana) y lo muestra. */
export function documentoErrorLector(mensaje: string, id: string, origenMako: string): string {
  const m = String(mensaje || 'No pude abrir la página.').slice(0, TOPES_LECTOR.error);
  const origen = origenValido(origenMako);
  const aviso = idLecturaValido(id) && origen
    ? `<script>try{opener.postMessage({tipo:${literalJs(TIPO_MENSAJE_LECTURA)},id:${literalJs(id)},fase:'error',error:${literalJs(m)}},${literalJs(origen)})}catch(e){}</script>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8">${aviso}</head>`
    + `<body style="margin:0;padding:24px;font:14px/1.5 system-ui,sans-serif;color:#6b6b72">${escAttr(m)}</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// La respuesta
// ─────────────────────────────────────────────────────────────────────────────

export type PedidoLector = { url: string | null; id: string | null; camino: string | null };

export type DepLector = {
  /** El HTML de la página, con las barandas de siempre (`htmlDePagina`). Tira si no se pudo. */
  bajar: (url: string) => Promise<string>;
  /** Un módulo de la página (lector-server.ts): su código y si su server ya manda CORS. Tira si no se pudo. */
  bajarModulo: (url: string) => Promise<{ codigo: string; cors: boolean }>;
  /** `SNIPPET_VERSION` (lib/landing-token.ts es server-only: lo pasa la ruta). */
  actual: number;
  /** El origen de MaKo que contesta (el `targetOrigin` del lector). */
  origen: string;
};

const texto = (status: number, t: string): Response =>
  new Response(t, { status, headers: { ...CABECERAS_PAGINA_DIAGNOSTICO, 'Content-Type': 'text/plain; charset=utf-8' } });

const html = (cuerpo: string): Response => new Response(cuerpo, { status: 200, headers: { ...CABECERAS_PAGINA_DIAGNOSTICO } });

/** A la página real con el parámetro de lectura: el Pixel hace el resto. Sin referrer y sin caché. */
function aLaPaginaReal(url: string, id: string): Response {
  const destino = urlConLectura(url, id);
  if (!destino) return texto(404, 'No existe');
  return new Response(null, { status: 303, headers: { Location: destino, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

/**
 * Lo que contesta GET `RUTA_PAGINA_DIAGNOSTICO?url=…&lector=<id>[&camino=pixel|ventana]` (después de la
 * puerta de la ruta: admin + la tab en su capa):
 *   · no es la ventana que abrió MaKo (`pedidoDeLector`) → 403 sin bajar nada;
 *   · id, URL o camino sin forma → 404;
 *   · `camino=pixel` → 303 a la página real (sin bajarla: la pantalla ya sabe que tiene el Pixel);
 *   · no se pudo bajar → 200 con el documento de error (le avisa a MaKo);
 *   · la página trae el Pixel con lector y no se pidió `ventana` → 303 a la página real;
 *   · si no → 200 con la página aislada y el lector (`documentoLector`).
 */
export async function responderPaginaLector(req: Request, p: PedidoLector, dep: DepLector): Promise<Response> {
  if (!pedidoDeLector(req)) return texto(403, 'Sólo desde MaKo');
  const id = p.id ?? '';
  const url = urlParaReplicar(p.url);
  const camino: CaminoPedido | null = p.camino == null || p.camino === '' ? 'auto' : caminoPedidoValido(p.camino) ? p.camino : null;
  const origen = origenValido(dep.origen);
  if (!idLecturaValido(id) || !url || !camino || !origen) return texto(404, 'No existe');
  if (camino === 'pixel') return aLaPaginaReal(url, id);
  let crudo: string;
  try {
    crudo = await dep.bajar(url);
  } catch (err) {
    return html(documentoErrorLector(err instanceof Error ? err.message : String(err), id, origen));
  }
  if (camino === 'auto' && tienePixelConLector(crudo, dep.actual)) return aLaPaginaReal(url, id);
  const modulos = new Map<string, string>();
  let bytes = 0;
  for (const m of modulosDelDocumento(crudo, baseDeDocumento(crudo, url))) {
    try {
      const r = await dep.bajarModulo(m);
      // Si su server ya manda CORS, el módulo carga solo y se deja como está.
      if (r.cors || !esModuloSuelto(r.codigo) || bytes + r.codigo.length > TOPES_MODULOS.bytes) continue;
      bytes += r.codigo.length;
      modulos.set(m, r.codigo);
    } catch { /* sin ese módulo: la página queda como venía */ }
  }
  const doc = documentoLector(crudo, url, id, origen, modulos);
  return doc ? html(doc) : texto(404, 'No existe');
}
