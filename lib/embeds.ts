// =============================================================================
// embeds — lo que se puede INSERTAR en MaKo (un video, una agenda): la lista blanca, en UN lugar
// =============================================================================
// Items 14 y 15 del audio del 08/10/2026 (docs/feedback-curso-08oct.md):
//   · 14 (22:40): «Hoy en día solamente funciona con URL, tengo que hacer que funcione con URL y con
//     objetos embed. Con HTML embed». El link de Panda caía en «afuera» (un botón que abre Panda en
//     otra pestaña): «me redirige a Panda pero no me toma la previsualización».
//   · 15 (24:30): «que lo pueda embeber cosas como… el Calendar, que se puedan embeber ahí mismo».
//
// Contrato (pista VIDEO, contrato 4):
//   export type Embed = { src: string; proveedor: string; alto?: number };
//   export function embedDe(texto: string): Embed | null
//
// Acepta una URL o el CÓDIGO que copia la persona: un `<iframe …>` (YouTube, Vimeo, Loom, Panda,
// Drive, Wistia, Bunny, Google Calendar), el `<div data-url>` de Calendly, el `data-src` de HubSpot,
// el `data-path` de TidyCal o el `calLink` de Cal.com. De ahí sale UNA dirección, y esa dirección
// pasa por la MISMA lista blanca que un link pegado. Lo usan el video de una clase (`videoDeLink`,
// lib/curso.ts), el bloque «Insertar» del editor rico (app/_ui/EditorRico.tsx), el saneo del server
// (lib/html-seguro.ts), la alarma y la hoja de lectura (app/_ui/HtmlSeguro.tsx) y el campo «agenda»
// del alumno (pista MODELO).
//
// ⚠️ EL `src` QUE SALE LO ARMA ESTE MÓDULO, NUNCA ES EL QUE ENTRÓ. De lo que llega se saca el id
//    (validado contra un juego de caracteres cerrado) y el `src` se escribe de cero con el host del
//    reproductor. Así un `?autoplay=1&…` raro, un fragmento o un parámetro que el proveedor no
//    documenta no viajan, y el saneo puede comparar el `src` guardado contra `embedDe(src).src` como
//    TEXTO: si no son iguales, no salió de acá.
// ⚠️ EL HOST SE COMPARA EXACTO, con `new URL(...).hostname` (AGENTS.md, «un guard de ORIGEN se escribe
//    con origin»), nunca con un prefijo ni un `includes`: `calendly.com.evil.tld` empieza igual que
//    `calendly.com`, y en `https://calendly.com@evil.tld/` el host real es `evil.tld`. Una URL con
//    usuario, clave o puerto no pasa.
// ⚠️ SÓLO https en `embedDe` (lo que se inserta en un texto). El video de una clase acepta además un
//    link `http://` a un host conocido, como siempre (`videoDeLink`), porque el `src` igual se arma
//    https desde el id: lo que entra por http nunca llega a un iframe tal cual.
// ⚠️ ESTÁN LOS QUE SE DEJAN INSERTAR. Medido el 08/10/2026 con curl contra cada proveedor: ninguno de
//    la lista manda `X-Frame-Options` ni `frame-ancestors`, salvo el link corto de Google
//    (`calendar.app.google/…` contesta `X-Frame-Options: SAMEORIGIN`): ése no se acepta y se pide el
//    código, que trae la dirección larga (`calendar.google.com/calendar/appointments/schedules/…`).
//    Cal.com redirige `cal.com/<x>` a `i.cal.com/<x>`; el iframe sigue el redirect.
//
// Sin 'use client' ni 'server-only' a propósito: lo importan el server y el navegador, y un test lo
// EJECUTA (tests/embeds.test.ts).

// ── El contrato ──────────────────────────────────────────────────────────────

export type Embed = { src: string; proveedor: string; alto?: number };

export type ClaseEmbed = 'video' | 'agenda';

