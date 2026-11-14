// =============================================================================
// /api/copiloto/entrada — la entrada del Marketing CoPilot (14/11/2026)
// =============================================================================
// POST {canales, campanas, presupuestoMes, tiempo} → lo guarda en el perfil del CoPilot (marketing-copilot.perfil) con
// lib/copiloto/entrada.ts (`perfilConLaEntrada`, puro) y lo devuelve saneado. Lee ESTRICTO antes de escribir: un cambio sobre una
// lectura caída borraría lo demás del perfil. La puerta es la del Media Buyer (`wsDeAdsManager`).
// =============================================================================

import type { NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { guardarPerfilCopiloto, leerPerfilCopilotoEstricto } from '@/lib/media-buyer/copiloto-store';
import { sanearPerfil } from '@/lib/media-buyer/copiloto';
import { perfilConLaEntrada, type RespuestasEntrada } from '@/lib/copiloto/entrada';

export const dynamic = 'force-dynamic';

const J = (x: unknown, status = 200) => Response.json(x, { status });

export async function POST(req: NextRequest) {
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return J({ ok: false, error: 'Pedido inválido.' }, 400); }
  // Pasa por el mismo saneado que el perfil: sólo canales, campañas y tiempos que existen.
  const s = sanearPerfil({ canales: body.canales, campanas: body.campanas, tiempo: body.tiempo, presupuestoMes: body.presupuestoMes });
  if (!s.canales?.length) return J({ ok: false, error: 'Elige por dónde vendes.' }, 400);
  const r: RespuestasEntrada = { canales: s.canales, campanas: s.campanas ?? [], presupuestoMes: s.presupuestoMes ?? null, tiempo: s.tiempo ?? null };
  try {
    const antes = await leerPerfilCopilotoEstricto(ws);
    const perfil = sanearPerfil(perfilConLaEntrada(antes, r));
    await guardarPerfilCopiloto(ws, perfil);
    return J({ ok: true, perfil });
  } catch (e) {
    return J({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
