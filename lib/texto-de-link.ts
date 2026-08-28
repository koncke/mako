// =============================================================================
// texto-de-link — el texto que hay detrás de una URL que pegó el usuario
// =============================================================================
// SIN `server-only` para la parte que TRANSFORMA la url; el fetch vive abajo y sí
// es de server. La transformación necesita test: decide qué se le pide a Google, y
// si se equivoca el síntoma no es un error — es un texto plausible que no es el
// documento.
//
// ⚠️ La descarga usa `validarDestino` de lib/landing-fetch.ts, que es la baranda
// SSRF del repo: bloquea loopback, privadas, link-local y CGNAT, revalida en CADA
// redirect y clava la conexión a las IPs ya validadas (DNS rebinding). NO se
// escribe un `fetch` a una URL del usuario sin pasar por ahí.

/** Cómo se resolvió el link, para poder explicarlo cuando algo sale raro. */
export type TipoLink = 'google-docs' | 'google-drive' | 'texto-plano' | 'web';

export type LinkResuelto = {
  /** La URL que hay que pedir de verdad. Puede no ser la que pegó el usuario. */
  url: string;
  tipo: TipoLink;
  /** Qué avisarle si el resultado puede no ser lo que espera. */
  nota?: string;
};

const RE_DOCS = /^https?:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i;
const RE_DRIVE = /^https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i;
const RE_DRIVE_OPEN = /^https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i;

/**
 * Traduce el link que pegó el usuario al que de verdad devuelve el contenido.
 *
 * ⚠️ ESTO ES LO QUE HACE QUE UN LINK DE GOOGLE DOCS FUNCIONE. Pedir la URL que
 * uno copia de la barra devuelve el HTML de la APLICACIÓN —el editor, con su
 * JavaScript— y no el documento. Y falla de la peor manera: contesta 200, trae
 * kilobytes de texto, y ninguno es el guion. Sin esta traducción, pegar un Doc
 * cargaría basura con cara de haber funcionado.
 *
 * Google publica un endpoint de exportación que devuelve el texto plano, y es el
 * mismo que usa el botón «Descargar como .txt».
 */
export function resolverLink(crudo: string): LinkResuelto {
  const s = crudo.trim();

  const doc = RE_DOCS.exec(s);
  if (doc) {
    return {
      url: `https://docs.google.com/document/d/${doc[1]}/export?format=txt`,
      tipo: 'google-docs',
      // El documento tiene que ser legible por cualquiera con el link. Uno privado
      // devuelve la pantalla de login, que es HTML válido y no dice «no tenés
      // permiso» en ningún lado que un parser vea.
      nota: 'El documento tiene que estar compartido como «cualquiera con el enlace».',
    };
  }

  const drive = RE_DRIVE.exec(s) ?? RE_DRIVE_OPEN.exec(s);
  if (drive) {
    return {
      url: `https://drive.google.com/uc?export=download&id=${drive[1]}`,
      tipo: 'google-drive',
      nota: 'El archivo tiene que estar compartido como «cualquiera con el enlace».',
    };
  }

  // Un .md, un .txt o un raw de GitHub ya vienen en texto: no hay que sacarles
  // etiquetas y hacerlo los rompería.
  if (/\.(md|markdown|txt|text)(\?|#|$)/i.test(s) || /raw\.githubusercontent\.com/i.test(s)) {
    return { url: s, tipo: 'texto-plano' };
  }

  return { url: s, tipo: 'web' };
}

/**
 * Saca el texto de un HTML.
 *
 * El orden importa: `script`, `style` y `noscript` se borran ENTEROS —contenido
 * incluido— antes de quitar las etiquetas. Al revés, el código JavaScript de la
 * página quedaría como si fuera texto del documento.
 */
export function htmlATexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Los saltos de bloque se conservan: sin esto, los párrafos de un guion se
    // pegan en una sola línea y el separador pierde toda estructura.
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * ¿Lo que volvió es una pantalla de login en vez del documento?
 *
 * Un Google Doc privado NO devuelve 403: devuelve 200 con la pantalla de acceso.
 * Sin esta comprobación, el usuario vería «cargué tu documento» sobre el HTML de
 * un formulario de login — y el error aparecería recién al mirar los guiones.
 */
export function pareceLogin(texto: string, tipo: TipoLink): boolean {
  if (tipo === 'web') return false;
  const t = texto.slice(0, 1500).toLowerCase();
  return /iniciar sesión|sign in|accounts\.google\.com|solicitar acceso|request access|necesitas acceso|you need access/.test(t);
}