type Ficha = { nombre: string; clase: ClaseEmbed; alto?: number };

/**
 * Los proveedores, con el nombre que ve la persona y si son un VIDEO (va a 16:9, sin alto) o una
 * AGENDA (va a un alto fijo, el de su código o el de acá). El alto de una agenda es el que trae el
 * código de cada proveedor por default (Calendly 700, Google 600).
 */
export const PROVEEDORES_EMBED = {
  youtube: { nombre: 'YouTube', clase: 'video' },
  vimeo: { nombre: 'Vimeo', clase: 'video' },
  loom: { nombre: 'Loom', clase: 'video' },
  drive: { nombre: 'Drive', clase: 'video' },
  panda: { nombre: 'Panda Video', clase: 'video' },
  wistia: { nombre: 'Wistia', clase: 'video' },
  bunny: { nombre: 'Bunny', clase: 'video' },
  calendly: { nombre: 'Calendly', clase: 'agenda', alto: 700 },
  calcom: { nombre: 'Cal.com', clase: 'agenda', alto: 700 },
  google: { nombre: 'Google Calendar', clase: 'agenda', alto: 600 },
  tidycal: { nombre: 'TidyCal', clase: 'agenda', alto: 700 },
  hubspot: { nombre: 'HubSpot', clase: 'agenda', alto: 700 },
} as const satisfies Record<string, Ficha>;

export type ProveedorEmbed = keyof typeof PROVEEDORES_EMBED;

export const esProveedorEmbed = (p: unknown): p is ProveedorEmbed =>
  typeof p === 'string' && Object.prototype.hasOwnProperty.call(PROVEEDORES_EMBED, p);

const ficha = (p: ProveedorEmbed): Ficha => PROVEEDORES_EMBED[p];

/** El nombre que ve la persona («Calendly»), o `null` si no es un proveedor de la lista. */
export function nombreDeProveedor(p: unknown): string | null {
  return esProveedorEmbed(p) ? ficha(p).nombre : null;
}

/** ¿Es un video o una agenda? `null` si no es un proveedor de la lista. */
export function claseDeProveedor(p: unknown): ClaseEmbed | null {
  return esProveedorEmbed(p) ? ficha(p).clase : null;
}

// ── Los atributos fijos del iframe ───────────────────────────────────────────

/**
 * El `sandbox` de TODO lo que se inserta en un texto, fijo. Lo que se deja: correr su propio código y
 * guardar su sesión (`allow-scripts allow-same-origin`: sin eso no anda ni un reproductor ni una
 * agenda), mandar el formulario de la reserva (`allow-forms`) y abrir una pestaña nueva («Ver en
 * YouTube», el link de la videollamada: `allow-popups` y que esa pestaña no herede el sandbox).
 * ⚠️ `allow-scripts` + `allow-same-origin` sólo es peligroso si el iframe es de NUESTRO origen (se
 *    sacaría el sandbox): acá el `src` es siempre de un host de la lista, ninguno nuestro.
 * ⚠️ NUNCA `allow-top-navigation`: un iframe que navega la pestaña de arriba se lleva la clase.
 * `allow-storage-access-by-user-activation`: que el proveedor pueda pedir SUS cookies después de un clic
 * (YouTube lo pide; medido en el banco: sin el permiso, la consola dice «requestStorageAccess: Refused…
 * The document is sandboxed»). Es sobre las cookies de él, no sobre las nuestras.
 */
export const SANDBOX_EMBED = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-storage-access-by-user-activation';

/** Los permisos (`allow`), fijos: reproducir, pantalla completa, imagen en imagen, copiar. Ni cámara, ni micrófono, ni ubicación. */
export const ALLOW_EMBED = 'autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write';

/**
 * El `referrerpolicy`, fijo: el origen y nada más. ⚠️ YouTube EXIGE el Referer desde 2025: sin él, su
 * reproductor muestra el error 153 y un «Ver en YouTube» — o sea, «me redirige un link».
 */
