// =============================================================================
// subir-video — la subida de un video del curso, del navegador DIRECTO al bucket
// =============================================================================
// Sólo navegador (XMLHttpRequest, <video>): lo importa el editor de clase, que es 'use client'.
//
// ⚠️ XMLHttpRequest Y NO fetch: `fetch` no expone el progreso de SUBIDA (su ReadableStream es
// para la bajada), y una barra alimentada por un fetch sólo puede saltar de 0 a 100 — miente
// sobre lo único que promete (AGENTS.md, «tres topes del entorno»). Molde: `putWithProgress`
// de app/ads-manager/NuevaCampanaModal.tsx.
//
// ⚠️ EL PEDIDO ES EL DE `uploadToSignedUrl` DE @supabase/storage-js 2.106.1, leído en
// node_modules y no adivinado: PUT a la URL firmada (ya trae `?token=`), cuerpo FormData con
// `cacheControl` y el archivo bajo un nombre de campo VACÍO, y el header `x-upsert`. Con el
// FormData, el tipo del archivo viaja en su parte del multipart: por eso el editor le corrige
// el tipo antes (ver `mimeDeArchivo`) — un `application/octet-stream` lo rebota el bucket.

export type Subida = { promesa: Promise<void>; cancelar: () => void };

/**
 * Sube `file` a la URL firmada, avisando el % que salió. `cancelar` corta la subida.
 *
 * `formatos` es lo que dice el error cuando el bucket rechaza el tipo: la usan los videos y los
 * adjuntos de las notas (`curso-notas`), y a quien sube un PDF no se le contesta «MP4, WEBM o MOV».
 */
export function subirConProgreso(
  signedUrl: string, file: File, apikey: string | null, onProgreso: (pct: number) => void, formatos = 'MP4, WEBM o MOV',
  opciones: { trabadaMs?: number } = {},
): Subida {
  const xhr = new XMLHttpRequest();
  // ⚠️ SIN PLAZO, UNA SUBIDA TRABADA SE QUEDA «CORRIENDO» PARA SIEMPRE y nunca se le dice a la persona que falló (medido en
  //    el chat de Image, 6/11/2026: el XHR no traía `timeout` y quien adjuntaba una foto con la red trabada veía el spinner
  //    hasta que cerraba la pestaña). Pero `xhr.timeout` es el TOTAL, y mataría un video de 300 MB que va bien por una línea
  //    lenta. Lo que se mide acá es el ATASCO: cuánto hace que no avanza. Cada evento de progreso lo reinicia, y el fin de la
  //    subida también (de ahí en más el reloj mide cuánto tarda el bucket en contestar, que también puede no llegar nunca).
  //    `trabadaMs` ausente o 0 = como antes, sin plazo: lo elige quien llama, porque un video del curso y una foto de 2 MB no
  //    se esperan lo mismo.
  const trabadaMs = Math.max(0, opciones.trabadaMs ?? 0);
  let ultimoAvance = Date.now();
  let reloj: ReturnType<typeof setInterval> | null = null;
  let trabada = false;
  const pararReloj = () => { if (reloj != null) { clearInterval(reloj); reloj = null; } };

  const promesa = new Promise<void>((resolve, reject) => {
    const fallar = (e: Error) => { pararReloj(); reject(e); };
    const listo = () => { pararReloj(); resolve(); };
    xhr.open('PUT', signedUrl);
    // `false`: el path es un uuid recién firmado; pisar algo ahí sería un bug, no un caso.
    xhr.setRequestHeader('x-upsert', 'false');
    if (apikey) { xhr.setRequestHeader('apikey', apikey); xhr.setRequestHeader('authorization', `Bearer ${apikey}`); }
    // Topea en 99: el 100 lo pone quien llama cuando el server contestó. Llegar a 100 con la
    // respuesta en vuelo se lee como «ya está» y no lo está.
    xhr.upload.onprogress = (e) => { ultimoAvance = Date.now(); if (e.lengthComputable) onProgreso(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.upload.onload = () => { ultimoAvance = Date.now(); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return listo();
      let detalle = (xhr.responseText || '').replace(/\s+/g, ' ').slice(0, 160);
      try { const j = JSON.parse(xhr.responseText); detalle = String(j.message || j.error || detalle); } catch { /* texto plano */ }
      if (xhr.status === 413 || /too large|maximum allowed size|exceeded/i.test(detalle)) return fallar(new Error('Pasa del tope de Storage.'));
      if (/mime|content type|not supported/i.test(detalle)) return fallar(new Error(`Ese formato no va: ${formatos}.`));
      fallar(new Error(`No se pudo subir (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => fallar(new Error('Se cortó la conexión.'));
    // Un `abort` nuestro por atasco y uno de la persona son el mismo evento: el mensaje lo distingue, porque son dos cosas
    // distintas para quien lo lee («cancelé» vs «se trabó»).
    xhr.onabort = () => fallar(new Error(trabada ? 'La subida se quedó trabada. Revisa tu conexión y vuelve a intentar.' : 'Subida cancelada.'));
    if (trabadaMs > 0) {
      reloj = setInterval(() => {
        if (Date.now() - ultimoAvance <= trabadaMs) return;
        trabada = true;
        xhr.abort();
      }, 1_000);
    }
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', file);
    xhr.send(fd);
  });
  return { promesa, cancelar: () => { pararReloj(); xhr.abort(); } };
}

/**
 * Cuánto dura un video local, en segundos (`null` si el navegador no lo puede leer). Sirve para
 * proponer los minutos de la clase sin que nadie los tipee.
 */
export function duracionDeArchivo(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      const fin = (d: number | null) => { URL.revokeObjectURL(url); resolve(d); };
      v.onloadedmetadata = () => fin(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
      v.onerror = () => fin(null);
      v.src = url;
    } catch {
      resolve(null);
    }
  });
}
