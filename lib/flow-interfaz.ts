// =============================================================================
// El motor por INTERFAZ, del lado del servidor
// =============================================================================
// Desde la extensión 0.69.0, generar video, generar imagen y subir la foto se
// hacen apretando los botones reales de Flow en la pestaña del cliente
// (`extension/flow-interfaz.js`), y no repitiendo un pedido de BOQ aprendido.
// El porqué completo está en la cabecera de ese archivo y en
// docs/hallazgos-generativa.md → «El motor por interfaz reemplaza al replay de BOQ».
//
// Este módulo es el contrato del lado de MaKo: qué extensión lo tiene, qué lleva
// el pedido, cómo se lee lo que vuelve y qué ruta de Storage se puede firmar.
//
// SIN `server-only`: lo importan el route del puente, las actions y los tests.

import { esMasVieja } from './version-comparar';

/** La primera versión de la extensión con el motor por interfaz. */
export const MOTOR_INTERFAZ_DESDE = '0.69.0';

/**
 * ¿Esta extensión genera por interfaz?
 *
 * ⚠️ SE DECIDE POR LA VERSIÓN QUE REPORTÓ EL ÚLTIMO LATIDO, y una sin versión es
 * vieja. Mandarle un pedido de interfaz a una 0.68 lo hace morir sin `path` ni
 * plantilla; mandarle uno de BOQ a una 0.69 lo hace pasar por el camino que se
 * dejó de usar. Las dos formas no viajan juntas: la foto pesa megas y duplicarla
 * en cada trabajo es pagar dos veces el mismo dato en la base.
 */
export function usaInterfaz(version: string | null | undefined): boolean {
  const v = String(version || '').trim();
  if (!/^\d+(\.\d+)*$/.test(v)) return false;
  return !esMasVieja(v, MOTOR_INTERFAZ_DESDE);
}

/**
 * El techo de créditos que una generación puede costar. Flow cotiza el precio en
 * el panel de ajustes ANTES de generar, y el motor no aprieta si lo pasa.
 *
 * Video: Omni a 720p cuesta 7/10/12/15 créditos por 4/6/8/10 s (medido por flow-mcp
 * el 19/09/2026). Imagen: 0 — si Flow empieza a cobrarlas, se frena y se dice, en
 * vez de gastar plata de la persona sin que nadie lo haya decidido.
 */
export const TOPE_CREDITOS = Object.freeze({ video: 15, imagen: 0 });

/** Las duraciones que ofrece Flow para el modelo con referencias. Se redondea para arriba. */
const DURACIONES = [4, 6, 8, 10] as const;
export function segundosDeFlow(s: number): number {
  const n = Number(s) || 8;
  return DURACIONES.find((d) => d >= n) ?? 10;
}

/** Cómo se llama en el menú de Flow el modelo que anima con referencias. */
export const MODELO_VIDEO_INTERFAZ = 'Omni';

/**
 * Dónde queda el medio en Storage. La firma de subida la acuña el route del
 * puente AL ENTREGAR el trabajo (una firma acuñada al encolar puede vencer en la
 * cola), y sólo para rutas con esta forma.
 */
export const RUTA_SUBIDA = /^video-generator\/[A-Za-z0-9_-]{1,80}\/(toma|escena)-\d{1,3}-[0-9a-f-]{36}\.(mp4|jpg)$/;

export function rutaDeSubida(planId: string, cual: 'toma' | 'escena', n: number, uuid: string): string {
  const plan = String(planId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return `video-generator/${plan}/${cual}-${n}-${uuid}.${cual === 'toma' ? 'mp4' : 'jpg'}`;
}

export function pedidoClipInterfaz(p: {
  prompt: string;
  mediaId: string;
  segundos: number;
  vertical?: boolean;
  ruta: string;
}): Record<string, unknown> {
  return {
    motor: 'interfaz',
    prompt: p.prompt,
    // La cara: un medio que YA está en el proyecto de Flow. Sin ella no se genera.
    referencias: [p.mediaId],
    segundos: segundosDeFlow(p.segundos),
    vertical: p.vertical !== false,
    modelo: MODELO_VIDEO_INTERFAZ,
    maxCreditos: TOPE_CREDITOS.video,
    ruta: p.ruta,
  };
}

export function pedidoImagenInterfaz(p: {
  prompt: string;
  cara: string;
  vertical?: boolean;
  ruta: string;
}): Record<string, unknown> {
  return {
    motor: 'interfaz',
    prompt: p.prompt,
    referencias: p.cara ? [p.cara] : [],
    vertical: p.vertical !== false,
    maxCreditos: TOPE_CREDITOS.imagen,
    ruta: p.ruta,
  };
}

export function pedidoSubidaInterfaz(p: { imagenB64: string; mime: string; fotoId: string }): Record<string, unknown> {
  return { motor: 'interfaz', imagenB64: p.imagenB64, mime: p.mime, fotoId: p.fotoId };
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Lo que devolvió la extensión por un `generar_clip` de interfaz, o `null` si el
 * resultado no es de interfaz (un trabajo viejo, de BOQ).
 *
 * `propio` dice si la url ya es de NUESTRO Storage (la pestaña bajó el archivo con
 * su sesión y lo subió con la firma). Si no lo es, es la url que mostraba Flow, y
 * el servidor intenta bajarla él.
 */
export function clipDeInterfaz(resultado: unknown): { mediaId: string; url: string; propio: boolean } | null {
  const r = obj(resultado);
  if (r.motor !== 'interfaz') return null;
  return { mediaId: str(r.mediaId), url: str(r.url), propio: r.propio === true };
}

/** La operación con la que se sigue una toma de interfaz cuyo archivo todavía no se pudo traer. */
export const PREFIJO_OPERACION_INTERFAZ = 'interfaz:';
