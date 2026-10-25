// =============================================================================
// botones-social — los BOTONES de un mensaje de Instagram o Messenger, como los de ManyChat (24/10/2026)
// =============================================================================
// Martín (trabajo 49ff20a3, con la captura de un DM de Fiesta Music que trae «Obtener recurso»): «Aun no arreglaste lo
// de los botones en Automations de Instagram». Un chat le había dicho que «MaKo no tiene botones en los DM de Instagram»,
// y era MaKo el que no los tenía: Zernio los expone (https://zernio.com/openapi.yaml v1.352.0, medido el 24/10/2026):
//   · `buttons` en POST /v1/inbox/conversations/{id}/messages y en la respuesta privada a un comentario: 1 a 3, `postback`
//     o `url`, título de hasta 20; salen como la plantilla de botones de Meta (una burbuja con el texto y los botones
//     abajo), así que el texto va de hasta 640 caracteres;
//   · el toque llega en el webhook `message.received` como `metadata.postbackPayload` (y `postbackTitle`), y abre la
//     ventana de 24 h: por eso ManyChat manda primero «Obtener recurso» y DESPUÉS el link.
//
// EL FLUJO QUE COPIA (el de ManyChat, el que Martín quiere para Fiesta Music, trabajo 36c79085):
//   comenta la palabra → DM con «Obtener recurso» → al tocarlo, «¿Te sigue?» → sí: el link · no: «Seguinos» con
//   «Ya te sigo» → al tocarlo, «¿Te sigue?» otra vez → el link.
// Acá: un botón «de flujo» (sin `url`) es una SALIDA de la tarjeta, como una fila de una condición: el toque mueve la
// inscripción a su `siguiente` (`tocarBoton`, lib/nutricion.ts). Un botón con `url` abre la página y no mueve nada.
//
// ⚠️ LA TRAMPA DE META (doc de Zernio, private-reply): algunas cuentas de Instagram RECHAZAN los botones en la respuesta
// privada a quien no sigue (código 2, subcode 1545133), y el intento GASTA la única respuesta de ese comentario. Lo
// que dice Zernio: en una cuenta afectada, mandar texto plano y sumar los botones cuando la persona contesta. Por eso:
// una cuenta que ya rechazó una vez queda anotada y su respuesta privada sale en texto con «Escríbeme «…»»
// (`invitacionPorTexto`), y escribir el título de un botón cuenta como tocarlo (`botonPorTexto`).
//
// PURO: lo usan el grafo, el motor, el webhook, el lienzo y los tests.
// =============================================================================

/** Un botón de una tarjeta de mensaje social. Sin `url`, es de FLUJO: `siguiente` es a dónde lleva tocarlo. */
export type BotonSocial = { id: string; titulo: string; url?: string | null; siguiente?: string | null };

/** Lo que Zernio recibe (la misma forma en el DM y en la respuesta privada). */
export type BotonZernio = { type: 'postback'; title: string; payload: string } | { type: 'url'; title: string; url: string };

/** Meta: hasta 3 botones por mensaje, título de hasta 20, y el texto de una burbuja con botones hasta 640. */
export const TOPE_BOTONES = 3;
export const TOPE_TITULO_BOTON = 20;
export const TOPE_TEXTO_CON_BOTONES = 640;

/** El prefijo de lo que MaKo pone en un botón: lo que no empieza así es de otra herramienta y no se toca. */
export const PREFIJO_PAYLOAD = 'mako:b:';

/** El puerto de un botón en el grafo (como `par:<id>` para una flecha en paralelo). */
export const PREFIJO_PUERTO_BOTON = 'btn:';
export const puertoDeBoton = (id: string): string => `${PREFIJO_PUERTO_BOTON}${id}`;
export const botonDePuerto = (puerto: string): string | null => (puerto.startsWith(PREFIJO_PUERTO_BOTON) ? puerto.slice(PREFIJO_PUERTO_BOTON.length) || null : null);

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const idValido = (v: unknown): string | null => { const s = str(v); return /^[A-Za-z0-9_-]{1,24}$/.test(s) ? s : null; };

