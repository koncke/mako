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

/** La ruta que lee el archivo (app/api/chat-agent/secuencias/archivo/route.ts) y su tope de subida. */
export const RUTA_ARCHIVO_PEDIDO = '/api/chat-agent/secuencias/archivo';
export const TOPE_ARCHIVO_BYTES = 15 * 1024 * 1024;

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
