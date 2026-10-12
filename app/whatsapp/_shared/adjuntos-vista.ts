// =============================================================================
// adjuntos-vista — lo que decide la VISTA PREVIA de adjuntos, sin React ni DOM
// =============================================================================
// Pedido de Martín (11/10/2026), con una captura de WhatsApp Web: «Intenté subir un documento y saltó
// ese error. No se si apenas lo subí ya lo quiso analizar, eso estaría mal. Solo cuando le doy a ENVIAR
// debería... Sino, debería salir la vista previa del documento que acabo de subir, como lo tiene
// whatsapp… se ve la preview, y puedo agregar más documentos... Y aún escribir un mensaje abajo...
// Quiero que apliques este cambio no solo a offer, sino a todos los chats que consuman esto de subir
// documento.»
//
// La pantalla es `VistaAdjuntos.tsx` (al lado), la MISMA para todos los chats: ChatHilo (grupos de MaKo,
// el simulador de /automations), Offer y el chat de MaKo del teléfono. Acá vive lo que esa pantalla
// decide y un test puede EJECUTAR (tests/vista-adjuntos.test.ts):
//   · qué vista previa lleva cada archivo (imagen, video, audio, PDF o tarjeta);
//   · los textos de tamaño y de páginas («1,2 MB», «8 páginas»);
//   · qué entra a la vista y qué no (el `accept`, el tope de cada consumidor, la cantidad), y por qué no;
//   · qué miniatura queda elegida al quitar la elegida;
//   · qué hacen Enter y Escape;
//   · cómo se mandan varios en orden con el texto como pie del PRIMERO (lo usa ChatHilo).
//
// ⚠️ NADA DE ESTO SUBE NI LEE: la vista sólo junta archivos. Subir, leer o mandar lo hace quien la monta,
// recién cuando la persona aprieta Enviar. Ése era el pedido.
// ⚠️ EL TOPE DE TAMAÑO ES DE CADA CONSUMIDOR, no de la vista: ChatHilo manda por multipart y corta en
// 4 MB; Offer sube directo a Storage y corta en 25 MB (lib/formatos-archivo.ts). Un número de la vista
// por encima del de abajo prometería algo que el envío no cumple (AGENTS.md, «el entorno tiene un tope y
// tu código declara otro»).

/** Un archivo en la vista: el binario y un id estable (la miniatura elegida, el doc ya leído, el error). */
export type ItemAdjunto = { id: string; file: File };

/** Lo mínimo de un archivo que se mira para decidir (un `File` lo cumple; un test, con un objeto). */
export type ArchivoLike = { name: string; type: string; size: number };

export type TipoVista = 'imagen' | 'video' | 'audio' | 'pdf' | 'archivo';

const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'svg'];
const EXT_VIDEO = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];
const EXT_AUDIO = ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'aac', 'flac'];
/** Imágenes que un navegador común no sabe dibujar en un <img>: van como tarjeta, no como un cuadro roto. */
const IMAGEN_SIN_VISTA = ['image/heic', 'image/heif', 'image/tiff'];

/** La extensión, en minúsculas y sin el punto ('' si no tiene). */
export function extDe(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? '';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

/**
 * Qué vista previa lleva un archivo. Manda el MIME cuando lo hay; si no (un arrastre desde ciertos
 * sistemas lo trae vacío), la extensión. Lo que no se sabe dibujar es una tarjeta con ícono, nombre y
 * tamaño — nunca un cuadro roto.
 */
export function tipoDeVista(nombre: string, mime = ''): TipoVista {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  const ext = extDe(nombre);
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (m.startsWith('image/')) return IMAGEN_SIN_VISTA.includes(m) ? 'archivo' : 'imagen';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (!m || m === 'application/octet-stream') {
    if (EXT_IMAGEN.includes(ext)) return 'imagen';
    if (EXT_VIDEO.includes(ext)) return 'video';
    if (EXT_AUDIO.includes(ext)) return 'audio';
  }
  return 'archivo';
}

/** «18 B», «320 KB», «1,2 MB», «12 MB» (coma decimal, como se lee en español). */
export function textoTamano(bytes: number): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  const mb = n / (1024 * 1024);
  return mb < 10 ? `${(Math.round(mb * 10) / 10).toFixed(1).replace('.', ',')} MB` : `${Math.round(mb)} MB`;
}

/** «1 página», «8 páginas». */
export function textoPaginas(n: number): string {
  const p = Math.max(0, Math.round(n));
  return `${p} ${p === 1 ? 'página' : 'páginas'}`;
}

/** El renglón de abajo del nombre: «8 páginas · 1,2 MB» (un PDF que ya se abrió) o sólo el tamaño. */
export function detalleDeAdjunto(a: { bytes: number; paginas?: number | null }): string {
  const tam = textoTamano(a.bytes);
  return typeof a.paginas === 'number' && a.paginas > 0 ? `${textoPaginas(a.paginas)} · ${tam}` : tam;
}

/**
 * ¿El `accept` del selector deja pasar este archivo? El `accept` del navegador es una SUGERENCIA (un
 * arrastre lo saltea, y en el selector se puede elegir «Todos los archivos»), así que la vista lo vuelve a
 * mirar. Entiende las tres formas: `.pdf`, `image/*` y `application/pdf`. Sin `accept`, todo.
 */
export function aceptaSegun(accept: string | undefined, nombre: string, mime = ''): boolean {
  const reglas = (accept ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!reglas.length) return true;
  const ext = extDe(nombre);
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  return reglas.some((r) => {
    if (r.startsWith('.')) return r.slice(1) === ext;
    if (r.endsWith('/*')) return !!m && m.startsWith(r.slice(0, -1));
    return !!m && m === r;
  });
}

