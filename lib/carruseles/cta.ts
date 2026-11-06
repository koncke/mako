// =============================================================================
// carruseles/cta — ¿el carrusel pide «Comenta X palabra»? Sin IA, con una regla probada (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «Filtro "CTA": identifica los carruseles que piden "Comenta X palabra", que son los que publican los
// dueños de negocio; muchos de los actuales son sólo virales». Es el embudo de los dueños: el que comenta la palabra recibe
// el recurso por mensaje (ManyChat y compañía), y eso es lo que un negocio de MaKo quiere copiar.
//
// QUÉ CUENTA COMO CTA: un pedido de COMENTAR (o mandar por mensaje) UNA palabra concreta. Se reconoce porque:
//   · la palabra va entre comillas («GUÍA», "plan", 'AI'), o
//   · va en MAYÚSCULAS (GUIA, SYSTEM) y el texto no está todo en mayúsculas, o
//   · va después de «la palabra» / «the word», o
//   · después viene la promesa de mandarla («y te la envío», «para recibir», «and I'll send you»).
// Y por mensaje: «Escríbeme CITA por DM», «DM me "GROW"» (va como `via: 'mensaje'`).
//
// QUÉ NO CUENTA: «Comenta tu opinión», «comenta abajo qué piensas», «comment below», «Comenta 🔥 si te sirvió»: piden
// interacción, no una palabra que dispara un envío. Un emoji cuenta sólo con la promesa al lado («Comenta 🔥 y te lo paso»).
//
// La palabra se devuelve COMO LA ESCRIBIÓ (con su tilde, en mayúsculas): se lee sobre el texto sin tildes (para que la regla
// sea una sola) y se corta del original en las mismas posiciones (sacar una tilde no cambia el largo en estos caracteres).
// Gana la ÚLTIMA que aparece: el pedido va al final del pie.
//
// Lo usan el explorador (./explorar.ts: el filtro y el chip de la tarjeta), la biblioteca al leer y al reclasificar
// (./biblioteca.ts, el script de la PC) y la API (`buscar_carruseles` con `cta`). Lo prueba tests/carruseles-cta.test.ts.
// =============================================================================

export type CtaCarrusel = {
  /** La palabra que pide, como la escribió (sin comillas): «GUÍA», «AI», «🔥». */
  palabra: string;
  /** Por dónde la pide: en los comentarios o por mensaje directo. */
  via: 'comentario' | 'mensaje';
};

export const VIAS_CTA = ['comentario', 'mensaje'] as const;
export const esViaCta = (v: unknown): v is CtaCarrusel['via'] => v === 'comentario' || v === 'mensaje';

/** Sin tildes, con las mismas posiciones: «á» (un carácter) sale «a» (un carácter). */
const sinTildes = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');

/** Palabras que siguen a «comenta» y no son una palabra clave (lo de «comenta tu opinión», «comment below»). */
const NO_SON = new Set([
  'tu', 'tus', 'su', 'sus', 'si', 'que', 'cual', 'como', 'aqui', 'abajo', 'algo', 'esto', 'eso', 'este', 'esta', 'ya', 'mas', 'lo',
  'la', 'el', 'un', 'una', 'me', 'te', 'mi', 'con', 'por', 'para', 'sobre', 'cuando', 'donde', 'quien', 'opinion', 'experiencia',
  'below', 'here', 'your', 'if', 'what', 'which', 'this', 'that', 'the', 'a', 'an', 'and', 'down', 'below', 'yours', 'thoughts', 'it',
]);

