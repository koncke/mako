// =============================================================================
// /api/image-editor/chat — el hilo del chat «MaKo IA» del Image Editor, guardado
// =============================================================================
// GET ?diseno=<id>                        → { ok, hilo: { mensajes, version } | null } | { ok:false, sinTabla }
// PUT json { diseno, nombre, mensajes, version }
//                                         → { ok, version } | 409 { ok:false, conflicto, hilo } | { ok:false, sinTabla }
//
// Copia de /api/video-editor/chat: uno por persona y por diseño (la persona sale de la SESIÓN, nunca del pedido). El
// formato y el saneo, lib/image-editor/chat/hilo.ts (la ruta no le cree al navegador: vuelve a sanear); la base,
// lib/image-editor/chat/hilo-server.ts. Lo sincroniza app/image-editor/mako/chat/hilo.ts.
//
// La puerta es la del editor (`puerta` de lib/image-editor/server.ts). Va detrás de la sesión (NO está en
// lib/rutas-publicas.ts) y el proxy le exige Origin propio al PUT. Sin IA y sin costo.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { puerta } from '@/lib/image-editor/server';
import { rateLimit } from '@/lib/rate-limit';
import { personaDeSesion } from '@/lib/chart-chats-reglas';
import { disenoValido, guardarHilo, leerHilo } from '@/lib/image-editor/chat/hilo-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Un hilo con sus topes (lib/image-editor/chat/hilo.ts) entra holgado; más es otra cosa. */
const TOPE_CUERPO = 1_000_000;

const responder = (cuerpo: object, status = 200) => Response.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });
const fallo = (error: string, status: number) => responder({ ok: false, error }, status);

/** Quién es, después de la puerta (los chats son por persona): de la SESIÓN, nunca del pedido. */
async function personaActual(): Promise<string | null> {
  const sesion = await getUsuarioActual();
  return sesion ? personaDeSesion(sesion) : null;
}
const sinSesion = () => fallo('Tu sesión venció. Vuelve a entrar.', 401);

export async function GET(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const persona = await personaActual();
  if (!persona) return sinSesion();
  const diseno = req.nextUrl.searchParams.get('diseno');
  if (!disenoValido(diseno)) return fallo('Falta el diseño.', 400);
  const r = await leerHilo({ ws: p.ws, persona, diseno });
  if (!r.ok) return r.sinTabla ? responder({ ok: false, sinTabla: true, error: 'El chat todavía no se guarda.' }) : fallo('No se pudo leer el chat.', 500);
  return responder({ ok: true, hilo: r.hilo });
}

export async function PUT(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const persona = await personaActual();
  if (!persona) return sinSesion();
  if (!rateLimit(`image-editor:chat:${p.ws}:${persona}`, 120, 60_000)) return fallo('Demasiados guardados. Espera un minuto.', 429);
  const crudo = await req.text().catch(() => '');
  if (!crudo || crudo.length > TOPE_CUERPO) return fallo('Pedido inválido.', 400);
  let body: Record<string, unknown>;
  try { body = JSON.parse(crudo) as Record<string, unknown>; } catch { return fallo('Pedido inválido.', 400); }
  if (!body || typeof body !== 'object' || !disenoValido(body.diseno)) return fallo('Falta el diseño.', 400);
  const version = body.version == null ? null : Number.isInteger(body.version) && (body.version as number) >= 1 ? (body.version as number) : undefined;
  if (version === undefined) return fallo('La versión no es válida.', 400);
  const r = await guardarHilo({
    ws: p.ws, persona, diseno: body.diseno,
    nombre: typeof body.nombre === 'string' ? body.nombre : null, mensajes: body.mensajes, version,
  });
  if (r.ok) return responder({ ok: true, version: r.version });
  if ('conflicto' in r) return responder({ ok: false, conflicto: true, hilo: r.hilo }, 409);
  if (r.sinTabla) return responder({ ok: false, sinTabla: true, error: 'El chat todavía no se guarda.' });
  return fallo('No se pudo guardar el chat.', r.status ?? 500);
}
