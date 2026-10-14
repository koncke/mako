// =============================================================================
// editor-landing/pagina-publica — el DOCUMENTO HTML entero de una landing publicada
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md, D4.
//
// Lo usan las tres rutas públicas, que son route handlers y NO páginas: devuelven el
// HTML completo sin pasar por el layout raíz (sin sidebar, sin pollers, sin Suspense):
//
//   /l/<slug>            app/l/[slug]/route.ts           la página de inicio publicada
//   /l/<slug>/<ruta>     app/l/[slug]/[ruta]/route.ts    otra página del sitio
//   /l/vista/<token>     app/l/vista/[token]/route.ts    el BORRADOR, por el link privado
//
// Las tres leen la foto con `leerPublicado` / `leerVistaPrevia` (lib/editor-landing/
// publicar.ts) y le pasan el resto a `responderPublico`, que vive acá para que se pueda
// testear sin base: la ruta sólo enchufa la lectura.
//
// El cuerpo (`html`) ya viene armado por el renderizador (render.ts, «la única fábrica de
// HTML público») con el tema inline en `.gm-doc`. Esta hoja le pone alrededor lo que es
// del DOCUMENTO y no del contenido: <head> con SEO, Open Graph, favicon y fuentes, la hoja
// del contenido, el Pixel de MaKo, el Píxel de Meta y un script chico propio.
//
// SIN `server-only` a propósito (regla de la casa: lo que decide algo va donde un test lo
// pueda importar). Lo que necesita la base —el token del Pixel— entra por import DINÁMICO
// en `tokenDelPixel`, que los tests reemplazan. ⚠️ Pero NO es apto para el navegador:
// usa `node:crypto` para los hashes de la política de contenido.
//
// ── LAS DECISIONES QUE NO SE VEN EN EL CÓDIGO ───────────────────────────────────────────
//
// 1. LA POLÍTICA DE CONTENIDO VA EN UN <meta>, NO EN EL HEADER. Medido en Next 16
//    (node_modules/next/dist/server/send-response.js): next.config.ts ya pone un
//    `Content-Security-Policy` a TODA la app (frame-ancestors, object-src, base-uri), y
//    cuando una ruta devuelve un header que ya está puesto, Next NO lo agrega — «only
//    append the header if it is either not present in the outbound response». O sea que un
//    CSP puesto acá en el Response se perdía EN SILENCIO y la página quedaba sin script-src.
//    Dos políticas (la del header global y la del <meta>) se aplican LAS DOS, y lo que se
//    ejecuta es la intersección: el header sigue cortando el iframe ajeno y el <meta> pone
//    las listas. El <meta> va segundo en el <head>, antes de cualquier script, hoja o link:
//    lo de antes no lo gobierna.
//
// 2. `script-src` SIN 'unsafe-inline': los dos scripts inline propios (el de la página y el
//    del Píxel de Meta) entran por su HASH, calculado acá. Es la segunda capa contra un
//    escape que se le escape al renderizador: una página publicada vivía en hola-mako.com, el
//    mismo origen que la sesión de MaKo, y un script inyectado podría llamar /api/* como el
//    que mira (D4: «nada de JavaScript de terceros en hola-mako.com»). Desde la tanda 4 vive en
//    hola-mako.site (sin la cookie de MaKo), y la política se queda igual: en local y en los
//    previews sigue sirviéndose bajo el host de la app.
//    ⚠️ Y EL COSTO, que hay que decir: un <iframe srcdoc> HEREDA la política del padre, así
//    que el bloque «HTML personalizado» (render.ts lo pone en un iframe sandbox con srcdoc)
//    NO ejecuta sus scripts en la página publicada. Arreglarlo no es aflojar esta política:
//    es servir ese HTML desde una URL propia con su propio header — hecho en la tanda 2 (T6):
//    app/l/html/[docId]/[bloque], `frame-src 'self'` y el oyente del alto en SCRIPT_PAGINA.
//
// 3. `style-src` CON 'unsafe-inline' y SIN hashes: el tema viaja en atributos `style`
//    (`.gm-doc`, `--gm-cols`), y con un hash en la lista el navegador ignora el
//    'unsafe-inline'. Un estilo inyectado no ejecuta nada.
//
// 4. `form-action 'none'`: el script propio cancela el envío y el opt-in lo manda el Pixel
//    por fetch. Si el script no corriera, el navegador mandaría el formulario solo — y si el
//    <form> no dijera `method="post"`, con los datos de la persona en la URL. Con esto,
//    simplemente no sale.
//
// 5. CACHÉ: `public, no-cache` + ETag. «no-cache» no es «no guardar»: el navegador guarda y
//    PREGUNTA cada vez, y con el ETag igual contesta 304 sin cuerpo. Así una versión recién
//    publicada se ve en la visita siguiente —no minutos después—, que es lo que se pidió. El
//    ETag es el hash del documento ENTERO y no la fecha de publicación: un deploy que cambia
//    la hoja o el script cambia el documento sin republicar, y con la fecha el navegador se
//    quedaría con la hoja vieja adentro. El costo es una lectura de la base por visita
//    (indexada por slug); no se cachea en el CDN a propósito.
//
// 6. EL TOKEN DEL PIXEL SE LEE ESTRICTO, y recién si no existe se acuña. `getOrCreateLandingToken`
//    lee con `getSetting`, que convierte un error de la base en null, y con null ACUÑA y
//    GUARDA: en un pedido de /integraciones eso pasa una vez; en una página pública pasaría
//    en cada visita que coincida con un pestañeo de la base, pisando el token guardado con el
//    determinista. Acá se lee con `getSettingEstricto` (tira si la base falla → 503) y sólo
//    con «no hay nada guardado» de verdad se llama a `getOrCreateLandingToken`.
// =============================================================================

