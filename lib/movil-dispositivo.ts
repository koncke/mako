// =============================================================================
// MaKo Mobile — ¿el que entra es un TELÉFONO? (la decisión de /inicio)
// =============================================================================
// /inicio es la puerta única (login, «Entrar» de la landing, `denegarRol`), y ahí
// se decide si la persona va a /m o al escritorio. Esa decisión es ESTE módulo:
// puro, sin `server-only` y sin `next/server`, para que lo puedan importar tanto el
// server (que lee los headers) como un componente cliente (el botón «Versión
// completa» que escribe la cookie) y los tests.
//
// ⚠️ POR QUÉ NO `userAgentFromString` DE `next/server`, que es lo obvio: ese módulo
// arrastra NextRequest/NextResponse y el resto del runtime del server, y la cookie
// de preferencia se escribe desde el NAVEGADOR. Las reglas de abajo son las mismas
// que aplica el ua-parser que trae Next (lo fija tests/movil-dispositivo.test.ts,
// que compara las dos sobre el mismo corpus), así que no es una segunda opinión:
// es la misma, sin el peso.
//
// Tres casos que NO son teléfono, a propósito:
//   · iPadOS 13+ manda un UA de Macintosh: para el server es ESCRITORIO, y está
//     bien — una tableta con teclado usa la app completa.
//   · Una tableta Android (UA con «Android» y sin «Mobile») es 'tablet' y se queda
//     en escritorio: la decisión del documento es mandar a /m sólo teléfonos.
//   · Un bot (Googlebot móvil incluido) es escritorio: /inicio pide sesión igual,
//     pero un bot no tiene por qué ver el shell móvil.
//
// `sec-ch-ua-mobile` (sólo lo mandan los Chromium por HTTPS: ni Safari ni Firefox)
// CONFIRMA, nunca decide solo: si el UA ya dijo tablet o escritorio, gana el UA.
// Sólo promueve a teléfono un UA que no se pudo clasificar.
// =============================================================================

export type Dispositivo = 'telefono' | 'tablet' | 'escritorio';

/** La cookie que pone «Versión completa»: con ella puesta, /inicio no manda a /m. */
export const VISTA_COOKIE = 'mako_vista';
export const VISTA_ESCRITORIO = 'escritorio';
/** 12 horas: lo que dura «hoy quiero la versión completa» sin volverse permanente. */
export const VISTA_ESCRITORIO_SEG = 12 * 60 * 60;

// Los nombres concretos y no un `bot` suelto: «CUBOT» es una marca de teléfonos
// Android, y un `/bot/i` lo mandaba al escritorio.
const BOT = /googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|petalbot|semrushbot|ahrefsbot|twitterbot|linkedinbot|facebookexternalhit|facebookcatalog|slurp|crawler|spider|headlesschrome|lighthouse|pagespeed|\bbot\b/i;

/** Clasifica el dispositivo por el UA y, si hace falta, por el client hint de Chromium. */
export function tipoDeDispositivo(ua: string | null | undefined, chMobile?: string | null): Dispositivo {
  const u = (ua ?? '').trim();
  if (u) {
    if (BOT.test(u)) return 'escritorio';
    // El iPad viejo (iOS ≤ 12) todavía se anuncia como iPad; el nuevo es «Macintosh».
    if (/\biPad\b/i.test(u)) return 'tablet';
    if (/\b(iPhone|iPod)\b/i.test(u)) return 'telefono';
    if (/\bAndroid\b/i.test(u)) return /\bMobile\b/i.test(u) ? 'telefono' : 'tablet';
    if (/Windows Phone|IEMobile|BlackBerry|\bBB10\b|Opera Mini|webOS/i.test(u)) return 'telefono';
    if (/\b(Kindle|Silk|PlayBook|Tablet)\b/i.test(u)) return 'tablet';
    // La recomendación de MDN para el resto: «Mobi» en el UA es un teléfono.
    if (/Mobi/i.test(u)) return 'telefono';
    // Un UA de escritorio reconocible decide: el hint no lo da vuelta.
    if (/Windows NT|Macintosh|X11|CrOS|Linux x86_64/i.test(u)) return 'escritorio';
  }
  if ((chMobile ?? '').trim() === '?1') return 'telefono';
  return 'escritorio';
}

