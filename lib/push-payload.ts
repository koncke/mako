// =============================================================================
// push-payload — lo que se DIBUJA en la notificación de un Web Push (PURO)
// =============================================================================
// Una notificación es una superficie DIBUJADA (AGENTS.md, «La pantalla dice QUÉ pasó»): el
// título es el nombre del aviso y el cuerpo UNA frase. El texto de un aviso está escrito
// para el grupo de WhatsApp —rótulo de barras, *negritas*, emojis, links y la firma—, así
// que acá se le saca todo eso y se queda la primera frase.
//
// SIN `server-only` y sin red, a propósito: lo prueba tests/push-payload.test.ts y lo usa
// lib/push.ts. Sólo depende de módulos puros (app-url y movil-rutas).
//
// ⚠️ EL LINK SALE DE LA APP, así que va por la QUINTA forma de navegar (AGENTS.md):
// `linkApp(ruta, ws)` con el workspace DESTINO del aviso, nunca el de la pestaña de nadie.
// Y la ruta se traduce a su equivalente MÓVIL (`rutaMovilOHome`): el link por default de un
// aviso es una pantalla de escritorio (`/configuraciones?tab=notif`), y una que no va al teléfono
// abre la home. Desde el 13/10/2026 (LAS MISMAS RUTAS) eso sale con la URL de ESCRITORIO de esa
// pantalla (`conWs` adentro de `linkApp` aplica `rutaEscritorio`): /perfil, no /m/cuenta. El
// teléfono la ve en su versión porque el proxy se la sirve así; nunca viaja una URL /m.
// =============================================================================

import { linkApp } from './app-url';
import { rutaMovilOHome } from './movil-rutas';

/** Techo del título: lo que entra en un renglón de la notificación de un teléfono. */
export const TOPE_TITULO = 40;
/** Techo del cuerpo: una frase (iOS corta en ~4 renglones; Android en ~2 sin expandir). */
export const TOPE_CUERPO = 120;

export type EntradaPayload = {
  /** El tipo del aviso (`reunion-nuevo-agendado`, `mako-pendiente`…): arma el tag por default. */
  tipo: string;
  titulo: string;
  /** El texto entero, con las marcas de WhatsApp si las trae: se reduce a una frase. */
  cuerpo: string;
  /** La ruta de ESCRITORIO o móvil que abre al tocar. Sin ruta, la home móvil. */
  ruta?: string | null;
  /** Agrupa: una notificación con el mismo tag REEMPLAZA a la anterior en el teléfono. */
  tag?: string | null;
  /** El número para el ícono de la app (setAppBadge), si se sabe. */
  badge?: number | null;
};

/** Lo que viaja cifrado al teléfono y lee public/sw.js. Las claves son contrato con el SW. */
export type PayloadPush = { titulo: string; cuerpo: string; url: string; tag: string; badge?: number };

// Emojis (incluidas banderas y keycaps) y los invisibles que los arman. Un emoji en el
// texto de WhatsApp hace de ícono; en la notificación ya está el ícono de la app.
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu;
const URL_RE = /\bhttps?:\/\/\S+/gi;

