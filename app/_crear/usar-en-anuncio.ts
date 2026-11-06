// =============================================================================
// «Usar en un anuncio» desde un editor de Create o el AI Avatar — el lado del navegador (6/11/2026)
// =============================================================================
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md, [30:17] y [31:25]). Va al lado de «Publicar en
// redes» (app/calendario/publicar-desde-crear.ts) y tiene su misma forma: la pieza exportada se SUBE y se navega a una página
// donde se termina de armar. Acá la página es /anuncio/nuevo, que la propone como campaña por la API de MaKo
// (`proponer_crear_campana`); lanzarla sigue pidiendo la confirmación de una persona en /mako/revisar.
//   · un archivo (la imagen o el video que exportó el editor) → el staging de anuncios, por la firma de
//     /api/anuncio-desde-pieza (la misma de «Subir creativos»), con su progreso;
//   · un video que MaKo ya generó (el AI Avatar) → no se sube: viaja su plan y su toma, y la página los resuelve.
//
// ⚠️ Sin 'use client' y sin React: lo importa también el diálogo de exportar del Image Editor, que no es 'use client' y no
//    puede importar un VALOR de uno (tests/frontera-use-client.test.ts). Navega con `window.location` y el `?ws=` de la
//    pestaña (lib/ws-tab.ts), como «Publicar en redes» en ese mismo diálogo.
// =============================================================================

import { subirConProgreso } from '@/app/customer-success/curso/subir-video';
import { conWs, wsDeBusqueda } from '@/lib/ws-tab';
import { rutaUsarEnAnuncio, type CreativoDePieza, type OrigenPieza } from '@/lib/anuncio-desde-pieza';

export type ResultadoUsarEnAnuncio = { ok: true; url: string } | { ok: false; error: string };

/** Los mismos topes que «Subir creativos» (app/ads-manager/creativeUpload.ts → limiteCreativo): lo que Zernio le pasa a Meta. */
const MAX_MB = { video: 512, imagen: 30 } as const;

/**
 * Sube un archivo al staging de anuncios (la firma de /api/anuncio-desde-pieza, la misma de «Subir creativos»). Lo usan los
 * editores al tocar «Usar en un anuncio» y la página /anuncio/nuevo cuando la pieza no trae video (un guion del Copywriter).
 */
export async function subirPiezaAlStaging(blob: Blob, nombreArchivo: string | undefined, onProgreso: (pct: number) => void = () => {}):
  Promise<{ ok: true; path: string; media: 'imagen' | 'video' } | { ok: false; error: string }> {
  const media = (blob.type || '').startsWith('video') ? 'video' : 'imagen';
  if (blob.size > MAX_MB[media] * 1024 * 1024) return { ok: false, error: `Pasa del máximo de un anuncio (${MAX_MB[media]} MB).` };
  const nombre = nombreArchivo || (media === 'video' ? 'video.mp4' : 'imagen.png');
  let f: { ok?: boolean; path?: string; signedUrl?: string; apikey?: string | null; error?: string } | null = null;
  try {
    const r = await fetch('/api/anuncio-desde-pieza', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'firmar', nombre }) });
    f = await r.json().catch(() => null);
  } catch {
    return { ok: false, error: 'No pude preparar la subida. Revisa tu conexión.' };
  }
  if (!f?.ok || !f.path || !f.signedUrl) return { ok: false, error: f?.error || 'No pude preparar la subida.' };
  const archivo = blob instanceof File ? blob : new File([blob], nombre, { type: blob.type });
  try {
    await subirConProgreso(f.signedUrl, archivo, f.apikey ?? null, onProgreso, 'JPG, PNG, WEBP o MP4').promesa;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo subir.' };
  }
  return { ok: true, path: f.path, media };
}

/**
 * Sube la pieza exportada (o no sube nada, si es un video de MaKo) y devuelve la dirección de /anuncio/nuevo. No navega: quien
 * llama cierra su diálogo primero y después `irAUsarEnAnuncio`.
 */
export async function prepararUsarEnAnuncio(p: {
  origen: OrigenPieza;
  titulo?: string | null;
  texto?: string | null;
  archivo?: Blob | null;
  nombre?: string;
  creativo?: Extract<CreativoDePieza, { tipo: 'toma' | 'generado' }> | null;
  onProgreso?: (pct: number) => void;
}): Promise<ResultadoUsarEnAnuncio> {
  let creativo: CreativoDePieza | null = p.creativo ?? null;
  if (p.archivo) {
    const s = await subirPiezaAlStaging(p.archivo, p.nombre, p.onProgreso);
    if (!s.ok) return s;
    creativo = { tipo: 'archivo', path: s.path, media: s.media };
  }
  return { ok: true, url: rutaUsarEnAnuncio({ origen: p.origen, titulo: p.titulo, texto: p.texto, creativo }) };
}

/** Va a /anuncio/nuevo con el `?ws=` de la pestaña (quien mira a un cliente sigue en ese cliente). */
export function irAUsarEnAnuncio(url: string): void {
  window.location.assign(conWs(url, wsDeBusqueda(window.location.search)));
}
