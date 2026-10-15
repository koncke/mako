// =============================================================================
// editor-landing/lector-firma — el server FIRMA cada lectura antes de servir la ventana (tanda 6, b)
// =============================================================================
// Verificación de la tanda 6 (seguridad, 14/10/2026). La ventana de lectura (lector-pagina.ts) sirve como
// DOCUMENTO PRINCIPAL, bajo hola-mako.com, el HTML de una página de afuera. Su guarda era que la
// navegación la iniciara una página de MaKo (`Sec-Fetch-Site: same-origin`) y que el id tuviera forma,
// pero el id lo acuñaba el navegador y el server no lo registraba: un link adentro de MaKo cuyo href
// controle otro (un dato de un lead, un mensaje) cumplía las tres cabeceras y mostraba CUALQUIER página
// con nuestra dirección arriba (el preludio hace `history.replaceState` al camino de la landing, y el
// sandbox deja mandar formularios: un login falso funcionaba).
//
// Ahora la pantalla, con la ventana ya abierta en about:blank, le pide la firma al server (un POST a la
// misma ruta, sólo desde MaKo) y recién ahí navega con `firma=<vence>.<hmac>`. La ruta no sirve nada sin
// una firma suya para ESE id, ESA URL, ESE usuario y ESE negocio, vigente (2 minutos). El prefijo
// «lector:» separa esta firma de las demás de la casa (sesión, curso, agencia).
//
// ⚠️ SIN `server-only` a propósito, como lib/curso-acceso.ts: la regla (formato, firma, vencimiento) es lo
//    que hay que poder testear. Lo que lo mantiene fuera del navegador es el `node:crypto`: lo importan la
//    ruta y el test, nunca la pantalla (ella sólo pide la firma por HTTP).
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { idLecturaValido } from './lector';

/** Cuánto vale una firma: la ventana navega a los 250 ms del clic; esto es aire para un server lento. */
export const PLAZO_FIRMA_LECTURA_MS = 120_000;

/** A quién y a qué se ata la firma. */
export type DatosFirmaLectura = { id: string; url: string; ws: number; usuario: string };

const FORMA_FIRMA = /^(\d{13})\.([A-Za-z0-9_-]{43})$/;

const hmac = (d: DatosFirmaLectura, vence: number, secreto: string): string =>
  createHmac('sha256', secreto).update(`lector:${d.ws}|${d.usuario}|${d.id}|${vence}|${d.url}`).digest('base64url');

const datosValidos = (d: DatosFirmaLectura): boolean =>
  idLecturaValido(d.id) && typeof d.url === 'string' && d.url.length > 0 && d.url.length <= 2_000
  && Number.isSafeInteger(d.ws) && d.ws > 0 && typeof d.usuario === 'string' && d.usuario.length > 0;

/** La firma de una lectura (`<vence>.<hmac>`), o null sin secreto o con datos sin forma (nunca se firma con un secreto vacío). */
export function firmarLectura(d: DatosFirmaLectura, ahora: number, secreto: string | null | undefined = process.env.AUTH_SECRET): string | null {
  if (!secreto?.trim() || !datosValidos(d) || !Number.isFinite(ahora)) return null;
  const vence = Math.trunc(ahora) + PLAZO_FIRMA_LECTURA_MS;
  return `${vence}.${hmac(d, vence, secreto)}`;
}

/** ¿La firma es nuestra, para ESTOS datos y vigente? Nunca tira. */
export function firmaLecturaValida(
  firma: string | null | undefined,
  d: DatosFirmaLectura,
  ahora: number,
  secreto: string | null | undefined = process.env.AUTH_SECRET,
): boolean {
  if (!firma || firma.length > 80 || !secreto?.trim() || !datosValidos(d)) return false;
  const m = FORMA_FIRMA.exec(firma);
  if (!m) return false;
  const vence = Number(m[1]);
  // Vencida, o con un vencimiento más lejos que el plazo (una firma que no salió de `firmarLectura`).
  if (!(vence > ahora) || vence - ahora > PLAZO_FIRMA_LECTURA_MS) return false;
  const a = Buffer.from(m[2]);
  const b = Buffer.from(hmac(d, vence, secreto));
  return a.length === b.length && timingSafeEqual(a, b);
}