/** ¿Es una URL que Meta puede abrir? Sólo http(s), con host. */
export function urlValida(v: unknown): boolean {
  const s = str(v);
  if (!s) return false;
  try { const u = new URL(s); return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname; } catch { return false; }
}

/**
 * LOS BOTONES DE UN PASO, saneados: con id único, el título recortado a 20, y el `siguiente` sólo en los de flujo. Lo
 * que no es una lista o no tiene título se cae. NO corta a 3: eso lo dice `problemasDeBotones` (un cuarto botón se
 * avisa, no se pierde en silencio). `existe`: los ids de las tarjetas, para soltar la flecha a una que ya no está.
 */
export function botonesDe(p: { botones?: unknown } | null | undefined, existe?: ReadonlySet<string>): BotonSocial[] {
  const lista = Array.isArray(p?.botones) ? (p!.botones as unknown[]) : [];
  const vistos = new Set<string>();
  const out: BotonSocial[] = [];
  lista.forEach((x, k) => {
    const o = x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
    if (!o) return;
    const titulo = str(o.titulo).slice(0, TOPE_TITULO_BOTON);
    if (!titulo) return;
    let id = idValido(o.id) ?? `b${k + 1}`;
    let n = 2;
    while (vistos.has(id)) id = `${idValido(o.id) ?? `b${k + 1}`}_${n++}`;
    vistos.add(id);
    const url = str(o.url);
    if (url) { out.push({ id, titulo, url }); return; }
    const sig = str(o.siguiente) || null;
    out.push({ id, titulo, siguiente: sig && (!existe || existe.has(sig)) ? sig : null });
  });
  return out;
}

/** Los botones que MUEVEN el flujo (sin `url`). */
export const botonesDeFlujo = (p: { botones?: unknown } | null | undefined): BotonSocial[] => botonesDe(p).filter((b) => !b.url);

/** ¿Esta tarjeta espera un toque? (tiene al menos un botón de flujo). */
export const esperaToque = (p: { botones?: unknown } | null | undefined): boolean => botonesDeFlujo(p).length > 0;

/** El `payload` de un botón de flujo: la inscripción, la tarjeta y el botón. Zernio lo devuelve igual al tocarlo. */
export function payloadDeBoton(inscripcionId: number, nodoId: string, botonId: string): string {
  return `${PREFIJO_PAYLOAD}${inscripcionId}:${nodoId}:${botonId}`;
}

/** El `payload` leído, o null si no es uno de MaKo (o está roto). */
export function leerPayloadDeBoton(v: unknown): { inscripcionId: number; nodoId: string; botonId: string } | null {
  const s = str(v);
  if (!s.startsWith(PREFIJO_PAYLOAD)) return null;
  const [insc, nodo, boton, ...resto] = s.slice(PREFIJO_PAYLOAD.length).split(':');
  if (resto.length) return null;
  const inscripcionId = /^\d{1,15}$/.test(insc ?? '') ? Number(insc) : NaN;
  const nodoId = idValido(nodo);
  const botonId = idValido(boton);
  if (!Number.isSafeInteger(inscripcionId) || inscripcionId <= 0 || !nodoId || !botonId) return null;
  return { inscripcionId, nodoId, botonId };
}

