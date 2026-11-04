// =============================================================================
// Mandar un trabajo desde la caja de escribir — lo comparten la computadora y el teléfono
// =============================================================================
// Martín (15/10/2026): «NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas». La caja vive
// abajo de cada conversación (app/admin/operaciones/Conversacion.tsx y app/m/operaciones/ChatsMovil.tsx), y las
// dos mandan por acá: un solo camino que firma, una sola regla de qué se firma.
//
// ⚠️ SIN 'use client' A PROPÓSITO: son hooks que sólo importan componentes de cliente, y así el teléfono los usa
// sin llevarse una pantalla de escritorio entera (AGENTS.md → MaKo Mobile).
// ⚠️ LA FIRMA NO SE TOCA: el texto se arma con `armarFirmable`, se firma en ESTE dispositivo con una clave que no
// se puede exportar, y el servidor lo guarda tal cual (docs/diseno-centro-de-operaciones.md §3.1). El cartero de
// la PC decide si la acepta.

import { useCallback, useEffect, useState } from 'react';
import { MAX_NOMBRE_ADJUNTO, MAX_TEXTO, MIMES_ADJUNTO, armarFirmable, mimeDeArchivoCentro, nuevoPayload, type AdjuntoPedido, type Alcance, type Esfuerzo, type MimeAdjunto, type Modelo, type VozDelPedido } from '@/lib/operaciones-reglas';
import { ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import { copiarTexto } from '@/lib/copiar-texto';
import { TEXTO_SOLO_ADJUNTOS } from '@/lib/centro-caja';
import { AVISO_CLAVE_EN_EL_CENTRO, hayClave } from '@/lib/claves-en-el-chat';
import { encolarPedidoAction } from './acciones';
import { claveDelDispositivo, crearClaveDelDispositivo, firmar, type ClaveDispositivo } from './clave-dispositivo';
import { ERROR_SUBIDA, porQueFallo } from './leer-adjunto';

/** A quién va: la SESIÓN del chat (nunca su título: se repiten entre cuentas). */
/** `tope`: el largo que acepta el Runner de esa cuenta (useCentro.ts → topeDe); sin él, el de siempre (MAX_TEXTO). */
export type DestinoTrabajo = { sesion: string; cuenta: string | null; titulo: string; tope?: number };

export type ResultadoMandar = { ok: true; id: string; creado: string } | { ok: false; error: string };
/** El modelo y el esfuerzo con los que tiene que correr el chat (null = «Automático»: no se tocan). Van firmados. */
export type ComoCorre = { modelo?: Modelo | null; esfuerzo?: Esfuerzo | null };

export function useFirma(sub: string) {
  // undefined = todavía no se leyó; null = este dispositivo no tiene clave.
  const [clave, setClave] = useState<ClaveDispositivo | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    claveDelDispositivo(sub).then((c) => { if (vivo) setClave(c); });
    return () => { vivo = false; };
  }, [sub]);

  const crear = useCallback(async (): Promise<ClaveDispositivo | null> => {
    try {
      const c = await crearClaveDelDispositivo(sub);
      setClave(c);
      return c;
    } catch {
      return null;
    }
  }, [sub]);

  /** `voz`: lo que se manda es la transcripción de una nota de voz (26/10/2026). Va firmado; la PC entrega el texto igual. */
  const mandar = useCallback(async (d: DestinoTrabajo, texto: string, alcance: Alcance, como: ComoCorre = {}, adjuntos: readonly AdjuntoPedido[] = [], voz: VozDelPedido | null = null): Promise<ResultadoMandar> => {
    const antes = problemaAntesDeMandar(!!clave, texto, adjuntos.length > 0, d.tope);
    if (antes || !clave) return { ok: false, error: antes ?? 'Crea tu Token para comenzar a chatear' };
    try {
      const payload = nuevoPayload({
        id: crypto.randomUUID(), texto: texto.trim() || TEXTO_SOLO_ADJUNTOS, destino: d.sesion, cuenta: d.cuenta, titulo: d.titulo, alcance,
        modelo: como.modelo ?? null, esfuerzo: como.esfuerzo ?? null, adjuntos, voz,
      }, Date.now());
      const firmado = armarFirmable(payload);
      const firma = await firmar(clave, firmado);
      const r = await encolarPedidoAction({ firmado, firma, clavePublica: clave.spki });
      return r.ok ? { ok: true, id: r.id, creado: payload.creado } : { ok: false, error: r.error };
    } catch (e) {
      return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pude firmarlo: vuelve a mandarlo' };
    }
  }, [clave]);

  return { clave, crear, mandar };
}

