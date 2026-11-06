// El pedido a /api/lead-magnet-generator desde el navegador (la tab de escritorio y la del teléfono). Un texto de vuelta es el
// error, y `falta` dice qué lo arregla (la oferta, la IA del negocio). El tope: el de la ruta (90 s) y un margen (un `fetch` sin `signal`
// con la conexión caída no resuelve nunca: AGENTS.md, «Un tope que vive en la RUTA no protege al cliente»).
import { RUTA_API } from './reglas';

export async function pedirLeadMagnet<T extends Record<string, unknown>>(cuerpo: Record<string, unknown>, o: { timeoutMs?: number } = {}): Promise<({ ok: true } & T) | { ok: false; error: string; falta?: string }> {
  try {
    const r = await fetch(RUTA_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(o.timeoutMs ?? 95_000) });
    const j = (await r.json().catch(() => null)) as ({ ok: boolean; error?: string; falta?: string } & T) | null;
    if (!j) return { ok: false, error: `No pude hablar con MaKo (HTTP ${r.status}).` };
    return j.ok ? (j as { ok: true } & T) : { ok: false, error: j.error || 'No se pudo.', ...(typeof j.falta === 'string' ? { falta: j.falta } : {}) };
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) return { ok: false, error: 'MaKo tardó demasiado. Vuelve a intentarlo.' };
    return { ok: false, error: 'No hay conexión. Vuelve a intentarlo.' };
  }
}
