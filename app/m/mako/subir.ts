'use client';

// =============================================================================
// /m/mako — achicar una foto y subirla con progreso (sólo navegador)
// =============================================================================
// ⚠️ FETCH NO DA PROGRESO DE SUBIDA (AGENTS.md, «Tres topes del entorno»): una barra
// alimentada por un `fetch` salta de 0 a 100. Por eso el multipart va por XMLHttpRequest.
//
// ⚠️ Y XMLHttpRequest NO PASA POR EL PARCHE DE WsFetch: el `?ws=` que el parche le pega a
// todo `fetch` a /api acá no llega solo. La URL la arma quien llama con
// `conWs('/api/m/mako', useWs())`. Sin eso, un super admin mirando a un cliente le habla al
// MaKo de SU workspace con la foto del cliente.
//
// ⚠️ La foto se achica ANTES de subirla: Vercel corta todo POST de más de ~4,5 MB con un 413
// en texto plano, y una foto de cámara de teléfono pesa 3-8 MB.
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

export type RespuestaXhr = { status: number; texto: string };

/**
 * POST multipart con progreso de subida. Nunca tira: la red caída o el corte por tiempo
 * vuelven como `status: 0` (y quien lee decide que NO se reintenta a ciegas).
 *
 * @param alSubir   0..1 mientras salen los bytes
 * @param alTerminarSubida  los bytes ya salieron: de ahí en más espera a MaKo
 */
export function postConProgreso(
  url: string,
  cuerpo: FormData,
  { alSubir, alTerminarSubida, timeoutMs }: { alSubir: (p: number) => void; alTerminarSubida: () => void; timeoutMs: number },
): Promise<RespuestaXhr> {
  return new Promise((resolver) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.timeout = timeoutMs;
    x.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) alSubir(e.loaded / e.total); };
    x.upload.onload = () => { alSubir(1); alTerminarSubida(); };
    x.onload = () => resolver({ status: x.status, texto: x.responseText ?? '' });
    x.onerror = () => resolver({ status: 0, texto: '' });
    x.ontimeout = () => resolver({ status: 0, texto: '' });
    x.onabort = () => resolver({ status: 0, texto: '' });
    x.send(cuerpo);
  });
}
