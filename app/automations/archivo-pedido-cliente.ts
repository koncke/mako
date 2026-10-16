// =============================================================================
// archivo-pedido-cliente — subir el archivo o la imagen de la caja «¿Qué vas a crear hoy?» y traer su texto
// =============================================================================
// Decimoquinta tanda de Automations (12/10/2026), punto 7. Martín, textual: «en el botón de "+" en esa sección... ahí se
// debería poder cargar archivos o imagenes para que la IA lo interprete y cree flujo a raiz de eso». La ruta lo lee con
// el lector de la casa (app/api/chat-agent/secuencias/archivo/route.ts, `archivoATexto`; una imagen, por visión) y la
// caja (`BarraPideselo`, ./ChatMako.tsx) arma el pedido con `pedidoConArchivo` (./CrearConIA.tsx).
//
// ⚠️ VIVE APARTE A PROPÓSITO: ChatMako.tsx y CrearConIA.tsx no hacen `fetch` con POST (tests/automations-chat-mako.test.ts:
// el único lector del stream de MaKo es ./stream-ia.ts, y un POST en esos archivos se lee como un segundo lector).

import { validarArchivoWA, archivoConTipoWA, tituloDeArchivo, type AdjuntoDto } from '@/lib/setting-adjuntos-reglas';
import { subirConProgreso } from '../customer-success/curso/subir-video';

/** La ruta que lee el archivo (app/api/chat-agent/secuencias/archivo/route.ts) y su tope de subida. */
export const RUTA_ARCHIVO_PEDIDO = '/api/chat-agent/secuencias/archivo';
export const TOPE_ARCHIVO_BYTES = 15 * 1024 * 1024;

/**
 * SUBE EL ARCHIVO A LA BIBLIOTECA DEL NEGOCIO, SIN LEERLO (16/10/2026, lib/archivo-del-pedido.ts): es CONTENIDO del flujo
 * («dando este lead magnet»). El mismo camino que el «Subir» de los editores de mensaje (EditorMensajeWhatsApp,
 * EditorMensajeSocial): la URL firmada, el binario directo al bucket y el registro. Nunca tira: lo que falla vuelve con
 * el motivo, y la caja manda el pedido igual (`pedidoSinLeer(…, 'subir')`).
 */
export async function subirArchivoDelPedido(file: File, signal?: AbortSignal): Promise<{ ok: true; id: number; titulo: string } | { ok: false; error: string }> {
  const v = validarArchivoWA({ nombre: file.name, tipo: file.type, tamano: file.size });
  if (!v.ok) return { ok: false, error: v.error };
  const post = async (body: object) => {
    const r = await fetch('/api/chat-agent/adjuntos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    return r.json().catch(() => null) as Promise<{ ok?: boolean; error?: string; path?: string; signedUrl?: string; apikey?: string | null; adjunto?: AdjuntoDto } | null>;
  };
  try {
    const firma = await post({ action: 'subir', nombre: file.name, mime: v.mime, tamano: file.size });
    if (!firma?.ok || !firma.signedUrl || !firma.path) return { ok: false, error: firma?.error || 'No se pudo preparar la subida.' };
    const s = subirConProgreso(firma.signedUrl, archivoConTipoWA(file, v.mime), firma.apikey ?? null, () => {}, 'JPG, PNG, MP4 o PDF');
    signal?.addEventListener('abort', () => s.cancelar(), { once: true });
    await s.promesa;
    const reg = await post({ action: 'registrar', path: firma.path, nombre: file.name, titulo: tituloDeArchivo(file.name) });
    if (!reg?.ok || !reg.adjunto) return { ok: false, error: reg?.error || 'No se pudo guardar el archivo.' };
    return { ok: true, id: reg.adjunto.id, titulo: reg.adjunto.titulo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo subir el archivo.' };
  }
}

/**
 * Sube el archivo y devuelve su TEXTO (lo lee el server con `archivoATexto`; una imagen, por visión). Nunca tira: lo que
 * falla vuelve con el motivo para la caja. Con `signal` abortado, el resultado no importa (quien llama lo ignora).
 */
export async function leerArchivoParaPedido(file: File, signal?: AbortSignal): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  if (file.size > TOPE_ARCHIVO_BYTES) return { ok: false, error: 'El archivo pesa más de 15 MB.' };
  const cuerpo = new FormData();
  cuerpo.append('file', file);
  try {
    const r = await fetch(RUTA_ARCHIVO_PEDIDO, { method: 'POST', body: cuerpo, signal });
    const j = await r.json().catch(() => null) as { ok?: boolean; texto?: unknown; error?: string } | null;
    if (!j?.ok || typeof j.texto !== 'string' || !j.texto.trim()) return { ok: false, error: j?.error || 'No se pudo leer el archivo.' };
    return { ok: true, texto: j.texto };
  } catch {
    return { ok: false, error: 'Sin conexión — prueba de nuevo.' };
  }
}