/** Lo que viene después y promete mandarla: lo que separa una palabra clave de una palabra cualquiera. */
const PROMESA = /^[^.!?\n]{0,70}?(?:\by\s+te\s+(?:lo\s+|la\s+|los\s+|las\s+)?(?:envio|mando|paso|doy|regalo|comparto|escribo|dejo|llega)|\bte\s+(?:lo\s+|la\s+)?(?:envio|mando|regalo|comparto)\b|\bpara\s+(?:recibir|que\s+te|obtener|acceder|tener)|\band\s+(?:i'?ll|i\s+will|we'?ll|we\s+will)\s+(?:send|dm|share|give|message)|\bto\s+(?:get|receive|grab|unlock)\b|\bi'?ll\s+(?:send|dm)\b|\bte\s+llega\b)/i;

const ABRE = '«"\'“‘';
const CIERRA = '»"\'”’';
/** Una palabra clave: de 2 a 24 letras y números (una sola letra es un «y» o un «a»), o un emoji. */
const PALABRA = String.raw`[\p{L}\p{N}][\p{L}\p{N}_-]{1,23}|\p{Extended_Pictographic}`;

/** Los verbos de comentar, en el texto sin tildes (tú, usted, ustedes, la forma de Argentina sin tilde, e inglés). */
const COMENTA = String.raw`\b(?:comenta(?:me(?:lo)?|lo|la|r)?|comenten|comente|comment(?:s|ing)?)\b`;
/** Otros verbos que piden una palabra EN los comentarios («Escribe SÍ en los comentarios», «Drop "AI" below»). */
const OTROS = String.raw`\b(?:escrib(?:e|an|a|i)|dej(?:a|en|e)|pon(?:e|gan|ga)?|respond(?:e|an|a|i)|type|drop|leave|reply)\b`;
const EN_COMENTARIOS = /^\s*(?:en\s+(?:los\s+|el\s+)?|in\s+(?:the\s+)?|aqui\s+)?(?:comentarios?|comments?|comment\s+section)\b|^\s*(?:abajo|below)\b/i;
/** Pedirla por mensaje («Escríbeme CITA por DM», «DM me "GROW"», «Envíame la palabra AGENDA por mensaje»). */
const MENSAJE = String.raw`\b(?:escrib[ie]me|escribenos|mandame|enviame|envianos|dm(?:\s+me)?|send\s+me|message\s+me|text\s+me)\b`;
const POR_MENSAJE = /^[^.!?\n]{0,40}?\b(?:dm|md|mensaje|mensajito|inbox|privado|directo|direct|message)\b/i;

/** ¿La mayoría de las letras del texto están en mayúsculas? Entonces una palabra en mayúsculas no dice nada. */
function todoEnMayusculas(t: string): boolean {
  const letras = t.match(/\p{L}/gu) ?? [];
  if (letras.length < 12) return false;
  const mayus = letras.filter((l) => l !== l.toLowerCase() && l === l.toUpperCase()).length;
  return mayus / letras.length > 0.6;
}

const esMayuscula = (w: string): boolean => /\p{L}/u.test(w) && w === w.toUpperCase() && w !== w.toLowerCase() && [...w.replace(/[^\p{L}]/gu, '')].length >= 2;
const esEmoji = (w: string): boolean => /^\p{Extended_Pictographic}/u.test(w);

type Hallazgo = { cta: CtaCarrusel; donde: number };

/**
 * Lo que el pie pide comentar (o mandar por mensaje), o null. Ver la cabecera: qué cuenta y qué no.
 * `texto` es el pie de la publicación; puede venir el texto de la portada sumado, separado por un salto de línea.
 */
export function ctaDeTexto(texto: string | null | undefined): CtaCarrusel | null {
  const original = String(texto ?? '').normalize('NFC');
  if (!original.trim()) return null;
  const t = sinTildes(original);
  // Si quitar una tilde cambió el largo (un carácter raro), se lee igual pero la palabra sale del texto sin tildes.
  const mismaForma = t.length === original.length;
  const gritado = todoEnMayusculas(t);
  const hallados: Hallazgo[] = [];

  const evaluar = (m: RegExpExecArray, via: CtaCarrusel['via'], exigeComentarios: boolean, viaDicha = false) => {
    const abre = m.groups?.abre ?? '';
    const palabraSin = m.groups?.p ?? '';
    const despuesDeP = (m.index ?? 0) + m[0].length;
    const cierre = abre ? new RegExp(`^\\s?[${CIERRA}]`).exec(t.slice(despuesDeP)) : null;
    const resto = t.slice(despuesDeP + (cierre ? cierre[0].length : 0));
    const inicioP = despuesDeP - palabraSin.length;
    const palabra = mismaForma ? original.slice(inicioP, despuesDeP) : palabraSin;
    const base = palabraSin.toLowerCase();
    // «TU», «SI» o «ABAJO» no son una palabra clave… salvo que la destaque (comillas, o mayúsculas en un pie que no grita).
    const destacada = !!abre || (esMayuscula(palabra) && !gritado);
    if (!palabra || (NO_SON.has(base) && !destacada)) return;
    if (exigeComentarios && !EN_COMENTARIOS.test(resto)) return;
    if (via === 'mensaje' && !viaDicha && !m.groups?.dm && !POR_MENSAJE.test(resto)) return;
    const conComillas = !!cierre;
    const dicePalabra = !!m.groups?.lapalabra;
    const promete = PROMESA.test(resto);
    let es: boolean;
    if (esEmoji(palabra)) es = promete;
    else es = conComillas || dicePalabra || promete || (esMayuscula(palabra) && !gritado);
    if (!es) return;
    hallados.push({ cta: { palabra: esEmoji(palabra) ? palabra : palabra.toUpperCase(), via }, donde: m.index ?? 0 });
  };

  const objeto = String.raw`(?:(?<lapalabra>(?:la|una|el|the|this)\s+(?:palabra|word|emoji)\s*:?\s+)|(?:con\s+)?(?:(?:un|una|el|la|a|an|the)\s+)?)?(?<abre>[${ABRE}]?)\s?(?<p>${PALABRA})`;
  const reComenta = new RegExp(`${COMENTA}\\s+(?:(?:abajo|aqui|below|here)\\s+)?${objeto}`, 'giu');
  const reOtros = new RegExp(`${OTROS}\\s+${objeto}`, 'giu');
  const reMensaje = new RegExp(`(?<dm>${MENSAJE})\\s+${objeto}`, 'giu');
  for (const m of t.matchAll(reComenta)) evaluar(m as RegExpExecArray, 'comentario', false);
  for (const m of t.matchAll(reOtros)) evaluar(m as RegExpExecArray, 'comentario', true);
  for (const m of t.matchAll(reMensaje)) evaluar(m as RegExpExecArray, 'mensaje', false);
  // «Mándame un mensaje con la palabra AGENDA», «…en comentarios la palabra GUÍA»: «la palabra X» suelta, y por dónde la
  // pide lo dice la misma oración (sin ninguno de los dos, no se sabe qué se pide y no cuenta).
  const reLaPalabra = new RegExp(String.raw`\b(?<lapalabra>(?:la|the)\s+(?:palabra|word)\s*:?\s+)(?<abre>[${ABRE}]?)\s?(?<p>${PALABRA})`, 'giu');
  for (const m of t.matchAll(reLaPalabra)) {
    const i = m.index ?? 0;
    const inicio = Math.max(0, t.lastIndexOf('\n', i), t.lastIndexOf('.', i - 1) + 1);
    const oracion = t.slice(inicio, i + m[0].length + 60).toLowerCase();
    const via = /\b(?:dm|md|mensaje|inbox|privado|directo|direct|message)\b/.test(oracion) ? 'mensaje'
      : /\b(?:coment|comment)/.test(oracion) ? 'comentario' : null;
    if (via) evaluar(m as RegExpExecArray, via, false, true);
  }
  if (!hallados.length) return null;
  hallados.sort((a, b) => a.donde - b.donde);
  return hallados[hallados.length - 1].cta;
}

/** Cómo se lee en la tarjeta: «Comenta «GUÍA»» o «Por DM: «CITA»». */
export function rotuloCta(c: CtaCarrusel): string {
  return c.via === 'mensaje' ? `Por mensaje: «${c.palabra}»` : `Comenta «${c.palabra}»`;
}

/** La palabra guardada en la base (0404: `cta`, `cta_via`), saneada: lo roto es null. */
export function ctaGuardado(palabra: unknown, via: unknown): CtaCarrusel | null {
  if (typeof palabra !== 'string') return null;
  const p = palabra.replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!p) return null;
  return { palabra: p, via: esViaCta(via) ? via : 'comentario' };
}
