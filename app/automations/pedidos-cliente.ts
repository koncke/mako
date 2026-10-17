// =============================================================================
// pedidos-cliente — los dos POST de los pedidos sueltos del chat de MaKo (16/10/2026)
// =============================================================================
// Aparte de ChatMako.tsx a propósito: el chat no hace POST propios (el stream de MaKo lo lee SÓLO ./stream-ia.ts, y lo
// fija tests/automations-chat-mako.test.ts). Ninguno de los dos tira: una falla vuelve como «no hay respuesta» (null o
// false), y el chat sigue como siempre (./pedidos-chat.ts decide qué hacer con eso).
// El ?ws= lo pega WsFetch, como en todos los fetch de la app.
// =============================================================================

/** Cuánto espera el chat a POST /api/mako/pedidos (reglas + hasta 7,5 s de IA): después, el mensaje entero va a MaKo. */
export const PLAZO_PEDIDOS_MS = 12_000;

/** POST /api/mako/pedidos: lo que contestó la ruta, o null si no contestó a tiempo (el chat sigue como siempre). */
export async function pedirPedidos(cuerpo: unknown, ms: number = PLAZO_PEDIDOS_MS): Promise<unknown> {
  try {
    const r = await fetch('/api/mako/pedidos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(ms),
    });
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

/**
 * «Eliminar» o «Deshacer» de una burbuja, por la MISMA ruta que el «⋯» de la lista (POST /api/chat-agent/secuencias).
 * El cuerpo lo arma ./pedidos-chat.ts (`cuerpoEliminar` / `cuerpoRecuperar`: siempre con UN id). `true` = hecho.
 */
export async function pedirALaLista(cuerpo: { action: 'archivar'; ids: [number] } | { action: 'desarchivar'; secuenciaId: number }): Promise<boolean> {
  try {
    const r = await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => null) as { ok?: boolean } | null;
    return r.ok && j?.ok === true;
  } catch {
    return false;
  }
}
