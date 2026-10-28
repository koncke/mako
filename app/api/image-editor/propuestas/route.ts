// =============================================================================
// /api/image-editor/propuestas — lo que la API de MaKo propuso en un diseño, para aceptarlo en el editor
// =============================================================================
// GET   ?diseno=<uuid>[&propuesta=<id>…]           → { ok, propuestas: [{ id, canal, paginaId, refs, paginas, operaciones, lineas, creada, version }] }
// PATCH json { id, estado: 'aplicada'|'descartada', descartes?, ops? } → { ok, quedan } | { ok:false, yaResuelta }
//
// El espejo de /api/video-editor/propuestas (27/10/2026): las acciones del Image Editor en la API
// (lib/image-editor/chat/api.ts) dejan sus operaciones en una propuesta del diseño (mig 0340); el editor las muestra en
// su chat «MaKo IA» y una persona las acepta o las descarta (app/image-editor/mako/chat/propuestas.ts). Nada se aplica
// sin ese clic. Reglas: lib/image-editor/chat/propuestas.ts.
//
// La puerta es la del editor (`puerta` de lib/image-editor/server.ts: sesión, admin con la tab en su capa y un
// workspace). Va detrás de la sesión y el proxy le exige Origin propio al PATCH. Sin IA y sin costo.

import type { NextRequest } from 'next/server';
import { puerta } from '@/lib/image-editor/server';
import { uuidValido } from '@/lib/image-editor/reglas';
import { propuestasAbiertasImagen, resolverPropuestaImagen, TOPE_INCLUIR_IMAGEN } from '@/lib/image-editor/chat/propuestas-server';
import { validarOperacionesDePropuesta } from '@/lib/image-editor/chat/catalogo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const responder = (cuerpo: object, status = 200) => Response.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });
const fallo = (error: string, status: number) => responder({ ok: false, error }, status);

export async function GET(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const diseno = req.nextUrl.searchParams.get('diseno') ?? '';
  if (!uuidValido(diseno)) return fallo('Falta el diseño.', 400);
  // Las que el editor pide por id (la del link y las de su hilo) llegan siempre, aunque haya más de 20 abiertas.
  const incluir = req.nextUrl.searchParams.getAll('propuesta').filter((x) => uuidValido(x)).slice(0, TOPE_INCLUIR_IMAGEN);
  const r = await propuestasAbiertasImagen(p.ws, diseno, incluir);
  if (!r.ok) return r.sinTabla ? responder({ ok: true, propuestas: [] }) : fallo('No se pudieron leer las propuestas.', 500);
  return responder({ ok: true, propuestas: r.propuestas });
}

export async function PATCH(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return fallo('Pedido inválido.', 400); }
  if (!body || typeof body.id !== 'string' || !uuidValido(body.id)) return fallo('Falta la propuesta.', 400);
  if (body.estado !== 'aplicada' && body.estado !== 'descartada') return fallo('El estado no es válido.', 400);
  const descartes = Array.isArray(body.descartes) ? body.descartes.filter((d): d is string => typeof d === 'string') : [];
  // Las operaciones que el editor tenía en ese mensaje (como las MOSTRÓ): se cierran ESAS, por contenido.
  const vistas = Array.isArray(body.ops) ? validarOperacionesDePropuesta(body.ops.slice(0, 40), { iaPendiente: true }).operaciones : undefined;
  const r = await resolverPropuestaImagen({ ws: p.ws, id: body.id, estado: body.estado, persona: p.quien, descartes, vistas });
  if (r.ok) return responder({ ok: true, quedan: r.quedan });
  if ('yaResuelta' in r) return responder({ ok: false, yaResuelta: true, error: 'Ya se había resuelto.' });
  if ('cambio' in r) return responder({ ok: false, cambio: true, error: 'La propuesta cambió mientras se cerraba: se vuelve a intentar.' });
  return r.sinTabla ? responder({ ok: false, error: 'Las propuestas todavía no se guardan.' }) : fallo('No se pudo cerrar la propuesta.', 500);
}
