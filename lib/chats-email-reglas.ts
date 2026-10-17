// =============================================================================
// chats-email-reglas — lo puro del canal EMAIL de Chats (17/10/2026)
// =============================================================================
// Martín: «eliminar las tabs de "Email y WhatsApp" y unificarlo todo en "Chats"... que todo funcione bien». El email es
// un canal más de la bandeja: lo que llega (el webhook de Resend, lib/email-entrante.ts) y lo que se contesta desde el
// composer (/api/chats/email). Lo que toca la base y Resend vive en lib/chats-email.ts; acá, las reglas, con su test.
//
// Puro y sin `server-only`: lo usan el servidor, la pantalla y los tests.

/** Un email, normalizado: minúsculas, sin espacios ni `<>`, con UNA arroba y un dominio con punto. */
export function normalizarEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /<([^>]+)>/.exec(v);
  const s = (m ? m[1] : v).trim().toLowerCase();
  if (s.length < 3 || s.length > 320) return null;
  const at = s.indexOf('@');
  if (at < 1 || at !== s.lastIndexOf('@')) return null;
  const dom = s.slice(at + 1);
  // La parte local con los caracteres de RFC 5322 (atext y puntos): sin comillas, comas, paréntesis ni barras. Además de
  // ser lo que un email real trae, es lo que hace segura a la dirección en una clave y en un filtro de la base.
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(s.slice(0, at)) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dom)) return null;
  return s;
}

/**
 * El texto de un email que llegó SÓLO en HTML (sin parte de texto): sin etiquetas, con los saltos donde había `<br>`,
 * `<p>` o `<div>`, y las entidades básicas resueltas. No es un renderer: es lo que se lee en una burbuja.
 */
export function textoDeHtml(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** «Re: <asunto>» una sola vez, aunque el asunto ya venga con «Re:», «RE:» o «Fwd:» delante. */
export function asuntoDeRespuesta(asunto: string | null | undefined): string {
  const limpio = (asunto ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!limpio) return 'Re:';
  return /^re\s*:/i.test(limpio) ? limpio.slice(0, 300) : `Re: ${limpio}`.slice(0, 300);
}

/**
 * Lo que el contacto ESCRIBIÓ, sin la cita del email anterior. Un cliente de correo pega todo el hilo abajo («El jue,
 * 16 oct … escribió:», «On … wrote:», las líneas con «>»), y en una burbuja de chat eso es ruido: cada respuesta
 * repetiría la conversación entera. Se corta en la PRIMERA marca de cita; si no queda nada (sólo era una cita), se
 * devuelve el texto entero, que es mejor que una burbuja vacía.
 */
export function sinCita(texto: string | null | undefined): string {
  const t = (texto ?? '').replace(/\r\n/g, '\n');
  const lineas = t.split('\n');
  const corte = lineas.findIndex((l, i) =>
    /^\s*>/.test(l)
    || /^\s*(el|on)\s.+(escribió|wrote)\s*:\s*$/i.test(l)
    || /^\s*-{2,}\s*(original message|mensaje original)\s*-{2,}\s*$/i.test(l)
    || (/^\s*(de|from)\s*:/i.test(l) && i > 0 && /^\s*$/.test(lineas[i - 1] ?? '')));
  const cuerpo = (corte >= 0 ? lineas.slice(0, corte) : lineas).join('\n').trim();
  return cuerpo || t.trim();
}

/** El HTML de un email que se escribió como texto: escapado, con sus saltos de línea. */
export function htmlDeTexto(texto: string): string {
  const esc = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${esc.replace(/\n/g, '<br>')}</div>`;
}

/** Los encabezados del hilo de una respuesta: el `Message-ID` del último que llegó (sin él, un email nuevo). */
export function encabezadosDeRespuesta(messageId: string | null | undefined): Record<string, string> | undefined {
  const id = (messageId ?? '').trim();
  if (!id || id.length > 300 || /[\r\n]/.test(id)) return undefined;
  const conAngulos = id.startsWith('<') ? id : `<${id}>`;
  return { 'In-Reply-To': conAngulos, References: conAngulos };
}

/** Los topes de un adjunto: los de WhatsApp de la bandeja (4 MB por archivo) y hasta 5 por email. */
export const TOPE_ADJUNTO_EMAIL = 4 * 1024 * 1024;
export const MAX_ADJUNTOS_EMAIL = 5;
/** Lo que se guarda de un adjunto que LLEGA: más grande que esto, queda nombrado pero no se baja. */
export const TOPE_ADJUNTO_ENTRANTE = 10 * 1024 * 1024;

/** Un nombre de archivo que se puede usar como ruta del bucket: sin barras ni caracteres raros. */
export function nombreDeArchivo(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  const limpio = s.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').replace(/^[.-]+/, '').slice(0, 120);
  return limpio || 'archivo';
}
