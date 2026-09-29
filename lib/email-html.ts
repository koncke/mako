// =============================================================================
// email-html — el HTML de un email de MaKo, y el ÚNICO lugar donde se arma
// =============================================================================
// Vivía adentro de lib/resend.ts, que lleva `import 'server-only'` porque ahí
// está la API key. Eso dejaba a la pantalla que PREVISUALIZA un correo sin poder
// mostrar el correo: dibujaba el texto plano en un `<div>` y el lector veía los
// `*asteriscos*` de WhatsApp que el mail real no tiene. Una previsualización que
// no muestra lo que llega no sirve para juzgar si se entiende cuando llega, que
// es lo único que hace.
//
// Acá NO va nada con `server-only`, ni transitivamente: este módulo lo importa un
// componente `'use client'` (app/perfil/BandejaEmail.tsx) y también el server.
// Es data pura y string; no lee settings, ni credenciales, ni la base.
//
// ⚠️ `tests/frontera-use-client.test.ts` sólo mira imports DIRECTOS, así que no va
// a cazar un import transitivo de un módulo server-only. Se cuida a mano: este
// archivo importa CERO módulos del repo, a propósito.
//
// ── Qué tiene que aguantar un HTML de email ──────────────────────────────────
// No es una página web: los clientes de correo (Outlook sobre todo) no soportan
// flex, grid, ni hojas externas. Lo que sí: TABLAS, estilos INLINE, ancho fijo de
// ~600px y colores en hex literal (nada de `var(--token)`, que en un mail resuelve
// a nada). Por eso los hex están escritos acá y no salen de globals.css — y por
// eso están anotados con el token del que son copia, que es lo único que permite
// darse cuenta cuando la app cambia y el mail queda viejo.

/** Los colores del mail. Copia LITERAL de app/globals.css: un `var()` no existe en un correo. */
const C = {
  fondo: '#F4F6F9',       // --bg
  tarjeta: '#FFFFFF',     // --surface
  suave: '#F5F7FA',       // --surface-2
  linea: '#EAECF1',       // --border
  tinta: '#12151B',       // --ink
  dim: '#454C57',         // --dim
  tenue: '#66707F',       // --faint
  azul: '#2F6FED',        // --primary
  mako: '#F2B01E',        // --mako
  makoTinta: '#8F6709',   // --mako-ink
  negro: '#171511',       // el fondo de la banda: el mismo de los botones oscuros de la app
};

const FUENTE = `-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif`;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Las marcas de WhatsApp (*negrita*, _itálica_, ~tachado~) a HTML.
 *
 * ⚠️ OPERA SOBRE TEXTO YA ESCAPADO, igual que `linkify`. Al revés, `escapeHtml`
 * convertiría los `<strong>` recién puestos en `&lt;strong&gt;` y el lector vería
 * las etiquetas como texto — el modo de falla más tonto y el más fácil de escribir.
 *
 * ⚠️ Y ESTO REEMPLAZA A BORRARLAS. `lib/notify.ts` pasaba el cuerpo por un
 * `sinMarcas()` de tres líneas que reemplazaba cada par de asteriscos por su
 * contenido: el mismo mensaje salía con énfasis por WhatsApp y PLANO por email, sin
 * que nadie lo hubiera decidido — lo decidió una función privada para que no se
 * vieran los asteriscos.
 *
 * (Y no se cita acá la regex que lo hacía: la secuencia que cierra un bloque de
 * comentario vive adentro de ella, así que pegarla parte el archivo al medio. Pasó
 * al escribir este mismo comentario.)
 *
 * El `[^*\n]` (y sus gemelos) es lo que impide que un asterisco suelto a principio
 * de renglón —una viñeta— se coma medio párrafo hasta encontrar el siguiente.
 */
export function marcasAHtml(escaped: string): string {
  return escaped
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/g, '$1<em>$2</em>')
    .replace(/~([^~\n]+)~/g, '<span style="text-decoration:line-through;">$1</span>');
}

/** Convierte URLs sueltas en `<a>`. Opera sobre texto YA escapado. */
export function linkify(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    // No incluir un punto/coma final pegado a la URL.
    const m = url.match(/[.,;:!?)]+$/);
    const tail = m ? m[0] : '';
    const clean = tail ? url.slice(0, -tail.length) : url;
    return `<a href="${clean}" style="color:${C.azul};text-decoration:underline;" target="_blank" rel="noopener">${clean}</a>${tail}`;
  });
}

