// =============================================================================
// /api/copiloto/comunicacion — «Oferta y comunicación» del Marketing CoPilot (12/11/2026)
// =============================================================================
// GET  ?sesion=<id de Offer>      → lo que dibuja la pantalla: las tres partes, sus cosas, su nota y las ofertas (EstadoComunicacion).
// POST {op:'marcar', parte, k, listo, sesion}   → el check de una cosa (la oferta se confirma EN Offer).
// POST {op:'decir', parte, k, valor, sesion}    → lo que dijo la persona de una cosa (queda confirmada).
// POST {op:'leer', parte, sesion}               → MaKo lee y califica Ángulos o Tu voz (una llamada a la IA de Offer; no cobra).
// La puerta es la del Media Buyer (`wsDeAdsManager`): el admin del negocio o el super admin mirándolo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { esItemOC, esParteOC } from '@/lib/copiloto/comunicacion';
import { decirCosaOC, leerComunicacion, leerOfertaElegida, marcarCosaOC, sesionesDeOffer, elegirSesion } from '@/lib/copiloto/comunicacion-store';
import { leerYCalificarOC } from '@/lib/copiloto/comunicacion-ia';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const J = (x: unknown, status = 200) => Response.json(x, { status });
const idSesion = (x: unknown): number | null => {
  const n = typeof x === 'number' ? x : typeof x === 'string' && /^\d{1,12}$/.test(x) ? Number(x) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  try {
    return J({ ok: true, estado: await leerComunicacion(ws, idSesion(req.nextUrl.searchParams.get('sesion'))) });
  } catch (e) {
    return J({ ok: false, error: msg(e) }, 500);
  }
}

export async function POST(req: NextRequest) {
  const inicio = Date.now();
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return J({ ok: false, error: 'Pedido inválido.' }, 400); }
  const op = String(body.op ?? '');
  const parte = body.parte;
  if (!esParteOC(parte)) return J({ ok: false, error: 'Falta la parte: oferta, angulos o voz.' }, 400);
  // La sesión de Offer se valida contra las del negocio: nunca se escribe en la de otro.
  const sesion = elegirSesion(await sesionesDeOffer(ws), idSesion(body.sesion) ?? await leerOfertaElegida(ws));
  try {
    switch (op) {
      case 'marcar': {
        if (!esItemOC(parte, body.k)) return J({ ok: false, error: 'Esa cosa no existe.' }, 400);
        await marcarCosaOC(ws, parte, sesion, body.k, body.listo === true);
        break;
      }
      case 'decir': {
        if (!esItemOC(parte, body.k)) return J({ ok: false, error: 'Esa cosa no existe.' }, 400);
        const valor = typeof body.valor === 'string' ? body.valor : '';
        if (!valor.trim()) return J({ ok: false, error: 'Falta lo que dijiste.' }, 400);
        await decirCosaOC(ws, parte, sesion, body.k, valor);
        break;
      }
      case 'leer': {
        if (parte === 'oferta') return J({ ok: false, error: 'La oferta se analiza en Offer.' }, 400);
        const r = await leerYCalificarOC(ws, parte, sesion, inicio);
        if (!r.ok) return J({ ok: false, error: r.error }, 502);
        break;
      }
      default:
        return J({ ok: false, error: `No conozco «${op}».` }, 400);
    }
    return J({ ok: true, estado: await leerComunicacion(ws, sesion) });
  } catch (e) {
    return J({ ok: false, error: msg(e) }, 500);
  }
}