export const REFERRER_EMBED = 'strict-origin-when-cross-origin';

/**
 * Los altos que puede tener una agenda, en px: de 300 a 1.200, de a 50. ⚠️ UNA LISTA CERRADA, como
 * los anchos de una imagen (`ANCHOS_IMAGEN`, app/_ui/HtmlSeguro.tsx): el saneo los compara como TEXTO
 * y la hoja de lectura tiene una regla por valor. Nunca un `style` ni un `height` libre.
 */
export const ALTO_EMBED_MIN = 300;
export const ALTO_EMBED_MAX = 1200;
export const ALTO_EMBED_PASO = 50;
export const ALTOS_EMBED: readonly number[] = Array.from(
  { length: (ALTO_EMBED_MAX - ALTO_EMBED_MIN) / ALTO_EMBED_PASO + 1 },
  (_, i) => ALTO_EMBED_MIN + i * ALTO_EMBED_PASO,
);

/** El alto si es EXACTAMENTE uno de la lista (`'700'` o `700`), o `null`. «0700» no es «700». */
export function altoDeEmbed(raw: unknown): number | null {
  const t = typeof raw === 'number' ? String(raw) : raw;
  if (typeof t !== 'string' || !/^\d{3,4}$/.test(t)) return null;
  const n = Number(t);
  return String(n) === t && ALTOS_EMBED.includes(n) ? n : null;
}

/** Un alto cualquiera (el `height` de un código pegado) llevado al de la lista más cercano. */
export function altoValido(px: number): number {
  if (!Number.isFinite(px)) return ALTO_EMBED_MIN;
  const paso = Math.round(px / ALTO_EMBED_PASO) * ALTO_EMBED_PASO;
  return Math.max(ALTO_EMBED_MIN, Math.min(ALTO_EMBED_MAX, paso));
}

/**
 * Los atributos del `<iframe>` de un embed, EN ORDEN. Los escriben el saneo del server
 * (lib/html-seguro.ts) y el nodo «insertado» del editor (app/_ui/EditorRico.tsx), y la alarma de
 * HtmlSeguro compara contra esto: una lista con tres lectores, para que lo que escribe el editor sea,
 * letra por letra, lo que guarda el server (si no, el editor recarga el documento y el cursor salta).
 * El `title` es el nombre del proveedor (un iframe sin título no se anuncia), el alto sólo va en una
 * agenda (un video va a 16:9) y ningún valor es libre: todos salen de una lista de acá.
 */
export function atributosDeIframe(e: Embed): Array<[string, string]> {
  const p = esProveedorEmbed(e.proveedor) ? e.proveedor : null;
  const out: Array<[string, string]> = [['src', e.src], ['title', p ? ficha(p).nombre : 'Insertado'], ['data-proveedor', p ?? '']];
  if (p && ficha(p).clase === 'agenda') out.push(['data-alto', String(altoDeEmbed(e.alto) ?? altoValido(ficha(p).alto ?? 700))]);
  out.push(['sandbox', SANDBOX_EMBED], ['allow', ALLOW_EMBED], ['loading', 'lazy'], ['referrerpolicy', REFERRER_EMBED]);
  return out;
}

/**
 * La SEGUNDA capa del saneo (`allowedIframeHostnames` / `allowedIframeDomains` de sanitize-html): los
 * hosts de los `src` que arma este módulo. La primera capa es `embedDe`, que es más estricta (mira el
 * camino y el id); si un día alguien afloja una, queda la otra.
 */
export const HOSTS_IFRAME: readonly string[] = [
  'www.youtube-nocookie.com', 'player.vimeo.com', 'www.loom.com', 'drive.google.com', 'fast.wistia.net',
  'iframe.mediadelivery.net', 'calendly.com', 'cal.com', 'calendar.google.com', 'tidycal.com',
];
/** Los que van por dominio: Panda (un subdominio por biblioteca) y HubSpot (uno por región). */
export const DOMINIOS_IFRAME: readonly string[] = ['tv.pandavideo.com', 'tv.pandavideo.com.br', 'hubspot.com'];

