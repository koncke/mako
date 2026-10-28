// =============================================================================
// Transcribir una nota de voz con /api/plan-dictado — sin React y sin 'use client' (27/10/2026)
// =============================================================================
// Vivía en ./useDictar.ts, que es 'use client'. La nota de voz del Ops Center ahora se transcribe POR DETRÁS desde el motor
// (app/admin/operaciones/useCentro.ts → app/_chat/preparar-nota.ts), que no lleva la directiva: importar un VALOR de un
// módulo 'use client' desde uno que no la lleva falla al usarlo (tests/frontera-use-client.test.ts). ./useDictar.ts lo
// re-exporta para los que ya lo usaban.
// ⚠️ /api/plan-dictado devuelve el fallo de transcripción con status 200 y `ok:false`: se lee `j.ok`, nunca `res.ok`.
// =============================================================================

export type ResultadoTranscripcion = { ok: true; texto: string } | { ok: false; error: string };

/**
 * Sube una nota de voz a /api/plan-dictado y devuelve el texto. No tira: todo fallo vuelve como `{ ok:false, error }` con una
 * frase para la persona. `para`: 'chat' es la nota de voz de una caja de chat, que el gasto de IA anota aparte del dictado de
 * una tarea.
 */
export async function transcribirNota(blob: Blob, timeoutMs = 300_000, para?: 'chat'): Promise<ResultadoTranscripcion> {
  try {
    const fd = new FormData();
    fd.append('audio', blob, blob.type.includes('mpeg') ? 'nota.mp3' : blob.type.includes('mp4') ? 'nota.mp4' : 'nota.webm');
    if (para) fd.append('para', para);
    // ⚠️ CON SEÑAL DE CORTE (AGENTS.md): un `fetch` sin `signal` con la conexión caída no
    // resuelve NUNCA, y el botón quedaba deshabilitado para siempre.
    const r = await fetch('/api/plan-dictado', { method: 'POST', body: fd, signal: AbortSignal.timeout(timeoutMs) });
    // ⚠️ SE LEE COMO TEXTO ANTES DE PARSEAR (27/10/2026, Martín: «Acabo de enviar un audio y no se envía y me dijo un
    // unexpected error JSON»). Lo que corta Vercel antes de la ruta no es JSON: el 413 de un cuerpo de más de 4,5 MB es
    // «Request Entity Too Large» y el 504 de una función que pasó su tiempo es «An error occurred… FUNCTION_INVOCATION_TIMEOUT».
    // Con `r.json()` la persona leía el error del parser («Unexpected token 'A'… is not valid JSON») y no qué pasó.
    const crudo = await r.text();
    let j: { ok?: boolean; texto?: unknown; error?: unknown } | null = null;
    try { j = JSON.parse(crudo); } catch { return { ok: false, error: porQueNoSeTranscribio(r.status, crudo) }; }
    if (!j?.ok) return { ok: false, error: String(j?.error || porQueNoSeTranscribio(r.status, crudo)) };
    return { ok: true, texto: String(j.texto ?? '') };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error && e.name === 'TimeoutError'
        ? 'La transcripción tardó demasiado. Escríbelo a mano o prueba de nuevo.'
        : e instanceof TypeError ? 'No hay conexión: la nota no llegó a transcribirse. Prueba de nuevo.'
          : e instanceof Error ? e.message : String(e),
    };
  }
}

/** Por qué no se transcribió una nota cuando lo que volvió NO es la respuesta de la ruta (un corte de Vercel, una página de
 *  error, la del login). Pura (tests/chat-en-el-acto.test.ts). */
export function porQueNoSeTranscribio(status: number, cuerpo: string): string {
  const c = cuerpo.slice(0, 2000);
  if (status === 413 || /request entity too large|FUNCTION_PAYLOAD_TOO_LARGE/i.test(c)) return 'La nota es muy larga para mandarla de una vez. Grábala en dos partes.';
  if (status === 504 || /FUNCTION_INVOCATION_TIMEOUT/i.test(c)) return 'La transcripción tardó más de lo que el servidor espera. Prueba con una nota más corta.';
  if (status === 401 || status === 403) return 'Se cerró tu sesión: vuelve a entrar y graba de nuevo.';
  if (status >= 500) return `El servidor no pudo transcribir la nota (error ${status}). Prueba de nuevo.`;
  if (/<html/i.test(c)) return 'Volvió una página en vez de la transcripción (¿se cerró tu sesión?). Recarga y prueba de nuevo.';
  return `No pude transcribir la nota (respuesta ${status}). Prueba de nuevo.`;
}
