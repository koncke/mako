// =============================================================================
// achicarImagen — la foto como JPEG de ~1600 px, ANTES de subirla (sólo se LLAMA en el navegador)
// =============================================================================
// ⚠️ SIN 'use client' A PROPÓSITO (17/10/2026): la importa también app/admin/operaciones/useCentro.ts, un
// hook que va sin la directiva (como mandar.ts). Para tests/frontera-use-client.test.ts, un módulo sin la
// directiva que se trae un VALOR de un 'use client' es un server que usa una referencia de cliente: el run 91
// cayó por eso. Acá no hay nada de React: la función usa Image y canvas sólo cuando se la llama.
// subir.ts la reexporta, así que sus otros llamadores no cambian.
// =============================================================================

import { medidasAchicadas } from './chat-ui';

/** Una imagen como JPEG de ~1600 px de lado mayor. Un PDF vuelve tal cual. Tira si no se
 *  pudo decodificar (un HEIC en un navegador que no lo lee): quien llama dice el motivo. */
export async function achicarImagen(f: File): Promise<File> {
  if (!f.type.startsWith('image/')) return f;
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No pude leer esa imagen.'));
      i.src = url;
    });
    const { w, h } = medidasAchicadas(img.naturalWidth, img.naturalHeight);
    if (!w || !h) throw new Error('No pude leer esa imagen.');
    const lienzo = document.createElement('canvas');
    lienzo.width = w; lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('No pude leer esa imagen.');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82));
    if (!blob) throw new Error('No pude leer esa imagen.');
    const base = (f.name || 'foto').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