// ── Reconocer una dirección ──────────────────────────────────────────────────

/**
 * Lo que se reconoció de una dirección: el proveedor, el id (si el proveedor tiene uno) y el `src`
 * que arma este módulo. `src: null` = es de un host de la lista pero no se pudo sacar qué mostrar
 * (una lista de YouTube, el panel de Panda): no se inserta.
 */
export type Reconocido = { proveedor: ProveedorEmbed; id: string | null; hash: string | null; src: string | null };

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un id de YouTube, de Loom o de Drive: letras, números, `_` y `-`. Nada que pueda cambiar el camino. */
const RE_ID = /^[A-Za-z0-9_-]{1,100}$/;
/** Un tramo del camino de una agenda (`/<usuario>/<evento>`). Sin `%`: nada codificado. */
const RE_TRAMO = /^[A-Za-z0-9_.~-]{1,100}$/;

/** Lo que YouTube usa en el lugar del id y NO es un video: una lista, un vivo de canal. */
const NO_SON_VIDEO_YT = new Set(['videoseries', 'live_stream']);
const HOSTS_YT = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const RE_PANDA = /^player-vz-[a-z0-9]{8}-[a-z0-9]{3}\.tv\.pandavideo\.com(?:\.br)?$/;
const RE_HUBSPOT = /^meetings(?:-[a-z0-9]{2,8})?\.hubspot\.com$/;

const idLimpio = (s: string | null | undefined): string | null => (s && RE_ID.test(s) ? s : null);

function idDeYouTube(u: URL, host: string, partes: string[], vuelta = 0): string | null {
  if (host === 'youtu.be') return idLimpio(partes[0]);
  const conV = u.searchParams.get('v');
  const id = conV != null ? conV : (['embed', 'shorts', 'live', 'v', 'e'].includes(partes[0] ?? '') ? partes[1] ?? null : null);
  if (id != null) return id && !NO_SON_VIDEO_YT.has(id) ? idLimpio(id) : null;
  // El link de «Compartir» de algunas apps: `/attribution_link?u=/watch?v=<id>`. Una vuelta, no más.
  if (partes[0] === 'attribution_link' && vuelta === 0) {
    const dentro = u.searchParams.get('u');
    if (dentro && dentro.startsWith('/')) {
      try {
        const d = new URL(dentro, 'https://www.youtube.com');
        if (d.hostname === 'www.youtube.com') return idDeYouTube(d, d.hostname, d.pathname.split('/').filter(Boolean), 1);
      } catch { /* no era un camino */ }
    }
  }
  return null;
}

/** Una agenda: `https://<host>/<tramo>[/<tramo>…]`, con 1 a `max` tramos válidos. `null` = no. */
function caminoDeAgenda(partes: string[], max: number): string | null {
  if (!partes.length || partes.length > max) return null;
  if (!partes.every((p) => RE_TRAMO.test(p) && p !== '.' && p !== '..')) return null;
  return partes.join('/');
}

/**
 * Reconoce una dirección ya parseada (http o https: el que decide si http vale es quien llama). `null`
 * = el host no es de la lista. Con usuario, clave o puerto, tampoco: `https://calendly.com@evil.tld`
 * tiene el host `evil.tld`, y uno con puerto no es el servicio de siempre.
 */
