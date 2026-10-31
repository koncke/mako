'use client';

// =============================================================================
// creativeUpload — la subida de un creativo al STAGING (la usa «Subir creativos» del Media Buyer)
// =============================================================================
// El navegador sube directo a Supabase Storage (URL firmada de /api/ads-manager/creative-signurl) para esquivar el límite de
// body del serverless; el servidor le da a Zernio una URL firmada del archivo (lib/media-buyer/subir.ts).
//
// ⚠️ Hasta el 27/10/2026 este archivo era la subida del Ads Manager viejo entera: subir a Meta (`creative-upload`), esperar
// a que Meta procese el video, «Mis creativos» de MaKo (`mis-creativos`), las claves de idempotencia de publicar y las
// miniaturas. La vista que los llamaba se borró el 25/10 y sus rutas el 27/10 (docs/hallazgos-ads.md → «Las rutas viejas de
// app/api/ads-manager»): queda sólo lo que usa el Media Buyer.
// =============================================================================

/** Por qué este archivo no se puede subir, o null. Se pregunta ANTES de agregarlo a la
 *  bandeja: una tarjeta que aparece y desaparece se lee como un error de la subida. */
export function limiteCreativo(file: File): string | null {
  const esVideo = file.type.startsWith('video');
  const maxMb = esVideo ? 512 : 30;
  return file.size > maxMb * 1024 * 1024 ? `"${file.name}" supera el máximo (${maxMb} MB).` : null;
}

// PUT del archivo a la URL firmada de Supabase con progreso (multipart + apikey).
// `fetch` NO expone el progreso de SUBIDA: hace falta xhr.upload.onprogress (AGENTS.md,
// «Tres topes del entorno»). Topea en 99: el 100 lo pone quien llama al terminar.
function putWithProgress(url: string, file: File, apikey: string | null, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('x-upsert', 'true');
    if (apikey) { xhr.setRequestHeader('apikey', apikey); xhr.setRequestHeader('authorization', `Bearer ${apikey}`); }
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detalle = (xhr.responseText || '').replace(/\s+/g, ' ').slice(0, 200);
      try { const j = JSON.parse(xhr.responseText); detalle = String(j.message || j.error || detalle); } catch { /* texto plano */ }
      if (xhr.status === 413 || /too large|maximum allowed size|exceeded/i.test(detalle)) {
        return reject(new Error('El archivo supera el límite de Supabase Storage. Súbelo en Supabase → Storage → Settings → "Upload file size limit".'));
      }
      reject(new Error(`No se pudo subir el archivo (HTTP ${xhr.status})${detalle ? ` — ${detalle}` : ''}`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir el archivo.'));
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', file);
    xhr.send(fd);
  });
}

/**
 * SÓLO la subida al staging (la URL firmada y el PUT con progreso), sin pasar por Meta: la usa el Media Buyer, que publica
 * por la Zernio del negocio (lib/media-buyer/subir.ts) y le da a Zernio la URL firmada del archivo.
 */
export async function subirAlStaging(file: File, onProgress: (pct: number) => void): Promise<{ path: string }> {
  const tope = limiteCreativo(file);
  if (tope) throw new Error(tope);
  const s = await fetch('/api/ads-manager/creative-signurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, content_type: file.type }) });
  const sj = await s.json().catch(() => null);
  if (!sj?.ok || typeof sj.path !== 'string') throw new Error(sj?.error || 'No se pudo preparar la subida');
  await putWithProgress(sj.signedUrl, file, sj.apikey ?? null, onProgress);
  onProgress(100);
  return { path: sj.path };
}