/** Para comparar lo que escribió con el título de un botón: sin mayúsculas, acentos, signos ni espacios de más. */
export function normalizarTitulo(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * EL BOTÓN QUE ESCRIBIÓ (cuando el botón no se vio: la respuesta privada salió en texto, o la cuenta no muestra botones):
 * el de flujo cuyo título es EXACTAMENTE lo que escribió, normalizado. «Ya te sigo!!» es «Ya te sigo»; «ya te sigo hace
 * rato» no (una frase no es tocar un botón: la contesta lo de siempre).
 */
export function botonPorTexto(botones: readonly BotonSocial[], texto: string | null | undefined): BotonSocial | null {
  const t = normalizarTitulo(texto ?? '');
  if (!t) return null;
  return botones.find((b) => !b.url && normalizarTitulo(b.titulo) === t) ?? null;
}

/** Los botones como los recibe Zernio. Los de flujo llevan el `payload` de esta inscripción y esta tarjeta. */
export function aBotonesZernio(botones: readonly BotonSocial[], inscripcionId: number, nodoId: string): BotonZernio[] {
  return botones.slice(0, TOPE_BOTONES).map((b) => (b.url
    ? { type: 'url' as const, title: b.titulo, url: b.url }
    : { type: 'postback' as const, title: b.titulo, payload: payloadDeBoton(inscripcionId, nodoId, b.id) }));
}

/**
 * LA LÍNEA QUE REEMPLAZA A LOS BOTONES cuando no pueden salir (una cuenta que ya los rechazó en la respuesta privada):
 * «Escríbeme «Obtener recurso».» Sólo los de flujo: un link no se escribe. Vacío sin botones de flujo.
 */
export function invitacionPorTexto(botones: readonly BotonSocial[]): string {
  const t = botones.filter((b) => !b.url).map((b) => `«${b.titulo}»`);
  if (!t.length) return '';
  return `Escríbeme ${t.length === 1 ? t[0] : `${t.slice(0, -1).join(', ')} o ${t[t.length - 1]}`}.`;
}

/**
 * ¿Meta rechazó los botones porque la persona no sigue la cuenta? (código 2, subcode 1545133, doc de Zernio). Se mira
 * el error entero: Zernio lo dice en el mensaje y en el cuerpo, y no se fija en qué campo.
 */
export function esRechazoDeBotones(e: unknown): boolean {
  const partes: string[] = [];
  if (e instanceof Error) partes.push(e.message);
  const cuerpo = (e as { body?: unknown } | null)?.body;
  try { if (cuerpo != null) partes.push(JSON.stringify(cuerpo)); } catch { /* un cuerpo circular no es este caso */ }
  return partes.some((t) => /1545133/.test(t));
}

/**
 * LO QUE IMPIDE PUBLICAR una tarjeta con botones (los textos que muestra el lienzo). `textoFinal`: el texto de la ÚLTIMA
 * parte, que es la burbuja que lleva los botones; null si la última parte no es texto.
 */
export function problemasDeBotones(p: { canal?: string; botones?: unknown }, textoFinal: string | null, nombre: string): string[] {
  const crudos = Array.isArray(p.botones) ? (p.botones as unknown[]) : [];
  if (!crudos.length) return [];
  const err: string[] = [];
  if (p.canal !== 'instagram' && p.canal !== 'messenger') return [`${nombre}: los botones son de Instagram y Messenger`];
  const bs = botonesDe(p);
  if (bs.length < crudos.length) err.push(`${nombre}: un botón no tiene nombre`);
  if (bs.length > TOPE_BOTONES) err.push(`${nombre}: Instagram muestra hasta ${TOPE_BOTONES} botones`);
  for (const b of bs) {
    if (b.url != null && !urlValida(b.url)) err.push(`${nombre}: el link del botón «${b.titulo}» no es una dirección web`);
    if (!b.url && !b.siguiente) err.push(`${nombre}: el botón «${b.titulo}» no lleva a ninguna tarjeta`);
  }
  if (textoFinal == null) err.push(`${nombre}: los botones van debajo de un texto, y el mensaje termina en un archivo`);
  else if (!textoFinal.trim()) err.push(`${nombre}: los botones van debajo de un texto, y el mensaje no tiene`);
  else if (textoFinal.length > TOPE_TEXTO_CON_BOTONES) err.push(`${nombre}: con botones, Instagram corta el texto en ${TOPE_TEXTO_CON_BOTONES} caracteres (tiene ${textoFinal.length})`);
  return err;
}