import { createHash } from 'node:crypto';
import { CONFIG_DEFAULT, type ConfigLanding } from './api-tipos';
import { CSS_CONTENIDO } from './css';
import { PREFIJO_PUBLICO, rutaValida, slugValido, urlPublica } from './doc';
import { origenImagenes } from './especificacion';
import { baseLandingsPara, urlLandingEn, urlVistaEn } from './origen-landings';
import { APP_BASE_URL, baseLandings } from '../app-url';
import { FORMA_TOKEN, lineaCargador } from '../pixel-cargador';
import { DOMINIOS_IFRAME, HOSTS_IFRAME } from '../embeds';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type ModoDocumento = 'publico' | 'vista';

/**
 * Lo que devuelven `leerPublicado(slug, ruta)` y `leerVistaPrevia(token)`
 * (lib/editor-landing/publicar.ts, paquete D: su `SitioPublico`). Se escribe ESTRUCTURAL y
 * con sólo lo que esta hoja usa, en vez de importar el tipo de publicar.ts: si D suma
 * campos, pasan igual; si le cambia uno de estos, no compila la ruta.
 *
 *   · `pagina.titulo` / `pagina.descripcion`: el SEO de ESA página, ya resuelto por D
 *     (`metaDePagina`: el de la página, o el del sitio, o el título de la landing).
 *   · `foto.sitio`: la configuración del sitio CONGELADA al publicar. Lo publicado sigue con
 *     el favicon, el Píxel de Meta y la indexación de ese día hasta que se vuelva a publicar.
 *   · `foto.css`: la hoja congelada con el HTML que la usa (un HTML de ayer con la hoja de
 *     mañana puede no calzar). Si viniera vacía, va la de hoy.
 *   · `foto.animaciones`: `config.pagina.animaciones` congelado. Si una foto vieja no lo
 *     trae, van prendidas, que es el default (CONFIG_DEFAULT).
 */
export type LecturaPublica = {
  workspaceId: number;
  /** El título de la landing: el último respaldo del <title>. */
  titulo?: string | null;
  foto: {
    css?: string | null;
    fuentes?: string | readonly string[] | null;
    sitio: ConfigLanding['sitio'];
    temaId?: string | null;
    animaciones?: boolean | null;
  };
  pagina: { html: string; titulo?: string | null; descripcion?: string | null };
};

export type EntradaDocumento = {
  html: string;
  config: ConfigLanding;
  /** La hoja del contenido congelada en la foto. Vacía o ausente: CSS_CONTENIDO de hoy. */
  css?: string | null;
  fuentes?: string | readonly string[] | null;
  workspaceId: number;
  modo: ModoDocumento;
  /** La URL pública de ESTA página (canonical y og:url). */
  urlCanonica: string;
  /** El <title> de esta página, ya resuelto. */
  titulo?: string | null;
  descripcion?: string | null;
  /** Si `titulo` y el SEO del sitio vienen vacíos: el título de la landing. */
  tituloRespaldo?: string | null;
  /** `lang` del <html>. Default 'es'. */
  idioma?: string | null;
};

/**
 * La configuración que el documento necesita, armada con lo congelado en la foto. Lo que la
 * foto no trae cae al default (CONFIG_DEFAULT): nunca a la configuración VIVA de la fila, que
 * puede tener cambios sin publicar.
 */
export function configDeLectura(l: LecturaPublica): ConfigLanding {
  return {
    ...CONFIG_DEFAULT,
    tema: typeof l.foto.temaId === 'string' && l.foto.temaId ? l.foto.temaId : CONFIG_DEFAULT.tema,
    sitio: { ...CONFIG_DEFAULT.sitio, ...(l.foto.sitio ?? {}) },
    pagina: { ...CONFIG_DEFAULT.pagina, animaciones: l.foto.animaciones !== false },
  };
}

