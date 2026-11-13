// =============================================================================
// /api/copiloto/tareas — «Lo que te toca» del Marketing CoPilot, en el Plan (13/11/2026)
// =============================================================================
// POST {op:'sincronizar', tareas, resueltas} → crea en el Plan lo que falta, cierra lo resuelto y devuelve cómo quedó (enPlan).
// POST {op:'marcar', clave, hecha}           → completa (o reabre) la tarea en el Plan.
// Las tareas las arma la pantalla con ./lib/copiloto/tareas.ts (puro); acá se validan y se escriben con las funciones del Plan
// (lib/copiloto/tareas-plan.ts). La puerta es la del Media Buyer (`wsDeAdsManager`).
// =============================================================================

import type { NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { TARJETAS_COPILOTO, esClaveCoPilot, type TareaCoPilot, type TarjetaCoPilot } from '@/lib/copiloto/tareas';
import { marcarEnElPlan, sincronizarConElPlan } from '@/lib/copiloto/tareas-plan';

export const dynamic = 'force-dynamic';

const J = (x: unknown, status = 200) => Response.json(x, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lo que manda la pantalla, saneado: claves del CoPilot, títulos cortos, links de adentro de MaKo. Nada más entra al Plan. */
function sanearTareas(x: unknown): TareaCoPilot[] {
  if (!Array.isArray(x)) return [];
  const out: TareaCoPilot[] = [];
  for (const t of x.slice(0, 40)) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const titulo = typeof o.titulo === 'string' ? o.titulo.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    if (!esClaveCoPilot(o.clave) || !titulo || !(TARJETAS_COPILOTO as readonly string[]).includes(String(o.tarjeta))) continue;
    out.push({ clave: o.clave, tarjeta: o.tarjeta as TarjetaCoPilot, titulo, ...(typeof o.href === 'string' && /^\/(?!\/)/.test(o.href) ? { href: o.href.slice(0, 300) } : {}) });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return J({ ok: false, error: 'Pedido inválido.' }, 400); }
  try {
    if (body.op === 'sincronizar') {
      const resueltas = Array.isArray(body.resueltas) ? body.resueltas.filter(esClaveCoPilot).slice(0, 60) : [];
      return J({ ok: true, enPlan: await sincronizarConElPlan(ws, sanearTareas(body.tareas), resueltas) });
    }
    if (body.op === 'marcar') {
      if (!esClaveCoPilot(body.clave)) return J({ ok: false, error: 'Esa tarea no es del CoPilot.' }, 400);
      const r = await marcarEnElPlan(ws, body.clave, body.hecha === true);
      return J(r, r.ok ? 200 : 404);
    }
    return J({ ok: false, error: `No conozco «${String(body.op)}».` }, 400);
  } catch (e) {
    return J({ ok: false, error: msg(e) }, 500);
  }
}
