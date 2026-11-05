// =============================================================================
// /api/marca — los kits de marca del negocio (Second Brain → «Voz y cara» → «Marca», y el chat de Image)
// =============================================================================
// GET                                        → { ok, kits }                 los kits y cuál va por defecto
// POST json {accion:'guardar', kit, porDefecto?} → { ok, kits, id }         suma o reemplaza un kit (sin id, uno nuevo)
// POST json {accion:'por-defecto', id}        → { ok, kits }
// POST json {accion:'borrar', id}             → { ok, kits }
// POST multipart {datos:{accion:'leer'}, adjuntos: un PDF o una imagen} → { ok, borrador }  lo que MaKo leyó, sin guardar
//
// Es del ADMIN del negocio (la marca la deciden ellos, como el resto del Second Brain), con un workspace: sin él no hay de
// quién es la marca. Leer el manual llama a la IA DEL NEGOCIO, adentro de «sólo su IA» (`conSuIADelNegocio`). Guardar es
// lo que la persona CONFIRMÓ en la pantalla: el borrador de la IA no se guarda solo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { rateLimit } from '@/lib/rate-limit';
import { cuerpoYArchivos } from '@/lib/adjuntos-del-chat';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { cambiarKits, leerKits, nuevoIdKit } from '@/lib/marca/kits-server';
import { conKit, conPorDefecto, sanearKit, sinKit } from '@/lib/marca/kits';
import { leerManualDeMarca } from '@/lib/marca/leer-manual';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Leer un manual por la visión puede tardar (una foto, ~50 s).
export const maxDuration = 120;

const responder = (cuerpo: Record<string, unknown>, status = 200) =>
  Response.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });
const fallo = (error: string, status: number) => responder({ ok: false, error }, status);

/** El admin del negocio en curso (o el super admin), con un workspace. Lo demás contesta tal cual. */
async function puerta(): Promise<{ ws: number } | Response> {
  if ((await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin') return fallo('Sólo el admin del negocio', 403);
  const ws = await getWorkspaceActual();
  if (ws == null) return fallo('Abre tu marca desde un negocio', 409);
  return { ws };
}

export async function GET() {
  const p = await puerta();
  if (p instanceof Response) return p;
  return runWithWorkspace(p.ws, async () => responder({ ok: true, kits: await leerKits() }));
}

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  if (!rateLimit(`marca:${p.ws}`, 30, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);
  const c = await cuerpoYArchivos(req);
  if (!c.ok) return fallo(c.error, c.status);
  const accion = c.body.accion;

  return runWithWorkspace(p.ws, async () => {
    if (accion === 'leer') {
      const a = c.adjuntos[0];
      if (!a) return fallo('Sube el PDF o la imagen de tu manual de marca.', 400);
      const r = await conSuIADelNegocio(p.ws, () => leerManualDeMarca(a));
      return r.ok ? responder({ ok: true, borrador: r.borrador }) : fallo(r.error, 422);
    }
    if (accion === 'guardar') {
      const raw = (c.body.kit ?? {}) as Record<string, unknown>;
      const id = typeof raw.id === 'string' && raw.id ? raw.id : nuevoIdKit();
      const kit = sanearKit({ ...raw, id, actualizado: new Date().toISOString() });
      if (!kit) return fallo('El kit no es válido.', 400);
      const r = await cambiarKits((k) => conKit(k, kit, { porDefecto: c.body.porDefecto === true }));
      return r.ok ? responder({ ok: true, kits: r.kits, id: kit.id }) : fallo(r.error, 409);
    }
    if (accion === 'por-defecto' || accion === 'borrar') {
      const id = typeof c.body.id === 'string' ? c.body.id : '';
      if (!id) return fallo('Falta el kit.', 400);
      const r = await cambiarKits((k) => (accion === 'borrar' ? sinKit(k, id) : conPorDefecto(k, id)));
      return r.ok ? responder({ ok: true, kits: r.kits }) : fallo(r.error, 409);
    }
    return fallo('Pedido inválido.', 400);
  });
}