/** El texto de un aviso sin rótulo, marcas, emojis, links, viñetas ni firma, renglón por renglón. */
export function renglonesLimpios(texto: string): string[] {
  const out: string[] = [];
  for (const crudo of String(texto ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    let l = crudo;
    if (/━━/.test(l)) continue;                       // el rótulo «━━ 🗓️ REUNIÓN ━━»
    if (/^\s*[—–-]\s*MaKo\s*$/i.test(l)) continue;    // la firma
    l = l.replace(/```[\s\S]*?```/g, ' ').replace(/```/g, ' ');
    l = l.replace(URL_RE, ' ');
    l = l.replace(EMOJI, ' ');
    // Las marcas de WhatsApp: se saca el SIGNO y queda la palabra. Sólo en borde de palabra,
    // para no comerse un `_` de un `mi_archivo` ni el `*` de una cuenta.
    l = l
      .replace(/(^|[\s(¡¿"'])\*(\S(?:[^*\n]*\S)?)\*(?=$|[\s).,;:!?¡¿"'])/gu, '$1$2')
      .replace(/(^|[\s(¡¿"'])_(\S(?:[^_\n]*\S)?)_(?=$|[\s).,;:!?¡¿"'])/gu, '$1$2')
      .replace(/(^|[\s(¡¿"'])~(\S(?:[^~\n]*\S)?)~(?=$|[\s).,;:!?¡¿"'])/gu, '$1$2')
      .replace(/`([^`\n]*)`/g, '$1');
    l = l.replace(/^\s*(?:[•·▪◦>]|[-*](?=\s))\s*/u, '');  // viñeta o cita al principio
    l = l.replace(/\s+/g, ' ').trim();
    l = l.replace(/^[:,;\-–—\s]+/, '').trim();          // lo que quedó colgando de un emoji/link
    if (l && /[\p{L}\p{N}]/u.test(l)) out.push(l);
  }
  return out;
}

/** Corta en un borde de palabra y agrega «…». Nunca deja una palabra partida. */
export function recortar(s: string, tope: number): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= tope) return t;
  const corte = t.slice(0, tope - 1);
  const espacio = corte.lastIndexOf(' ');
  const base = (espacio >= Math.floor(tope * 0.5) ? corte.slice(0, espacio) : corte).replace(/[\s,;:.\-–—]+$/u, '');
  return `${base}…`;
}

/**
 * La primera frase del primer renglón con contenido. Un renglón de WhatsApp ya es una
 * unidad (las viñetas de abajo son el detalle), así que la frase nunca cruza de renglón.
 *
 * ⚠️ El borde de frase no puede ser el punto de una abreviatura de UNA letra: «10:00 a. m.»
 * partido en «a.» dejaría «Mañana a las 10:00 a.». Un número con punto («US$15.217») no es
 * borde porque no lo sigue un espacio.
 */
export function primeraFrase(texto: string, tope = TOPE_CUERPO): string {
  const [primero] = renglonesLimpios(texto);
  if (!primero) return '';
  const borde = /(?<![\s.(¡¿]\p{L}|^\p{L})[.!?…](?=\s|$)/u.exec(primero);
  let frase = borde ? primero.slice(0, borde.index + 1) : primero;
  frase = frase.replace(/[\s:;,\-–—]+$/u, '').trim();
  return recortar(frase, tope);
}

/** El título: sin marcas ni emojis, en un renglón, con su techo. */
export function tituloPush(titulo: string): string {
  const limpio = renglonesLimpios(titulo).join(' ');
  return recortar(limpio || 'MaKo', TOPE_TITULO);
}

/** Un tag apto para `showNotification` (corto y sin espacios). */
export function tagDe(tipo: string, clave?: string | number | null): string {
  const base = `${tipo}${clave != null && String(clave) !== '' ? `:${clave}` : ''}`;
  return base.replace(/\s+/g, '-').slice(0, 96) || 'mako';
}

/**
 * El `?ws=` que lleva el link de un push: el workspace DESTINO, salvo que sea el de
 * PLATAFORMA (`wsSuperAdmin()`), que va SIN `?ws=`.
 *
 * ⚠️ Para un admin global, `?ws=N` es «estoy mirando la cuenta N» AUNQUE N sea la suya
 * (`estaImpersonando` mira sólo si la pestaña trae el parámetro, lib/workspace.ts), y con eso
 * `tableroActual()` contesta `cliente`. Medido el 11/10/2026: el ws9 (el de Martín) tiene 423
 * tareas en `plan_tareas` y 0 en `experimento_tareas`, así que cada push del dueño
 * (`alDueno`, los vencimientos del plan, el «Probar») abría /m/plan y Today con el plan
 * VACÍO y el cartel de «viendo una cuenta». Sin el parámetro, su sesión cae a su propio
 * workspace (`sesion.ws`) y el tablero es el suyo; a cualquier otra persona de ese
 * workspace el `?ws=` no le cambiaba nada (el proxy sólo lo acepta de un admin global).
 */
export function wsDelLink(wsDestino: number | null, wsPlataforma: number | null): number | null {
  return wsDestino != null && wsPlataforma != null && wsDestino === wsPlataforma ? null : wsDestino;
}

/** Arma lo que viaja al teléfono. `ws` = el workspace DESTINO (el de los datos del link), ya
 *  pasado por `wsDelLink`. */
export function armarPayloadPush(e: EntradaPayload, ws: number | null): PayloadPush {
  const p: PayloadPush = {
    titulo: tituloPush(e.titulo),
    cuerpo: primeraFrase(e.cuerpo),
    url: linkApp(rutaMovilOHome(e.ruta ?? null), ws),
    tag: e.tag?.trim() ? tagDe(e.tag.trim()) : tagDe(e.tipo),
  };
  if (typeof e.badge === 'number' && Number.isFinite(e.badge) && e.badge >= 0) p.badge = Math.floor(e.badge);
  return p;
}

/**
 * ¿Este endpoint es de un servicio de push de verdad? El server le hace un POST a lo que
 * diga la fila, así que una suscripción con un endpoint inventado convertiría «Probar» en
 * un pedido nuestro a cualquier dirección (SSRF). Lista en POSITIVO de los servicios que
 * usan los navegadores (Chrome/Edge/Samsung/Opera → FCM, Firefox → Mozilla, Safari → Apple,
 * Edge de Windows → WNS), comparando el HOST de `new URL()` —nunca un prefijo del string:
 * `https://fcm.googleapis.com@otro.tld` empieza igual y su host es `otro.tld`—, sólo https,
 * sin puerto y sin credenciales.
 */
export function endpointPermitido(endpoint: string | null | undefined): boolean {
  let u: URL;
  try { u = new URL(String(endpoint ?? '')); } catch { return false; }
  if (u.protocol !== 'https:' || u.port !== '' || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  return h === 'fcm.googleapis.com'
    || h === 'updates.push.services.mozilla.com'
    || h === 'web.push.apple.com'
    || h.endsWith('.push.apple.com')
    || h.endsWith('.notify.windows.com');
}

/** De dónde es la suscripción (para la columna `plataforma`), por el user-agent. */
export function plataformaDeUA(ua: string | null | undefined): 'ios' | 'android' | 'desktop' {
  const u = String(ua ?? '');
  if (/iPhone|iPad|iPod/i.test(u)) return 'ios';
  if (/Android/i.test(u)) return 'android';
  return 'desktop';
}

/**
 * Qué hacer con una suscripción después de que el servicio de push contestó un error.
 * 404 y 410 = la suscripción MURIÓ (la persona la revocó, desinstaló la app o Safari la
 * dio de baja): se borra la fila. Cualquier otro (429, 5xx, un timeout, 413) es un fallo
 * de ESTE envío: se cuenta y se deja el motivo, y la fila sigue.
 */
export function accionTrasError(statusCode: number | null | undefined): 'borrar' | 'fallo' {
  return statusCode === 404 || statusCode === 410 ? 'borrar' : 'fallo';
}
