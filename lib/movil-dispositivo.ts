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

/** ¿Este request va a MaKo Mobile? Teléfono y sin haber pedido la versión completa. */
export function vaAMovil(d: Dispositivo, vista: string | null | undefined): boolean {
  return d === 'telefono' && vista !== VISTA_ESCRITORIO;
}

/**
 * La cookie que escribe «Versión completa» (desde el navegador: `document.cookie =
 * cookieVistaEscritorio()`, y después `window.location.href = conWs('/inicio', ws)`).
 * Sin `Secure` a propósito: es una preferencia de vista, no una credencial, y en
 * local (http) una cookie Secure no se escribe.
 */
export function cookieVistaEscritorio(): string {
  return `${VISTA_COOKIE}=${VISTA_ESCRITORIO}; Path=/; Max-Age=${VISTA_ESCRITORIO_SEG}; SameSite=Lax`;
}

/** La que la borra (volver a la vista del teléfono). */
export function cookieVistaMovil(): string {
  return `${VISTA_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