export function reconocerUrl(u: URL): Reconocido | null {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const partes = u.pathname.split('/').filter(Boolean);
  const r = (proveedor: ProveedorEmbed, id: string | null, src: string | null, hash: string | null = null): Reconocido => ({ proveedor, id, hash, src });

  if (host === 'youtu.be' || HOSTS_YT.has(host)) {
    const id = idDeYouTube(u, host, partes);
    // `?rel=0`: al terminar, videos del mismo canal y no de cualquiera.
    return r('youtube', id, id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null);
  }
  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    // El id es el número que sigue a `video`/`videos` (un showcase trae ANTES su propio número:
    // `/showcase/1234/video/5678`); si no hay, el primer número del camino.
    let i = partes.findIndex((p, k) => k > 0 && /^\d{1,15}$/.test(p) && (partes[k - 1] === 'video' || partes[k - 1] === 'videos'));
    if (i < 0) i = partes.findIndex((p) => /^\d{1,15}$/.test(p));
    const id = i >= 0 ? partes[i] : null;
    // El hash de un video NO LISTADO: sin él, el reproductor contesta «este video no existe».
    const crudo = u.searchParams.get('h') ?? (i >= 0 ? partes[i + 1] ?? null : null);
    const hash = crudo && /^[0-9a-f]{6,40}$/i.test(crudo) ? crudo : null;
    return r('vimeo', id, id ? `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}` : null, hash);
  }
  if (host === 'loom.com' || host === 'www.loom.com') {
    const tramo = ['share', 'embed'].includes(partes[0] ?? '') ? partes[1] ?? '' : '';
    // Un link nuevo de Loom puede traer el título adelante (`/share/Mi-clase-<32 hex>`): el id es el final.
    const id = /([0-9a-f]{32})$/.exec(tramo)?.[1] ?? idLimpio(tramo);
    return r('loom', id, id ? `https://www.loom.com/embed/${id}` : null);
  }
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    // `/file/d/<id>`, `/file/u/0/d/<id>` (otra cuenta logueada) y `/a/<dominio>/file/d/<id>`; y en Drive,
    // `?id=` (`/open?id=`, `/uc?id=`). Una carpeta no es un video.
    const m = /^\/(?:a\/[^/]+\/)?file\/(?:u\/\d+\/)?d\/([^/]+)/.exec(u.pathname);
    let id = idLimpio(m?.[1]);
    if (!id && host === 'drive.google.com' && partes[0] !== 'drive') id = idLimpio(u.searchParams.get('id'));
    return r('drive', id, id ? `https://drive.google.com/file/d/${id}/preview` : null);
  }
  if (RE_PANDA.test(host)) {
    // El reproductor de Panda: `https://player-vz-<biblioteca>.tv.pandavideo.com[.br]/embed/?v=<uuid>`.
    // ⚠️ EL LINK DEL PANEL DE PANDA NO SIRVE: no trae la biblioteca (`vz-…`), y sin ella no hay
    //    reproductor. Ése no entra a esta rama (otro host) y `porQueNoSeInserta` pide el código.
    const v = u.searchParams.get('v');
    const id = (partes[0] === 'embed' && partes.length === 1) && v && RE_UUID.test(v) ? v.toLowerCase() : null;
    return r('panda', id, id ? `https://${host}/embed/?v=${id}` : null);
  }
  if (host === 'fast.wistia.net' || host === 'fast.wistia.com' || /^[a-z0-9-]{1,63}\.wistia\.com$/.test(host)) {
    // `/embed/iframe/<id>`, `/embed/medias/<id>[.jsonp]` y el link para compartir `/medias/<id>`.
    const crudo = partes[0] === 'embed' && (partes[1] === 'iframe' || partes[1] === 'medias') ? partes[2] : partes[0] === 'medias' ? partes[1] : null;
    const id = crudo ? /^([a-z0-9]{10})(?:\.jsonp)?$/.exec(crudo)?.[1] ?? null : null;
    return r('wistia', id, id ? `https://fast.wistia.net/embed/iframe/${id}` : null);
  }
  if (host === 'iframe.mediadelivery.net' || host === 'player.mediadelivery.net' || host === 'video.bunnycdn.com') {
    // `/embed/<biblioteca>/<uuid>` y el de compartir `/play/<biblioteca>/<uuid>`.
    const ok = (partes[0] === 'embed' || partes[0] === 'play') && partes.length === 3 && /^\d{1,10}$/.test(partes[1]) && RE_UUID.test(partes[2]);
    const id = ok ? `${partes[1]}/${partes[2].toLowerCase()}` : null;
    return r('bunny', id, id ? `https://iframe.mediadelivery.net/embed/${id}` : null);
  }
  if (host === 'calendly.com' || host === 'www.calendly.com') {
    const c = caminoDeAgenda(partes, 3);
    return r('calendly', c, c ? `https://calendly.com/${c}` : null);
  }
  if (host === 'cal.com' || host === 'www.cal.com' || host === 'app.cal.com' || host === 'i.cal.com') {
    const c = caminoDeAgenda(partes, 3);
    return r('calcom', c, c ? `https://cal.com/${c}` : null);
  }
  if (host === 'calendar.google.com') {
    // Las «citas» de Google Calendar: lo que trae su código para insertar (`…?gv=true`).
    const m = /^\/calendar\/(?:u\/\d+\/)?appointments\/(schedules\/)?([A-Za-z0-9_-]{8,300})\/?$/.exec(u.pathname);
    const id = m ? `${m[1] ?? ''}${m[2]}` : null;
    return r('google', id, id ? `https://calendar.google.com/calendar/appointments/${id}?gv=true` : null);
  }
  if (host === 'tidycal.com') {
    const c = caminoDeAgenda(partes, 2);
    return r('tidycal', c, c ? `https://tidycal.com/${c}` : null);
  }
  if (RE_HUBSPOT.test(host)) {
    const c = caminoDeAgenda(partes, 2);
    return r('hubspot', c, c ? `https://${host}/${c}?embed=true` : null);
  }
  return null;
}