/** De dónde sale lo que depende del entorno. Los tests lo pasan; las rutas usan el real. */
export type Entorno = {
  /** APP_BASE_URL, sin barra final: de ahí se sirven el cargador del Pixel y sus endpoints. */
  appBaseUrl: string;
  /** `https://<proyecto>.supabase.co/storage/v1/object/public/landing-imagenes/`, o null. */
  prefijoBucket: string | null;
  /**
   * La base de las landings (tanda 4: `https://hola-mako.site` en producción), para la canónica y el
   * og:url. Sin ella, la de local (`<appBaseUrl>/l`): la usan los tests que no la pasan.
   */
  baseLandings?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Entorno
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El entorno real. El prefijo del bucket es `origenImagenes()` de especificacion.ts —el MISMO
 * que decide qué `src` acepta el renderizador—, y no una segunda cuenta: si las dos se
 * armaran distinto (una barra, un camino), la política bloquearía en silencio las imágenes
 * que el render dejó pasar.
 */
export function entornoActual(): Entorno {
  return { appBaseUrl: APP_BASE_URL, prefijoBucket: origenImagenes() || null, baseLandings: baseLandings() };
}

/** La base de las landings de un entorno (ver `Entorno.baseLandings`). */
const baseDe = (e: Entorno): string => e.baseLandings ?? baseLandingsPara({ produccion: false, appBaseUrl: e.appBaseUrl });

function origenDe(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Escapes
// ─────────────────────────────────────────────────────────────────────────────

/** Para texto y para atributos entre comillas dobles. Todo lo que se interpola pasa por acá. */
export function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Un texto de una línea, sin caracteres de control y con un tope (lo que va a <title> y a los meta). */
function linea(v: unknown, tope: number): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, tope);
}

