'use client';

// =============================================================================
// El Image Editor contra la base: los pedidos a /api/image-editor/*
// =============================================================================
// Etapa 2 del plano (docs/diseno-editor-imagen.md, decisión 4): los diseños y «Subidos» viven en
// Supabase (mig 0278), no en el navegador. El contrato con las rutas es lib/image-editor/tipos.ts.
// El `?ws=` de la pestaña lo agrega `WsFetch` a todo fetch a /api (app/_components/WsFetch.tsx).
//
// SUBIR un archivo, en tres pasos (molde: app/web-generator/editor/subir.ts):
//   1. `firmar`: el server valida tipo y tamaño y devuelve una URL firmada del bucket.
//   2. el NAVEGADOR sube directo con XHR (`subirConProgreso`): el archivo nunca pasa por una
//      función de Vercel, que corta el cuerpo en ~4,5 MB sin avisar.
//   3. `registrar`: el server mira los magic bytes, lo muda a su lugar y lo anota en «Subidos».
//
// ⚠️ El bucket no acepta SVG ni AVIF (un SVG es un documento activo, ver la mig 0278): esos se
// dibujan a PNG en el navegador ANTES de subir (`aRaster`). El SVG pierde lo vectorial; Canva lo
// mantiene, y es lo que queda en hallazgos-editor-imagen.md.

import { subirConProgreso } from '@/app/customer-success/curso/subir-video';
import type {
  Falla, PedidoCrear, PedidoGuardar, RespCrear, RespDiseno, RespFirmar, RespGuardar, RespLista, RespMiniatura,
  RespOk, RespRegistrar, RespSubidos, Subido,
} from '@/lib/image-editor/tipos';

const BASE = '/api/image-editor';

/**
 * Un pedido a las rutas. Toda respuesta es `{ ok, … }`; lo que no tenga esa forma (un 502 con HTML
 * de la plataforma, una red caída) vuelve como falla con un texto corto, nunca como éxito.
 */
async function pedir<T extends { ok: boolean }>(url: string, init?: RequestInit & { json?: unknown }): Promise<T | Falla> {
  const { json, ...resto } = init ?? {};
  const opciones: RequestInit = json === undefined ? resto : { ...resto, headers: { 'Content-Type': 'application/json', ...(resto.headers ?? {}) }, body: JSON.stringify(json) };
  try {
    const res = await fetch(url, { cache: 'no-store', ...opciones });
    const data: unknown = await res.json().catch(() => null);
    if (data && typeof data === 'object' && typeof (data as { ok?: unknown }).ok === 'boolean') {
      const d = data as T | Falla;
      if (!d.ok && typeof (d as Falla).error !== 'string') return { ok: false, error: `Error ${res.status}` };
      return d;
    }
    return { ok: false, error: res.ok ? 'Respuesta inválida' : `Error ${res.status}` };
  } catch {
    return { ok: false, error: 'Sin conexión. Vuelve a intentar.' };
  }
}

const enc = encodeURIComponent;

export const listarDisenos = () => pedir<RespLista>(`${BASE}/disenos`);
export const leerDiseno = (id: string) => pedir<RespDiseno>(`${BASE}/disenos/${enc(id)}`);
export const crearDiseno = (p: PedidoCrear) => pedir<RespCrear>(`${BASE}/disenos`, { method: 'POST', json: p });
export const guardarDiseno = (id: string, p: PedidoGuardar) => pedir<RespGuardar>(`${BASE}/disenos/${enc(id)}`, { method: 'PATCH', json: p });
export const borrarDiseno = (id: string) => pedir<RespOk>(`${BASE}/disenos/${enc(id)}`, { method: 'DELETE' });
export const subirMiniatura = (id: string, imagen: Blob) =>
  pedir<RespMiniatura>(`${BASE}/disenos/${enc(id)}/miniatura`, { method: 'PUT', body: imagen, headers: { 'Content-Type': imagen.type || 'image/webp' } });

export const listarSubidos = (clase: 'imagen' | 'audio' | null, q = '') =>
  pedir<RespSubidos>(`${BASE}/subidos?${new URLSearchParams({ ...(clase ? { clase } : {}), ...(q ? { q } : {}) })}`);
export const borrarSubido = (id: string) => pedir<RespOk>(`${BASE}/subidos/${enc(id)}`, { method: 'DELETE' });

/** Los tipos que el bucket acepta tal cual (lib/image-editor/reglas.ts → TIPOS_BUCKET). */
const IMAGEN_DIRECTA = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const AUDIO_POR_EXT: Readonly<Record<string, string>> = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', weba: 'audio/webm', webm: 'audio/webm', m4a: 'audio/mp4' };

/** El tipo de audio con el que se sube (el del navegador si es uno admitido; si no, el de la extensión). */
export function tipoDeAudio(f: Blob, nombre: string): string | null {
  if (Object.values(AUDIO_POR_EXT).includes(f.type)) return f.type;
  return AUDIO_POR_EXT[(nombre.split('.').pop() || '').toLowerCase()] ?? null;
}

/** Un SVG o un AVIF dibujado a PNG, al tamaño que dice (el bucket no los acepta, ver el encabezado). */
export async function aRaster(blob: Blob, ancho: number, alto: number): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const w = Math.max(1, Math.round(ancho || img.naturalWidth || 512));
    const h = Math.max(1, Math.round(alto || img.naturalHeight || 512));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    if (!png) throw new Error('No se pudo convertir la imagen.');
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Sube un archivo a «Subidos» y devuelve su fila (con la URL pública definitiva). `tipo` es el que
 * se declara al firmar; el server lo vuelve a mirar por magic bytes. Tira un Error con texto corto.
 */
export async function subirArchivo(f: Blob, d: { nombre: string; tipo: string; ancho?: number; alto?: number }): Promise<Subido> {
  const firma = await pedir<RespFirmar>(`${BASE}/subidos`, { method: 'POST', json: { accion: 'firmar', tipo: d.tipo, tamano: f.size } });
  if (!firma.ok) throw new Error(firma.error);
  // Con FormData el tipo viaja en la parte del multipart: un archivo sin `type` saldría como
  // application/octet-stream y el bucket lo rebota. Se arma con el tipo declarado.
  const archivo = new File([f], d.nombre, { type: d.tipo });
  await subirConProgreso(firma.signedUrl, archivo, firma.apikey, () => {}, 'PNG, JPG, WEBP, GIF o un audio').promesa;
  const reg = await pedir<RespRegistrar>(`${BASE}/subidos`, { method: 'POST', json: { accion: 'registrar', path: firma.path, nombre: d.nombre, ancho: d.ancho, alto: d.alto } });
  if (!reg.ok) throw new Error(reg.error);
  return reg.subido;
}

export { IMAGEN_DIRECTA };
