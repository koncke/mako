'use client';

// =============================================================================
// creativeUpload — helpers de subida de creativos reutilizables
// =============================================================================
// El navegador sube directo a Supabase Storage (URL firmada) para esquivar el
// límite de body del serverless; el server empuja a Meta. Lo usan los modales de
// "Agregar anuncio" y "Agregar conjunto" (mismo camino que Nueva campaña).
// =============================================================================

export type SubidoCreativo = { media_type: 'image' | 'video'; image_hash: string | null; video_id: string | null; thumbnail_url: string | null };

// PUT del archivo a la URL firmada de Supabase con progreso (multipart + apikey).
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

function fitCanvas(w: number, h: number) {
  const max = 240; const scale = Math.min(1, max / Math.max(w || max, h || max));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((w || max) * scale));
  canvas.height = Math.max(1, Math.round((h || max) * scale));
  return { canvas, ctx: canvas.getContext('2d') };
}
// Miniatura local (dataURL) para la previa en la app (NO se manda a Meta).
export function makeThumb(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (file.type.startsWith('image')) {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => { const { canvas, ctx } = fitCanvas(img.width, img.height); if (!ctx) { URL.revokeObjectURL(url); return resolve(null); } ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); try { resolve(canvas.toDataURL('image/jpeg', 0.72)); } catch { resolve(null); } };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      } else if (file.type.startsWith('video')) {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.muted = true; v.preload = 'metadata'; v.playsInline = true;
        v.onloadeddata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch { /* */ } };
        v.onseeked = () => { const { canvas, ctx } = fitCanvas(v.videoWidth, v.videoHeight); if (!ctx) { URL.revokeObjectURL(url); return resolve(null); } ctx.drawImage(v, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); try { resolve(canvas.toDataURL('image/jpeg', 0.72)); } catch { resolve(null); } };
        v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        v.src = url;
      } else resolve(null);
    } catch { resolve(null); }
  });
}

/** Sube un archivo (imagen/video) y lo deja listo en Meta. onProgress 0..100. */
export async function subirCreativo(file: File, onProgress: (pct: number) => void): Promise<SubidoCreativo> {
  const esVideo = file.type.startsWith('video');
  const maxMb = esVideo ? 512 : 30;
  if (file.size > maxMb * 1024 * 1024) throw new Error(`"${file.name}" supera el máximo (${maxMb} MB).`);
  const s = await fetch('/api/ads-manager/creative-signurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, content_type: file.type }) });
  const sj = await s.json();
  if (!sj.ok) throw new Error(sj.error || 'No se pudo preparar la subida');
  await putWithProgress(sj.signedUrl, file, sj.apikey ?? null, onProgress);
  onProgress(100);
  const r = await fetch('/api/ads-manager/creative-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: sj.path, content_type: file.type, filename: file.name }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'No se pudo procesar el creativo');
  return { media_type: j.media_type, image_hash: j.image_hash ?? null, video_id: j.video_id ?? null, thumbnail_url: j.thumbnail_url ?? null };
}