/**
 * Lo que se sabe ANTES de subir y de firmar nada (27/10/2026): el mensaje se dibuja en el acto y sale por detrás
 * (envios-en-curso.ts), así que lo que ya se sabe que no sale se dice en el acto, y la caja no se vacía. null = puede salir.
 */
export function problemaAntesDeMandar(conClave: boolean, texto: string, conAdjuntos: boolean, tope: number = MAX_TEXTO): string | null {
  if (!conClave) return 'Crea tu Token para comenzar a chatear';
  if (!texto.trim() && !conAdjuntos) return 'Escribe algo para mandarlo';
  // Un tope en un texto que escribe una persona RECHAZA, no recorta (AGENTS.md).
  if (texto.length > tope) return `Acórtalo a ${tope} caracteres para mandarlo`;
  // Una clave pegada NO SALE (22/10/2026): lo firmado se guarda tal cual en el pedido y en lo que sube el cartero.
  if (hayClave(texto)) return AVISO_CLAVE_EN_EL_CENTRO;
  return null;
}

/** El texto de un trabajo que sólo lleva adjuntos: vive en lib/centro-caja.ts (la burbuja no lo muestra, como WhatsApp). */
export { TEXTO_SOLO_ADJUNTOS };

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Sube los archivos de la caja (17/10/2026) y devuelve lo que se FIRMA con el trabajo: el `ref` que dio MaKo, y el tamaño y
 * el sha256 que calculó ESTE navegador sobre lo que subió. Si MaKo dice otra cosa, no se firma: la PC baja sólo lo que
 * coincide con lo firmado (lib/operaciones-reglas.ts, «Los adjuntos de un trabajo»).
 */
export async function subirAdjuntos(
  archivos: readonly File[],
  /** El Runner tiene la 1.16.0: cada archivo sube DIRECTO al storage (`subirDirecto`), sin el tope de 4 MB de Vercel. */
  grandes = false,
): Promise<{ ok: true; adjuntos: AdjuntoPedido[] } | { ok: false; error: string }> {
  if (grandes) return subirDirecto(archivos);
  const fallo = { ok: false as const, error: 'No pude subir los adjuntos: vuelve a mandarlo' };
  try {
    // Cada falla dice la suya (ticket #8, 25/10/2026): el genérico de abajo queda para lo que no se esperaba.
    const propios: { bytes: number; sha256: string }[] = [];
    for (const f of archivos) {
      try { propios.push({ bytes: f.size, sha256: hex(await crypto.subtle.digest('SHA-256', await f.arrayBuffer())) }); }
      catch { return { ok: false, error: ERROR_SUBIDA.leer(f.name) }; }
    }
    const fd = new FormData();
    for (const f of archivos) fd.append('adjuntos', f, f.name);
    let r: Response;
    try { r = await fetch('/api/operaciones/adjuntos', { method: 'POST', body: fd, signal: AbortSignal.timeout(120_000) }); }
    catch { return { ok: false, error: ERROR_SUBIDA.red }; }
    // El 413 de Vercel es TEXTO PLANO: se lee como texto antes de parsear.
    if (r.status === 413) return { ok: false, error: ERROR_ADJUNTO.pesado };
    let o: { ok?: boolean; error?: string; adjuntos?: AdjuntoPedido[] } = {};
    try { o = JSON.parse(await r.text()); } catch { return { ok: false, error: ERROR_SUBIDA.servidor(r.status) }; }
    if (!r.ok || !o.ok) return { ok: false, error: o.error || ERROR_SUBIDA.servidor(r.status) };
    const suyos = o.adjuntos;
    if (!Array.isArray(suyos) || suyos.length !== archivos.length) return { ok: false, error: ERROR_SUBIDA.servidor(r.status) };
    if (suyos.some((a, i) => a.sha256 !== propios[i].sha256 || a.bytes !== propios[i].bytes)) return { ok: false, error: 'Un adjunto llegó distinto: vuelve a mandarlo' };
    return { ok: true, adjuntos: suyos.map((a, i) => ({ ref: a.ref, nombre: a.nombre, mime: a.mime, bytes: propios[i].bytes, sha256: propios[i].sha256 })) };
  } catch (e) {
    // Lo que no se esperaba dice qué fue (27/10/2026): leer, la red o su nombre (leer-adjunto.ts → porQueFallo).
    return { ok: false, error: porQueFallo(e) || fallo.error };
  }
}