/**
 * LA VISTA DE ESCRITORIO DE UNA SOLA PANTALLA (20/10/2026). Martín, desde su Android: «Veo MaKo mobile roto, como si
 * estuviera en desktop». Tocó «General» de Configuración del negocio (no tiene pantalla en el teléfono), la hoja «Abrir
 * en la computadora» puso `mako_vista=escritorio` por 12 h para TODA la app, y no había vuelta: `cookieVistaMovil`
 * existía pero nadie la llamaba, y una ruta /m con la cookie puesta va al escritorio.
 *
 * Desde ese día «Abrir en la computadora» guarda la RUTA (`escritorio:/configuraciones`) y sólo ESA ruta se abre en la
 * versión de computadora; cualquier otra vuelve al teléfono. `escritorio` a secas sigue siendo «toda la app» (la
 * «Versión de computadora» de More), y la vuelta es el botón «Volver al teléfono» (app/_components/VueltaAlTelefono.tsx).
 */
const PREFIJO_RUTA = `${VISTA_ESCRITORIO}:`;

/** La ruta de un href, sin query ni #, sin la barra del final: `/configuraciones?tab=x` → `/configuraciones`. */
export function rutaDeHref(href: string): string {
  const p = (href ?? '').split(/[?#]/)[0].replace(/\/+$/, '');
  return p.startsWith('/') ? p : `/${p}`;
}

/** ¿La cookie de vista pide escritorio en ESTA ruta? Global (`escritorio`) en todas; con ruta, sólo en ésa. */
export function vistaEscritorioEn(vista: string | null | undefined, pathname: string | null | undefined): boolean {
  if (!vista) return false;
  if (vista === VISTA_ESCRITORIO) return true;
  if (!vista.startsWith(PREFIJO_RUTA)) return false;
  let ruta: string;
  try { ruta = decodeURIComponent(vista.slice(PREFIJO_RUTA.length)); } catch { return false; }
  return !!ruta && rutaDeHref(pathname ?? '') === rutaDeHref(ruta);
}

/** ¿Es la vista de escritorio de TODA la app (la «Versión de computadora»), y no la de una pantalla? */
export function vistaEscritorioGlobal(vista: string | null | undefined): boolean {
  return vista === VISTA_ESCRITORIO;
}

/**
 * ¿Este request va a MaKo Mobile? Teléfono y sin haber pedido la versión de computadora PARA ESTA RUTA. Sin `pathname`
 * (lo de antes del 20/10/2026), una cookie de una sola pantalla no cuenta: va al teléfono.
 */
export function vaAMovil(d: Dispositivo, vista: string | null | undefined, pathname: string = ''): boolean {
  return d === 'telefono' && !vistaEscritorioEn(vista, pathname);
}

/**
 * La cookie que escribe «Versión completa» (desde el navegador: `document.cookie =
 * cookieVistaEscritorio()`, y después `window.location.href = conWs('/inicio', ws)`).
 * Con `ruta` (20/10/2026), sólo ESA pantalla se abre en la computadora: es lo que usa «Abrir en la computadora».
 * Sin `Secure` a propósito: es una preferencia de vista, no una credencial, y en
 * local (http) una cookie Secure no se escribe.
 */
export function cookieVistaEscritorio(ruta?: string): string {
  const valor = ruta ? `${PREFIJO_RUTA}${encodeURIComponent(rutaDeHref(ruta))}` : VISTA_ESCRITORIO;
  return `${VISTA_COOKIE}=${valor}; Path=/; Max-Age=${VISTA_ESCRITORIO_SEG}; SameSite=Lax`;
}

/** La que la borra (volver a la vista del teléfono). */
export function cookieVistaMovil(): string {
  return `${VISTA_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
