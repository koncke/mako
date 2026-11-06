// El pedido a /api/lead-magnet-generator desde el navegador (la tab de escritorio y la del teléfono). Un texto de vuelta es el error.
import { RUTA_API } from './reglas';

export async function pedirLeadMagnet<T extends Record<string, unknown>>(cuerpo: Record<string, unknown>): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  try {
    const r = await fetch(RUTA_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = (await r.json().catch(() => null)) as ({ ok: boolean; error?: string } & T) | null;
    if (!j) return { ok: false, error: `No pude hablar con MaKo (HTTP ${r.status}).` };
    return j.ok ? (j as { ok: true } & T) : { ok: false, error: j.error || 'No se pudo.' };
  } catch {
    return { ok: false, error: 'No hay conexión. Vuelve a intentarlo.' };
  }
}