/** Cuántos archivos se juntan por mensaje si quien monta la vista no dice otra cosa. */
export const MAX_ADJUNTOS = 10;

export type TopesAdjuntos = {
  /** El tope de CADA archivo, en bytes (el del envío de quien monta la vista). Sin esto, sin tope. */
  maxBytes?: number;
  /** Cuántos archivos por mensaje (default `MAX_ADJUNTOS`). */
  maxArchivos?: number;
  /** El mismo `accept` del selector. */
  accept?: string;
  /** Una regla propia del consumidor (Offer: que el formato se pueda leer). Devuelve el motivo, o null. */
  validar?: (f: ArchivoLike) => string | null;
};

const mbDe = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1).replace('.', ',');
};

/**
 * Qué entra de una tanda nueva, en el orden en que llegó, y por qué no entra lo demás. Cada motivo
 * nombra el archivo: un rebote mudo deja a la persona esperando algo que nunca va a llegar. Lo que pasa
 * del tope de cantidad no se nombra uno por uno: se dice el tope.
 */
export function repartirNuevos<T extends ArchivoLike>(yaHay: number, nuevos: readonly T[], topes: TopesAdjuntos = {}): { entran: T[]; errores: string[] } {
  const max = topes.maxArchivos && topes.maxArchivos > 0 ? topes.maxArchivos : MAX_ADJUNTOS;
  const entran: T[] = [];
  const errores: string[] = [];
  let sobran = 0;
  for (const f of nuevos) {
    if (!aceptaSegun(topes.accept, f.name, f.type)) { errores.push(`«${f.name}» no se puede adjuntar aquí.`); continue; }
    const propio = topes.validar?.(f);
    if (propio) { errores.push(propio); continue; }
    if (!(f.size > 0)) { errores.push(`«${f.name}» está vacío.`); continue; }
    if (topes.maxBytes && f.size > topes.maxBytes) { errores.push(`«${f.name}» pesa más de ${mbDe(topes.maxBytes)} MB.`); continue; }
    if (yaHay + entran.length >= max) { sobran += 1; continue; }
    entran.push(f);
  }
  if (sobran) errores.push(`Puedes juntar hasta ${max} archivos.`);
  return { entran, errores };
}

let secuencia = 0;
/** Un id que no se repite en la pestaña (la vista lo usa de key y Offer, para no releer un archivo ya leído). */
export const nuevoIdAdjunto = (): string => `adj-${Date.now().toString(36)}-${(secuencia++).toString(36)}`;

/** La lista con lo nuevo agregado al final (lo que entra) y los motivos de lo que no. */
export function agregarALista(items: readonly ItemAdjunto[], archivos: readonly File[], topes: TopesAdjuntos = {}, nuevoId: () => string = nuevoIdAdjunto): { items: ItemAdjunto[]; errores: string[] } {
  const { entran, errores } = repartirNuevos(items.length, archivos, topes);
  return { items: [...items, ...entran.map((file) => ({ id: nuevoId(), file }))], errores };
}

/**
 * La miniatura que queda elegida al quitar una. Si se quitó otra, la elegida no cambia; si se quitó la
 * elegida, la que estaba a su derecha (o la de su izquierda si era la última). null = no queda ninguna.
 */
export function elegidoTrasQuitar(ids: readonly string[], elegido: string | null, quitado: string): string | null {
  const resto = ids.filter((x) => x !== quitado);
  if (elegido !== quitado && elegido != null && resto.includes(elegido)) return elegido;
  if (!resto.length) return null;
  const i = ids.indexOf(quitado);
  return resto[Math.min(Math.max(0, i), resto.length - 1)];
}

/**
 * Qué hace una tecla en la vista. Escape la cierra (descarta todo, como la ✕). Enter manda — salvo con
 * Shift (un renglón en el pie), mientras un IME compone una palabra, o con el foco en un BOTÓN (ahí
 * Enter es apretar ese botón: el «+», la ✕ de una miniatura).
 */
export function teclaDeVista(e: { key: string; shiftKey?: boolean; isComposing?: boolean; enBoton?: boolean }): 'enviar' | 'cerrar' | null {
  if (e.key === 'Escape') return 'cerrar';
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.enBoton) return null;
  return 'enviar';
}

/**
 * Manda los archivos EN ORDEN, de a uno, y el texto como pie (caption) del PRIMERO — como WhatsApp, que
 * no tiene un mensaje con varios archivos: tiene varios mensajes, y el texto va con el primero.
 *
 * Al primer fallo (devuelve false o tira) se CORTA: los que siguen no salen, y quien llama los vuelve a
 * dejar en la vista con el error. Seguir de largo dejaría la conversación con un hueco en el medio que
 * nadie pidió. `textoSalio` dice si el pie ya viajó con el primero (si el primero falló, el texto vuelve).
 */
export async function enviarEnOrden<T extends { file: { name: string } }>(
  items: readonly T[],
  texto: string,
  mandar: (item: T, caption: string | undefined, indice: number) => Promise<boolean>,
): Promise<{ enviados: T[]; faltan: T[]; textoSalio: boolean; error: string | null }> {
  const pie = texto.trim() || undefined;
  const enviados: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let ok = false;
    let detalle = '';
    try { ok = await mandar(it, i === 0 ? pie : undefined, i); } catch (e) { detalle = e instanceof Error && e.message ? ` (${e.message})` : ''; }
    if (!ok) {
      return { enviados, faltan: items.slice(i), textoSalio: i > 0, error: `No se pudo enviar «${it.file.name}»${detalle}.` };
    }
    enviados.push(it);
  }
  return { enviados, faltan: [], textoSalio: items.length > 0, error: null };
}