/** Una URL absoluta https (o http en local), o null. Lo que no parsea no se escribe. */
function urlAbsoluta(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Una URL del bucket propio, o null: lo que el navegador BAJA (favicon) tiene que entrar en img-src. */
function urlDelBucket(v: unknown, prefijo: string | null): string | null {
  const u = urlAbsoluta(v);
  return u && prefijo && u.startsWith(prefijo) ? u : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que decide la config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Los buscadores pueden indexar esta página? Sólo si es la PUBLICADA y el sitio lo pidió
 * («Permitir la indexación en buscadores», default apagado como en Gamma). La vista previa
 * nunca: es un borrador detrás de un link privado.
 */
export function esIndexable(modo: ModoDocumento, config: ConfigLanding | null | undefined): boolean {
  return modo === 'publico' && config?.sitio?.indexar === true;
}

/**
 * El id del Píxel de Meta si es SÓLO dígitos, o null. El código lo arma el server: el id es
 * lo único que se interpola, y con cualquier otro carácter no se inyecta nada (un id con
 * una comilla cerraría la cadena del `fbq('init', …)`).
 */
export function idMetaPixel(config: ConfigLanding | null | undefined): string | null {
  const v = config?.sitio?.metaPixelId;
  const t = typeof v === 'string' ? v.trim() : '';
  return /^\d{5,20}$/.test(t) ? t : null;
}

/** Las hojas de Google Fonts que se cargan. Cualquier otra URL se descarta: no entraría en style-src. */
export function urlsDeFuentes(fuentes: string | readonly string[] | null | undefined): string[] {
  const lista = typeof fuentes === 'string' ? [fuentes] : Array.isArray(fuentes) ? fuentes : [];
  const out: string[] = [];
  for (const f of lista) {
    const u = urlAbsoluta(f);
    if (!u) continue;
    const p = new URL(u);
    if (p.protocol !== 'https:' || p.origin !== 'https://fonts.googleapis.com') continue;
    if (!out.includes(u)) out.push(u);
  }
  return out.slice(0, 4);
}

function idiomaDe(v: unknown): string {
  return typeof v === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(v.trim()) ? v.trim() : 'es';
}

// ─────────────────────────────────────────────────────────────────────────────
// El script propio de la página
// ─────────────────────────────────────────────────────────────────────────────
//
// Tres trabajos, y nada más:
//
// (a) FORMULARIOS `.gm-formulario`: cancela el envío del navegador, respeta la validación
//     nativa (el navegador ni dispara el `submit` con un campo requerido vacío; el
//     `checkValidity` es la red), deshabilita el botón, y muestra el mensaje de éxito o
//     navega a `data-redirigir` (sólo http/https: un `javascript:` no navega). El mensaje ya
//     viene escrito y oculto adentro del form (`p.gm-formulario-exito[hidden]`, especificacion.ts):
//     se esconde el resto y se muestra ése; si no estuviera, se arma con `data-exito`. NUNCA manda
//     nada: el opt-in al CRM lo manda el Pixel de MaKo, que escucha `submit` EN CAPTURA en
//     todo el documento (lib/landing-token.ts, «document.addEventListener('submit'…, true)»)
//     y lee los campos ANTES que este listener, que va en burbuja. Por eso el mensaje
//     esconde el formulario sin miedo: el Pixel ya leyó. Y por eso el redirect espera un
//     instante: el fetch del Pixel sale con `keepalive`, pero no cuesta nada darle aire.
// (b) ANIMACIÓN DE ENTRADA, sólo si el <body> trae `data-gm-animar="1"` (config.pagina.
//     animaciones), si hay IntersectionObserver y si la persona no pidió menos movimiento.
//     La clase que esconde (`gm-anim`) la pone ESTE script: sin JavaScript —un crawler, la
//     vista previa de WhatsApp— no hay nada escondido. Animan las secciones y lo que el
//     renderizador marque con `data-animar`.
// (c) Los desplegables son <details> nativos: andan sin JavaScript y no hay nada acá.
//
// ⚠️ ES UN STRING QUE SE SIRVE: sin barras invertidas, sin backticks y sin `${` adentro
// (AGENTS.md, «el fuente y lo que se sirve no son el mismo texto»), y sin regex. Su hash
// va en la política de contenido: si se toca una coma, el hash cambia solo.
export const SCRIPT_PAGINA = [
  '(function () {',
  '  var d = document, w = window;',
  '  function destino(raw) {',
  '    if (!raw) return null;',
  '    try {',
  '      var u = new URL(raw, w.location.href);',
  "      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;",
  '    } catch (e) { return null; }',
  '  }',
  "  d.addEventListener('submit', function (ev) {",
  '    var f = ev.target;',
  "    if (!f || !f.classList || !f.classList.contains('gm-formulario')) return;",
  '    ev.preventDefault();',
  "    if (f.getAttribute('data-gm-enviado')) return;",
  '    if (f.checkValidity && !f.checkValidity()) { if (f.reportValidity) f.reportValidity(); return; }',
  "    f.setAttribute('data-gm-enviado', '1');",
  "    var bs = f.querySelectorAll('button, input[type=\"submit\"]');",
  '    for (var i = 0; i < bs.length; i++) bs[i].disabled = true;',
  "    var ir = destino(f.getAttribute('data-redirigir'));",
  '    if (ir) { w.setTimeout(function () { w.location.assign(ir); }, 300); return; }',
  "    var exito = f.querySelector('.gm-formulario-exito');",
  '    if (exito) {',
  '      var hijos = f.children;',
  "      for (var c = 0; c < hijos.length; c++) if (hijos[c] !== exito) hijos[c].style.display = 'none';",
  "      exito.removeAttribute('hidden');",
  "      exito.setAttribute('role', 'status');",
  '      return;',
  '    }',
  "    var aviso = d.createElement('p');",
  "    aviso.className = 'gm-formulario-exito';",
  "    aviso.setAttribute('role', 'status');",
  "    aviso.textContent = f.getAttribute('data-exito') || 'Gracias. Recibimos tus datos.';",
  '    if (f.parentNode) f.parentNode.insertBefore(aviso, f.nextSibling);',
  "    f.style.display = 'none';",
  '  });',
  // (d) EL ALTO DEL «HTML PERSONALIZADO» (tanda 2, T6): cada bloque se sirve desde /l/html/… en un
  //     iframe sandbox, y un script suyo manda `{ tipo: 'gm-html-alto', alto }` (html-libre.ts). Se
  //     acepta SÓLO si `ev.source` es la ventana de uno de esos iframes (su origen es opaco: 'null'),
  //     con los mismos topes que `altoDeMensaje` (24 y 20000). El `if` del principio: sin
  //     addEventListener en la ventana no hay nada que escuchar (y no se corta lo de abajo).
  "  if (w.addEventListener) w.addEventListener('message', function (ev) {",
  '    var m = ev.data;',
  "    if (!m || typeof m !== 'object' || m.tipo !== 'gm-html-alto') return;",
  "    var fr = d.querySelectorAll('.gm-html iframe');",
  '    for (var q = 0; q < fr.length; q++) {',
  '      if (fr[q].contentWindow !== ev.source) continue;',
  '      var h = Math.round(Number(m.alto));',
  '      if (!isFinite(h)) return;',
  '      if (h < 24) h = 24;',
  '      if (h > 20000) h = 20000;',
  "      fr[q].style.height = h + 'px';",
  '      return;',
  '    }',
  '  });',
  "  if (!d.body || d.body.getAttribute('data-gm-animar') !== '1') return;",
  '  var IO = w.IntersectionObserver;',
  '  if (!IO) return;',
  "  try { if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}",
  "  var els = d.querySelectorAll('.gm-tarjeta, [data-animar]');",
  '  if (!els.length) return;',
  '  var io = new IO(function (entradas) {',
  '    for (var j = 0; j < entradas.length; j++) {',
  '      if (!entradas[j].isIntersecting) continue;',
  "      entradas[j].target.classList.add('gm-visto');",
  '      io.unobserve(entradas[j].target);',
  '    }',
  "  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });",
  "  d.documentElement.classList.add('gm-anim');",
  '  for (var k = 0; k < els.length; k++) io.observe(els[k]);',
  '})();',
].join('\n');

/**
 * La hoja propia del documento. Va ANTES de CSS_CONTENIDO: con la misma especificidad gana
 * la de después, así que el tema puede re-estilar el mensaje de éxito sin `!important`.
 */
export const CSS_DOCUMENTO = [
  'html,body{margin:0;padding:0}',
  'body{min-height:100vh;-webkit-text-size-adjust:100%;text-size-adjust:100%}',
  '.gm-formulario-exito{margin:0;padding:1em 1.25em;border-radius:.75em;font-weight:600;background:rgba(127,127,127,.12)}',
  // La animación de entrada (html.gm-anim / .gm-visto) la estila CSS_CONTENIDO (css.ts) con los
  // tiempos de Gamma, y va en la foto: acá estaba repetida y perdía por orden (integración, 11/10).
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// El Píxel de Meta (el código oficial, armado acá con un id de sólo dígitos)
// ─────────────────────────────────────────────────────────────────────────────

/** El código oficial de Meta, con el id adentro. `null` si el id no es de sólo dígitos. */
export function codigoMetaPixel(id: string | null): { script: string; noscript: string } | null {
  if (!id || !/^\d{5,20}$/.test(id)) return null;
  const script =
    "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};" +
    "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;" +
    "t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script'," +
    "'https://connect.facebook.net/en_US/fbevents.js');" +
    `fbq('init','${id}');fbq('track','PageView');`;
  const noscript = `<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&amp;ev=PageView&amp;noscript=1"></noscript>`;
  return { script, noscript };
}

// ─────────────────────────────────────────────────────────────────────────────
// La política de contenido
// ─────────────────────────────────────────────────────────────────────────────

/** `'sha256-…'` del texto EXACTO entre <script> y </script>. */
export function hashScript(texto: string): string {
  return `'sha256-${createHash('sha256').update(texto, 'utf8').digest('base64')}'`;
}

const HASH_SCRIPT_PAGINA = hashScript(SCRIPT_PAGINA);

/**
 * De dónde puede venir un iframe: los MISMOS hosts que acepta el bloque «Insertar»
 * (lib/embeds.ts). Los que van por dominio entran con y sin subdominio.
 */
export function hostsDeIframes(): string[] {
  const out = HOSTS_IFRAME.map((h) => `https://${h}`);
  for (const d of DOMINIOS_IFRAME) out.push(`https://${d}`, `https://*.${d}`);
  return out;
}

export type OpcionesPolitica = {
  entorno: Entorno;
  /** Hashes de los scripts inline (sin el del script de la página, que va siempre). */
  hashesExtra?: string[];
  /** El cargador del Pixel de MaKo y sus endpoints (sólo en la página publicada). */
  conPixel: boolean;
  /** El Píxel de Meta (sólo en la página publicada, con un id válido). */
  conMeta: boolean;
};

/**
 * La política, directiva por directiva. Lo que cada una deja pasar y por qué:
 *   · script-src: lo propio por hash; el cargador del Pixel y la librería del grabador
 *     (/replay/<v>/r.js) desde APP_BASE_URL; fbevents.js si hay Píxel de Meta.
 *   · connect-src: los endpoints del Pixel (/api/track/*) y los de Meta.
 *   · img-src / media-src: el bucket propio (render.ts no acepta otro src), data: y el
 *     pixel de imagen de Meta.
 *   · frame-src: los proveedores de lib/embeds.ts. El iframe `srcdoc` del HTML libre no es
 *     un pedido y no lo gobierna esto (sí le hereda el resto: ver la cabecera).
 *   · worker-src blob: el grabador de sesión (rrweb) arma un worker desde un blob.
 */
export function politicaDeContenido(o: OpcionesPolitica): string {
  const app = origenDe(o.entorno.appBaseUrl);
  const bucket = o.entorno.prefijoBucket;
  const dir: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', [
      "'self'",
      ...(o.conPixel && app ? [app] : []),
      HASH_SCRIPT_PAGINA,
      ...(o.hashesExtra ?? []),
      ...(o.conMeta ? ['https://connect.facebook.net'] : []),
    ]],
    ['style-src', ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']],
    ['font-src', ["'self'", 'https://fonts.gstatic.com', 'data:']],
    ['img-src', ["'self'", 'data:', ...(app ? [app] : []), ...(bucket ? [bucket] : []), ...(o.conMeta ? ['https://www.facebook.com'] : [])]],
    ['media-src', ["'self'", ...(bucket ? [bucket] : [])]],
    ['connect-src', ["'self'", ...(o.conPixel && app ? [app] : []), ...(o.conMeta ? ['https://www.facebook.com', 'https://connect.facebook.net'] : [])]],
    // 'self': el «HTML personalizado» se sirve desde /l/html/<doc>/<bloque> del MISMO host (T6).
    ['frame-src', ["'self'", ...hostsDeIframes()]],
    ['worker-src', ["'self'", 'blob:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'none'"]],
  ];
  const partes = dir.map(([k, v]) => `${k} ${[...new Set(v)].join(' ')}`);
  // Sólo si MaKo se sirve por https: en local (http://localhost) subiría el cargador del
  // Pixel a un https que no existe y la prueba local mediría nada.
  if (app?.startsWith('https:')) partes.push('upgrade-insecure-requests');
  return partes.join('; ');
}

// ─────────────────────────────────────────────────────────────────────────────
// El documento
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arma el documento. PURO (sin base): `tokenPixel` lo resuelve quien llama
 * (`documentoPublico`). En modo 'vista' el token se ignora: la vista previa no carga ni el
 * Pixel ni Meta (contaminaría las visitas y el aprendizaje de los anuncios).
 */
export function armarDocumento(e: EntradaDocumento & { tokenPixel?: string | null }, entorno: Entorno = entornoActual()): string {
  const cfg = e.config;
  const sitio = cfg?.sitio;
  const publico = e.modo === 'publico';

  const titulo = linea(e.titulo, 200) || linea(sitio?.seoTitulo, 200) || linea(e.tituloRespaldo, 200) || linea(sitio?.nombre, 200) || 'Landing';
  const descripcion = linea(e.descripcion, 320) || linea(sitio?.seoDescripcion, 320);
  const nombreSitio = linea(sitio?.nombre, 120);
  const canonica = urlAbsoluta(e.urlCanonica);
  const ogImagen = urlAbsoluta(sitio?.ogImagen);
  const favicon = urlDelBucket(sitio?.favicon, entorno.prefijoBucket);
  const fuentes = urlsDeFuentes(e.fuentes);
  const indexable = esIndexable(e.modo, cfg);

  const token = publico && typeof e.tokenPixel === 'string' && FORMA_TOKEN.test(e.tokenPixel) ? e.tokenPixel : null;
  const meta = publico ? codigoMetaPixel(idMetaPixel(cfg)) : null;
  const politica = politicaDeContenido({
    entorno,
    hashesExtra: meta ? [hashScript(meta.script)] : [],
    conPixel: !!token,
    conMeta: !!meta,
  });

  const a = escaparHtml;
  const head: string[] = [
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${a(politica)}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${a(titulo)}</title>`,
  ];
  if (descripcion) head.push(`<meta name="description" content="${a(descripcion)}">`);
  if (!indexable) head.push(`<meta name="robots" content="${publico ? 'noindex, nofollow' : 'noindex, nofollow, noarchive'}">`);
  if (publico && canonica) head.push(`<link rel="canonical" href="${a(canonica)}">`);
  head.push('<meta property="og:type" content="website">', `<meta property="og:title" content="${a(titulo)}">`);
  if (descripcion) head.push(`<meta property="og:description" content="${a(descripcion)}">`);
  if (canonica) head.push(`<meta property="og:url" content="${a(canonica)}">`);
  if (nombreSitio) head.push(`<meta property="og:site_name" content="${a(nombreSitio)}">`);
  if (ogImagen) head.push(`<meta property="og:image" content="${a(ogImagen)}">`);
  head.push(`<meta name="twitter:card" content="${ogImagen ? 'summary_large_image' : 'summary'}">`, `<meta name="twitter:title" content="${a(titulo)}">`);
  if (descripcion) head.push(`<meta name="twitter:description" content="${a(descripcion)}">`);
  if (ogImagen) head.push(`<meta name="twitter:image" content="${a(ogImagen)}">`);
  if (favicon) head.push(`<link rel="icon" href="${a(favicon)}">`);
  if (fuentes.length) {
    head.push('<link rel="preconnect" href="https://fonts.googleapis.com">', '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    for (const f of fuentes) head.push(`<link rel="stylesheet" href="${a(f)}">`);
  }
  // La hoja no viene de nadie de afuera, pero un `</style>` adentro cortaría el documento.
  const hoja = typeof e.css === 'string' && e.css.trim() ? e.css : CSS_CONTENIDO;
  head.push(`<style>${`${CSS_DOCUMENTO}\n${hoja}`.replace(/<\/style/gi, '<\\/style')}</style>`);

  const animar = cfg?.pagina?.animaciones !== false;
  const cola: string[] = [`<script>${SCRIPT_PAGINA}</script>`];
  if (meta) cola.push(`<script>${meta.script}</script>`, meta.noscript);
  if (token) cola.push(lineaCargador(token, entorno.appBaseUrl));

  return [
    '<!doctype html>',
    `<html lang="${a(idiomaDe(e.idioma))}">`,
    '<head>',
    ...head,
    '</head>',
    `<body${animar ? ' data-gm-animar="1"' : ''}>`,
    e.html,
    ...cola,
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * El token del Pixel de MaKo del workspace. Estricto (ver la cabecera, punto 6): si la base
 * no contesta, TIRA — y la ruta contesta 503 en vez de servir una página cuyo formulario
 * dice «gracias» sin que el opt-in pueda salir.
 *
 * Los imports son DINÁMICOS a propósito: los tres módulos traen `server-only`, y un import
 * estático haría que ningún test pudiera importar esta hoja.
 */
export async function tokenDelPixel(ws: number): Promise<string> {
  const [{ runWithWorkspace }, { getSettingEstricto }, landing] = await Promise.all([
    import('../workspace'),
    import('../settings'),
    import('../landing-token'),
  ]);
  const guardado = (await runWithWorkspace(ws, () => getSettingEstricto(landing.LANDING_TOKEN_KEY)))?.trim();
  if (guardado) return guardado;
  return landing.getOrCreateLandingToken(ws);
}

export type DepDocumento = {
  /** Reemplaza la lectura del token (tests). */
  tokenPixel?: (ws: number) => Promise<string | null>;
  entorno?: Entorno;
};

/**
 * El documento HTML completo de una página publicada (`modo: 'publico'`) o de la vista
 * previa (`modo: 'vista'`). Tira si el token del Pixel no se pudo leer.
 */
export async function documentoPublico(e: EntradaDocumento, dep: DepDocumento = {}): Promise<string> {
  const tokenPixel = e.modo === 'publico' ? await (dep.tokenPixel ?? tokenDelPixel)(e.workspaceId) : null;
  return armarDocumento({ ...e, tokenPixel }, dep.entorno ?? entornoActual());
}

// ─────────────────────────────────────────────────────────────────────────────
// Las páginas de error (sin enumerar: «no existe» y «está apagado» dicen lo mismo)
// ─────────────────────────────────────────────────────────────────────────────

function paginaSimple(titulo: string, texto: string | null): string {
  const a = escaparHtml;
  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<title>${a(titulo)}</title>`,
    '<style>html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#272525;background:#f9f8f7;text-align:center;padding:0 24px}h1{font-size:20px;font-weight:600;margin:0 0 8px}p{margin:0;color:#6b6a68}</style>',
    '</head>',
    '<body>',
    `<main><h1>${a(titulo)}</h1>${texto ? `<p>${a(texto)}</p>` : ''}</main>`,
    '</body>',
    '</html>',
  ].join('\n');
}

/** El texto de Gamma para su 404, tal cual lo dice en español. */
export const TEXTO_NO_EXISTE = 'Parece que esta página no existe (404).';
export const TEXTO_FALLO = 'Algo salió mal';
export const TEXTO_FALLO_DETALLE = 'Inténtalo de nuevo más tarde.';

export const paginaNoEncontrada = (): string => paginaSimple(TEXTO_NO_EXISTE, null);
export const paginaNoDisponible = (): string => paginaSimple(TEXTO_FALLO, TEXTO_FALLO_DETALLE);

// ─────────────────────────────────────────────────────────────────────────────
// La respuesta de las rutas
// ─────────────────────────────────────────────────────────────────────────────

/** Ver la cabecera, punto 5: guarda y pregunta cada vez; con el ETag igual es un 304. */
export const CACHE_PUBLICO = 'public, no-cache';
/** El borrador por el link privado: ni en el disco ni en un caché compartido. */
export const CACHE_VISTA = 'private, no-store';
/** Un 404 o un 503 no se guardan: el slug puede publicarse en un minuto, la base volver en otro. */
export const CACHE_ERROR = 'no-store';

const HTML = 'text/html; charset=utf-8';

/** El token del link privado. La forma la acuña D; acá sólo se corta lo que no puede ser un token. */
export const FORMA_TOKEN_VISTA = /^[A-Za-z0-9_-]{8,200}$/;

export type PedidoPublico =
  /**
   * `base` (T7, dominio propio): la dirección de inicio del sitio cuando se sirve en el dominio del
   * cliente (`https://<dominio>`, sin barra final). Con ella la canónica y el og:url son los del
   * dominio y no los de hola-mako.com/l/<slug>. Sin ella, la URL de MaKo.
   */
  | { tipo: 'pagina'; slug: string; ruta: string; base?: string }
  /** `ruta` = otra página del borrador (app/l/vista/[token]/[ruta]); sin ella, la de inicio. */
  | { tipo: 'vista'; token: string; ruta?: string };

export type DepRespuesta = DepDocumento & {
  /** La lectura de la foto (`leerPublicado` / `leerVistaPrevia`). null = no existe o está apagado. Tira = la base falló. */
  leer: () => Promise<LecturaPublica | null>;
};

/** ETag fuerte: el hash del documento entero (ver la cabecera, punto 5). */
export function etagDe(doc: string): string {
  return `"${createHash('sha256').update(doc, 'utf8').digest('base64url').slice(0, 32)}"`;
}

/** ¿El If-None-Match del navegador nombra este ETag? Acepta listas y la marca débil W/. */
export function coincideEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(',').some((t) => {
    const v = t.trim();
    return v === '*' || v === etag || v === `W/${etag}`;
  });
}

function respuestaError(status: 404 | 503, sinCuerpo: boolean): Response {
  const headers: Record<string, string> = { 'Content-Type': HTML, 'Cache-Control': CACHE_ERROR, 'X-Robots-Tag': 'noindex, nofollow' };
  if (status === 503) headers['Retry-After'] = '30';
  return new Response(sinCuerpo ? null : status === 404 ? paginaNoEncontrada() : paginaNoDisponible(), { status, headers });
}

/** Lo que se puede loguear de un pedido: el slug sí; del token del link privado, sólo el principio. */
function rotulo(p: PedidoPublico): string {
  return p.tipo === 'pagina' ? `${PREFIJO_PUBLICO}/${p.slug}${p.ruta ? `/${p.ruta}` : ''}` : `${PREFIJO_PUBLICO}/vista/${p.token.slice(0, 4)}…${p.ruta ? `/${p.ruta}` : ''}`;
}

/**
 * Lo que contesta GET/HEAD de una ruta pública. La decisión entera vive acá (con test); la
 * ruta sólo pasa el pedido y la lectura.
 *
 *   · slug o ruta con mayúsculas que en minúsculas son válidos → 308 a la URL en minúsculas,
 *     con la query intacta (los utm_* son la atribución del anuncio);
 *   · slug, ruta o token que no pueden existir → 404 SIN tocar la base;
 *   · la lectura devolvió null (no existe, o el sitio está apagado) → 404, la misma página
 *     para los dos casos: no se enumera qué slugs existen;
 *   · la lectura TIRÓ (la base no contestó) o no se pudo leer el token del Pixel → 503 sin
 *     caché. «No pude leer» no es «no existe» (AGENTS.md);
 *   · si no, 200 con el documento, su ETag, y 304 si el navegador ya lo tiene.
 */
export async function responderPublico(req: Request, pedido: PedidoPublico, dep: DepRespuesta): Promise<Response> {
  const sinCuerpo = req.method.toUpperCase() === 'HEAD';
  const entorno = dep.entorno ?? entornoActual();

  let modo: ModoDocumento;
  let urlCanonica: string;
  if (pedido.tipo === 'pagina') {
    const slug = pedido.slug, ruta = pedido.ruta;
    const slugMin = slug.toLowerCase(), rutaMin = ruta.toLowerCase();
    if ((slugMin !== slug || rutaMin !== ruta) && slugValido(slugMin) && rutaValida(rutaMin)) {
      // La ruta INTERNA (/l/…) del host que contestó: en hola-mako.site las mayúsculas ya las corrige el
      // proxy antes de reescribir (`decidirLandings`), así que esto sólo corre en local y en los previews.
      const u = new URL(req.url);
      u.pathname = urlPublica('', slugMin, rutaMin);
      return new Response(null, { status: 308, headers: { Location: u.toString(), 'Cache-Control': CACHE_ERROR } });
    }
    if (!slugValido(slug) || !rutaValida(ruta)) return respuestaError(404, sinCuerpo);
    modo = 'publico';
    urlCanonica = pedido.base ? `${pedido.base}${ruta ? `/${ruta}` : '/'}` : urlLandingEn(baseDe(entorno), slug, ruta);
  } else {
    const ruta = pedido.ruta ?? '';
    if (!FORMA_TOKEN_VISTA.test(pedido.token) || !rutaValida(ruta)) return respuestaError(404, sinCuerpo);
    modo = 'vista';
    urlCanonica = urlVistaEn(baseDe(entorno), pedido.token, ruta);
  }

  let lectura: LecturaPublica | null;
  try {
    lectura = await dep.leer();
  } catch (err) {
    console.error(`[l] no pude leer ${rotulo(pedido)} (la base no contestó): ${err instanceof Error ? err.message : String(err)}`);
    return respuestaError(503, sinCuerpo);
  }
  if (!lectura || typeof lectura.pagina?.html !== 'string' || !lectura.foto) return respuestaError(404, sinCuerpo);

  const config = configDeLectura(lectura);
  let doc: string;
  try {
    doc = await documentoPublico(
      {
        html: lectura.pagina.html, config, css: lectura.foto.css, fuentes: lectura.foto.fuentes,
        workspaceId: lectura.workspaceId, modo, urlCanonica,
        titulo: lectura.pagina.titulo, descripcion: lectura.pagina.descripcion, tituloRespaldo: lectura.titulo,
      },
      { tokenPixel: dep.tokenPixel, entorno },
    );
  } catch (err) {
    console.error(`[l] no pude armar ${rotulo(pedido)} (token del Pixel): ${err instanceof Error ? err.message : String(err)}`);
    return respuestaError(503, sinCuerpo);
  }

  const etag = etagDe(doc);
  const comunes: Record<string, string> = { 'Cache-Control': modo === 'publico' ? CACHE_PUBLICO : CACHE_VISTA, ETag: etag };
  if (!esIndexable(modo, config)) comunes['X-Robots-Tag'] = modo === 'vista' ? 'noindex, nofollow, noarchive' : 'noindex, nofollow';

  // Un 304 no lleva cuerpo ni tipo: el navegador usa el que ya tiene.
  if (coincideEtag(req.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers: comunes });
  return new Response(sinCuerpo ? null : doc, { status: 200, headers: { 'Content-Type': HTML, ...comunes } });
}