/**
 * Los archivos grandes (18/10/2026, Martín: «quita esa limitación» de los 4 MB): MaKo da una URL firmada por archivo y el
 * navegador lo sube DIRECTO al storage (una ruta de Vercel no deja pasar más de ~4,5 MB). El tipo sale de los BYTES (como
 * los mira la PC) y el sha256 lo calcula este navegador: es lo que se firma, y lo que la PC compara al bajarlo.
 */
async function subirDirecto(archivos: readonly File[]): Promise<{ ok: true; adjuntos: AdjuntoPedido[] } | { ok: false; error: string }> {
  const fallo = { ok: false as const, error: 'No pude subir los adjuntos: vuelve a mandarlo' };
  try {
    const propios: { nombre: string; mime: MimeAdjunto; bytes: number; sha256: string }[] = [];
    for (const f of archivos) {
      // `<ArrayBuffer>`: crypto.subtle.digest pide un BufferSource respaldado por un ArrayBuffer, y el `Uint8Array` pelado de
      // TypeScript 5.7+ es `<ArrayBufferLike>` (podría ser un SharedArrayBuffer): el chequeo de tipos entero lo frenaba.
      let b: Uint8Array<ArrayBuffer>;
      try { b = new Uint8Array(await f.arrayBuffer()); } catch { return { ok: false, error: ERROR_SUBIDA.leer(f.name) }; }
      const mime = mimeDeArchivoCentro(b, f.name);
      if (!mime || !(MIMES_ADJUNTO as readonly string[]).includes(mime)) return { ok: false, error: 'Solo fotos, PDF, Word, Excel, PowerPoint o texto.' };
      const nombre = f.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NOMBRE_ADJUNTO) || 'adjunto';
      propios.push({ nombre, mime: mime as MimeAdjunto, bytes: b.byteLength, sha256: hex(await crypto.subtle.digest('SHA-256', b)) });
    }
    let r: Response;
    try {
      r = await fetch('/api/operaciones/adjuntos', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({ archivos: propios.map(({ nombre, mime, bytes }) => ({ nombre, mime, bytes })) }),
      });
    } catch { return { ok: false, error: ERROR_SUBIDA.red }; }
    let o: { ok?: boolean; error?: string; subidas?: { ref: string; url: string }[] } = {};
    try { o = JSON.parse(await r.text()); } catch { return { ok: false, error: ERROR_SUBIDA.servidor(r.status) }; }
    if (!r.ok || !o.ok || !Array.isArray(o.subidas) || o.subidas.length !== archivos.length) return { ok: false, error: o.error || ERROR_SUBIDA.servidor(r.status) };
    const subidas = o.subidas;
    // De a uno: un minuto, más uno por cada 100 KB (un archivo grande por una conexión lenta entra).
    for (const [i, f] of archivos.entries()) {
      let s: Response;
      try {
        s = await fetch(subidas[i].url, {
          method: 'PUT', body: f, headers: { 'content-type': propios[i].mime, 'x-upsert': 'false' },
          signal: AbortSignal.timeout(60_000 + Math.ceil(f.size / 100_000) * 1000),
        });
      } catch { return { ok: false, error: ERROR_SUBIDA.red }; }
      if (!s.ok) return { ok: false, error: ERROR_SUBIDA.almacen(propios[i].nombre, s.status) };
    }
    return { ok: true, adjuntos: propios.map((p, i) => ({ ref: subidas[i].ref, ...p })) };
  } catch (e) {
    return { ok: false, error: porQueFallo(e) || fallo.error };
  }
}

/** Copiar al portapapeles sin romper si el navegador no deja (http, permisos): el camino de lib/copiar-texto.ts (ticket #36). */
export const copiar = copiarTexto;