// ── De un texto (un link o un código) a una dirección ────────────────────────

const ENTIDADES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#38': '&', '#x26': '&', '#34': '"', '#39': "'" };
/** Las entidades que traen los códigos pegados adentro de un atributo (`&amp;` de Vimeo). */
const decodificar = (s: string) => s.replace(/&(amp|quot|apos|lt|gt|#38|#x26|#34|#39);/gi, (_t, e: string) => ENTIDADES[e.toLowerCase()] ?? _t);

/** El valor de un atributo en un código pegado: con comillas dobles, simples o sin comillas. */
function atributo(codigo: string, re: RegExp): string | null {
  const m = re.exec(codigo);
  if (!m) return null;
  const v = m[2] ?? m[3] ?? m[4] ?? '';
  return v ? decodificar(v.trim()) : null;
}

/**
 * La dirección que trae un CÓDIGO para insertar. En orden: el `src` del primer `<iframe>`; el
 * `data-url` de Calendly o el `data-src` de HubSpot (`<div class="calendly-inline-widget" data-url=…>`);
 * el `data-path` de TidyCal; el `calLink` de Cal.com. ⚠️ Lo que se saca es SÓLO una dirección, y pasa
 * por la lista blanca igual que un link pegado: de un código nunca viaja un `<script>`, un `style` ni
 * otro atributo.
 */
function direccionDeCodigo(codigo: string): string | null {
  const src = atributo(codigo, /<iframe\b[^>]*?\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  if (src) return src;
  const data = atributo(codigo, /\sdata-(?:url|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  if (data) return data;
  if (/tidycal/i.test(codigo)) {
    const p = atributo(codigo, /\sdata-path\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
    if (p) return `https://tidycal.com/${p.replace(/^\/+/, '')}`;
  }
  if (/cal\.com/i.test(codigo)) {
    const m = /calLink\s*:\s*["']([^"']{1,200})["']/.exec(codigo);
    if (m) return `https://cal.com/${m[1].replace(/^\/+/, '')}`;
  }
  return null;
}

/** El tope de lo que se lee de un texto pegado: un código de Vimeo son ~600 caracteres. */
const TOPE_TEXTO = 5000;

/**
 * La dirección que hay en lo que se pegó: un link (y si llega sin `https://` y parece un dominio, se
 * le pone, como en `linkValido`) o la que trae un código. `null` = no hay una.
 */
export function direccionDeTexto(texto: string | null | undefined): string | null {
  const t = (texto ?? '').trim();
  if (!t || t.length > TOPE_TEXTO) return null;
  if (t.includes('<')) return direccionDeCodigo(t);
  if (/\s/.test(t)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i.test(t) ? `https://${t}` : null;
}

/**
 * El `height` de un código pegado (`height="700"` o `height:700px`), si lo trae en px. Un `100%` (el
 * `<div>` de Cal.com) no es un alto: ahí va el de su proveedor.
 */
function altoDeCodigo(texto: string): number | null {
  if (!texto.includes('<')) return null;
  const m = /\sheight\s*=\s*["']?(\d{2,4})(?![\d%.])/i.exec(texto) ?? /height\s*:\s*(\d{2,4})px/i.exec(texto);
  return m ? Number(m[1]) : null;
}

/**
 * Lo que se INSERTA en un texto: un video o una agenda, desde un link o su código. `null` = no se puede
 * (no es https, no es de la lista, o no se sacó qué mostrar). El `src` lo arma este módulo y el alto
 * de una agenda sale de la lista cerrada (el del código, o el de su proveedor).
 */
export function embedDe(texto: string): Embed | null {
  if (typeof texto !== 'string') return null;
  const dir = direccionDeTexto(texto);
  if (!dir) return null;
  let u: URL;
  try { u = new URL(dir); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const r = reconocerUrl(u);
  if (!r || !r.src) return null;
  const f = ficha(r.proveedor);
  if (f.clase !== 'agenda') return { src: r.src, proveedor: r.proveedor };
  const delCodigo = altoDeCodigo(texto);
  return { src: r.src, proveedor: r.proveedor, alto: delCodigo ? altoValido(delCodigo) : (f.alto ?? 700) };
}

// ── Lo que dice el reproductor de Panda ──────────────────────────────────────

/**
 * Un mensaje del reproductor de Panda (postMessage), leído. MEDIDO el 08/10/2026 en Chrome contra un
 * video real (scratchpad video/panda-probe*.mjs), cuatro corridas:
 *   · `panda_allData` trae `playerData.duration`: 0 al principio y > 0 a ~1,5 s de cargar, SIN que
 *     nadie le dé play (con `autoplay=false`: 3 de 4 mensajes, 101,25 s). Es lo único que la trae.
 *   · `panda_timeupdate` trae `currentTime` y NO la duración — el gotcha de docs/hallazgos-landing.md
 *     («panda_timeupdate sin duration»), que dejó muerta la retención del VSL un mes.
 *   · `panda_pause` y `panda_ended`, con su `currentTime`.
 *   · `isMutedIndicator: true` = la vista previa MUDA que arranca sola (el «autoplay inteligente» de la
 *     cuenta): 31 de 31 avances con el video arrancado solo y nadie tocándolo; con un clic a los 6 s, 19
 *     mudos antes y 34 con sonido después; con `autoplay=false` y un clic, 0 de 34. Eso no es alguien
 *     mirando, y contarlo marcaría como vista una clase que sólo se abrió.
 * `duracion` / `avance` / `corte` (pausa o fin: el reporte manda en el acto). `null` = otro mensaje.
 */
export type LecturaPanda = { tipo: 'duracion'; seg: number } | { tipo: 'avance'; seg: number } | { tipo: 'corte'; seg: number | null };

export function lecturaDePanda(data: unknown): LecturaPanda | null {
  let d: unknown = data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return null; } }
  if (!d || typeof d !== 'object') return null;
  const o = d as { message?: unknown; currentTime?: unknown; isMutedIndicator?: unknown; playerData?: { duration?: unknown } };
  const seg = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  if (o.message === 'panda_allData') {
    const dur = seg(o.playerData?.duration);
    return dur && dur > 0 ? { tipo: 'duracion', seg: dur } : null;
  }
  if (o.message === 'panda_timeupdate') {
    const t = seg(o.currentTime);
    return t != null && o.isMutedIndicator !== true ? { tipo: 'avance', seg: t } : null;
  }
  if (o.message === 'panda_pause' || o.message === 'panda_ended') {
    return { tipo: 'corte', seg: o.isMutedIndicator === true ? null : seg(o.currentTime) };
  }
  return null;
}

/**
 * El `src` del reproductor de Panda para una CLASE: con `autoplay=false`. Medido: sin el parámetro, un
 * video con el autoplay de la cuenta prendido arranca solo y mudo a ~1,6 s; con él, no arranca hasta el
 * clic (y la duración llega igual). Una clase que arranca sola en el editor y en el portal no es lo que
 * nadie pidió, y su vista previa muda no es alguien mirando.
 */
export function srcDePandaParaClase(src: string): string {
  try {
    const u = new URL(src);
    u.searchParams.set('autoplay', 'false');
    return u.toString();
  } catch { return src; }
}

/**
 * El embed de un `<iframe>` ya parseado (sus atributos): el `src` por `embedDe`, y el alto de una
 * agenda desde `data-alto` (si es uno de la lista), si no el `height` que trajo pegado (llevado a la
 * lista), si no el de su proveedor. Lo usan el saneo del server y el editor al LEER un iframe: con dos
 * reglas, el editor escribiría un alto y el server guardaría otro, y el documento se recargaría.
 */
export function embedDeIframe(a: { src?: unknown; 'data-alto'?: unknown; height?: unknown }): Embed | null {
  const e = embedDe(typeof a.src === 'string' ? a.src : '');
  if (!e) return null;
  if (e.alto == null) return e;
  const h = typeof a.height === 'string' ? a.height.trim() : '';
  const alto = altoDeEmbed(a['data-alto']) ?? (/^\d{2,4}$/.test(h) ? altoValido(Number(h)) : null) ?? e.alto;
  return { ...e, alto };
}

/** Los hosts que SON del proveedor pero cuyo link no alcanza: hay que pegar el código. */
const PIDEN_CODIGO: Array<{ re: RegExp; proveedor: ProveedorEmbed }> = [
  { re: /(^|\.)pandavideo\.com(\.br)?$/, proveedor: 'panda' },
  { re: /^calendar\.app\.google$/, proveedor: 'google' },
];

/** ¿Este link es de un proveedor de la lista pero NO alcanza para mostrarlo (el panel de Panda)? */
export function pideCodigo(u: URL): ProveedorEmbed | null {
  const host = u.hostname.toLowerCase();
  for (const p of PIDEN_CODIGO) if (p.re.test(host)) return p.proveedor;
  return null;
}

/**
 * Por qué no se puede insertar lo que se pegó, en una frase corta (lo que dice el campo en rojo). Sólo
 * tiene sentido cuando `embedDe` dio `null`.
 */
export function porQueNoSeInserta(texto: string | null | undefined): string {
  if (!(texto ?? '').trim()) return 'Pega un link o un código.';
  const dir = direccionDeTexto(texto);
  if (!dir) return (texto ?? '').includes('<') ? 'Ese código no trae un link.' : 'Ese link no es válido.';
  let u: URL;
  try { u = new URL(dir); } catch { return 'Ese link no es válido.'; }
  if (u.protocol === 'http:') return 'El link tiene que ser https.';
  if (u.protocol !== 'https:') return 'Ese link no es válido.';
  const pide = pideCodigo(u);
  if (pide) return `De ${ficha(pide).nombre}, pega su código para insertar.`;
  const r = reconocerUrl(u);
  if (r && !r.src) return `Ese link de ${ficha(r.proveedor).nombre} no es ${ficha(r.proveedor).clase === 'agenda' ? 'una agenda' : 'un video'}.`;
  return 'Ese sitio no se puede insertar.';
}