/** Texto plano → párrafos HTML. Doble salto = párrafo nuevo; simple = `<br>`. */
export function bodyToHtml(text: string): string {
  const parags = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return parags
    .map((p) => `<p style="margin:0 0 16px;">${marcasAHtml(linkify(escapeHtml(p))).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export type RenderEmailParams = {
  subject: string;
  bodyText: string;        // cuerpo en texto plano, variables ya resueltas
  preheader?: string;      // texto de vista previa (oculto en el cuerpo)
  unsubscribeUrl?: string; // link de baja para el footer
  fromName?: string;       // firma del pie (display name del remitente del ws)
  /**
   * ⚠️ LA BANDA DE MARCA ES OPT-IN, y no se puede derivar del remitente.
   *
   * Este mismo render arma los BROADCASTS del cliente (lib/email-marketing.ts) y su
   * nutrición: esos salen firmados por SU negocio, y ponerles la banda de MaKo sería
   * meter nuestra marca adentro del mail que le manda a sus leads. Los que sí la
   * llevan son los de la PLATAFORMA — los avisos y los reportes que MaKo le manda al
   * dueño— y lo declaran pasando `marca: 'mako'`.
   *
   * No sale del `from` porque el `from` no llega hasta acá (vive en sendEmail), ni de
   * `fromName === 'MaKo'`, que un cliente puede escribir desde /integraciones.
   */
  marca?: 'mako' | 'ninguna';
  /** Título del correo dibujado ARRIBA del cuerpo. Sin esto, el mail arranca sin encabezado. */
  titulo?: string;
  /** El botón. Un aviso sin a dónde ir es un aviso que obliga a buscar la pantalla. */
  cta?: { texto: string; url: string };
};

/**
 * Un cuerpo en texto plano envuelto en un HTML que aguanta cualquier cliente de
 * correo: tablas, estilos inline, 600px y hex literales.
 *
 * ⚠️ `border="0" cellpadding="0" cellspacing="0"` va en TODAS las tablas. Sin eso,
 * Outlook mete un borde y un espaciado propios y la tarjeta sale con hendiduras
 * entre las filas — el defecto que hace que un mail se vea «armado a mano».
 */
export function renderEmailHtml(params: RenderEmailParams): string {
  const fromName = params.fromName?.trim() || '';
  const conMarca = params.marca === 'mako';

  const preheader = params.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(params.preheader)}</div>`
    : '';

  const banda = conMarca
    ? `<tr><td style="background:${C.negro};padding:18px 32px;">
        <span style="font-family:${FUENTE};font-size:17px;font-weight:700;letter-spacing:-0.01em;color:#F3F0E7;">Ma<span style="color:${C.mako};">K</span>o</span>
      </td></tr>`
    : '';

  const titulo = params.titulo
    ? `<tr><td style="padding:26px 32px 0;font-family:${FUENTE};">
        <h1 style="margin:0;font-size:21px;line-height:1.3;font-weight:600;letter-spacing:-0.015em;color:${C.tinta};">${escapeHtml(params.titulo)}</h1>
      </td></tr>`
    : '';

  // Botón «a prueba de balas»: una tabla con fondo y padding, no un <a> con display
  // block — Outlook ignora el padding de un <a> y el botón sale como un link suelto.
  const cta = params.cta
    ? `<tr><td style="padding:6px 32px 28px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${C.azul};border-radius:10px;">
            <a href="${params.cta.url}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;font-family:${FUENTE};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">${escapeHtml(params.cta.texto)}</a>
          </td>
        </tr></table>
      </td></tr>`
    : '';

  const pieMako = conMarca
    ? `<div style="margin-top:${fromName ? '10px' : '0'};color:${C.tenue};">Te lo manda MaKo porque lo tienes activado en Configuraciones › Notificaciones.</div>`
    : '';

  const unsub = params.unsubscribeUrl
    ? `<div style="margin-top:12px;font-size:12px;color:${C.tenue};">Si no quieres recibir más estos correos, <a href="${params.unsubscribeUrl}" style="color:${C.tenue};text-decoration:underline;" target="_blank" rel="noopener">darme de baja</a>.</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(params.subject)}</title>
<style>
  /*
    ADVERTENCIA: el mail es CLARO, y declarar color-scheme light no es decoracion: es
    lo que le pide al cliente de correo que NO invierta los colores por su cuenta.

    Aca hubo un bloque prefers-color-scheme dark y se fue el 29/09/2026 por las dos
    puntas. En el CORREO tenia un agujero -la fila del titulo no llevaba la clase, asi
    que el h1 se quedaba casi negro sobre la tarjeta ya oscura, ilegible- y en la
    PREVISUALIZACION era peor: el iframe hereda el modo del navegador de quien mira,
    asi que la pantalla clara de la app mostraba un rectangulo negro. El dueno lo
    reporto como «se pusieron negros los templates».

    Un modo oscuro de email se sostiene con las tres clases cubiertas Y probado en
    clientes reales (Gmail, Outlook y Apple Mail lo soportan distinto). Mientras no
    este medido, una sola version que se lee siempre le gana a dos donde una falla.

    Y no va NINGUN backtick aca adentro: esto vive dentro de un template literal, asi
    que un backtick lo cierra a la mitad. Paso al escribir este mismo comentario.
  */
  @media only screen and (max-width: 620px) {
    .mk-pad { padding-left:20px !important; padding-right:20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.fondo};">
${preheader}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:${C.fondo};padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:${C.tarjeta};border:1px solid ${C.linea};border-radius:14px;overflow:hidden;">
      ${banda}
      ${titulo}
      <tr><td class="mk-pad" style="padding:${params.titulo ? '14px' : '28px'} 32px ${cta ? '6px' : '10px'};font-family:${FUENTE};color:${C.tinta};font-size:16px;line-height:1.6;">
        ${bodyToHtml(params.bodyText)}
      </td></tr>
      ${cta}
      <tr><td class="mk-pad" style="padding:18px 32px 26px;font-family:${FUENTE};color:${C.dim};font-size:13px;line-height:1.5;border-top:1px solid ${C.linea};">
        ${fromName ? `<div style="font-weight:600;color:${C.tinta};">${escapeHtml(fromName)}</div>` : ''}
        ${pieMako}
        ${unsub}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
