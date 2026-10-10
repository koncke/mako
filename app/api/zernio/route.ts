// =============================================================================
// /api/zernio — la cuenta de Instagram o Messenger de un negocio, para sus automatizaciones
// =============================================================================
// Lo usa el editor de las tarjetas INSTAGRAM y MESSENGER (app/automations/EditorMensajeSocial.tsx) para
// decir desde qué cuenta sale el mensaje —como el número de salida de la de WhatsApp— y ofrecer
// «Conectar» cuando no hay ninguna. Sólo el admin del workspace.
//
//   POST { action: 'estado', plataforma }   → { ok, cuentas: [{ id, usuario, nombre }], webhook }
//   POST { action: 'conectar', plataforma } → { ok, url }   (el OAuth de Zernio; vuelve a /automations)
//
// ⚠️ «ESTADO» TAMBIÉN DEJA ANDANDO LA RECEPCIÓN, a propósito: reclama el ruteo de cada cuenta (un
// comentario trae sólo la cuenta, no el profile) y registra el webhook en la cuenta de Zernio del
// negocio (`asegurarWebhook`). Las dos cosas son idempotentes. Medido el 09/10/2026: los dos negocios
// con Zernio tenían key propia y NUNCA habían recibido un evento — sin un webhook en SU cuenta, no
// llega nada y no da error. Es un POST, no un GET: escribe afuera.

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { cuentasConectadas, asegurarWebhook, urlParaConectar, zernioConfigurado, ZernioError } from '@/lib/zernio';
import { linkApp } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace' }, { status: 403 });
  let body: { action?: unknown; plataforma?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const plataforma = body.plataforma === 'facebook' ? 'facebook' : body.plataforma === 'instagram' ? 'instagram' : null;
  if (!plataforma) return Response.json({ ok: false, error: 'plataforma inválida' }, { status: 400 });
  if (!(await zernioConfigurado(ws))) return Response.json({ ok: true, configurado: false, cuentas: [], webhook: null });

  try {
    if (body.action === 'estado') {
      const cuentas = await cuentasConectadas(ws, plataforma);
      // El webhook, sólo si hay algo que escuchar: sin cuenta no hay eventos.
      let webhook: string | null = null;
      if (cuentas.length) {
        try { webhook = await asegurarWebhook(ws); }
        catch (e) { console.error(`[api:zernio] webhook ws${ws}: ${msg(e)}`); webhook = 'error'; }
      }
      return Response.json({
        ok: true, configurado: true, webhook,
        cuentas: cuentas.map((a) => ({ id: a._id, usuario: a.username, nombre: a.displayName ?? a.username })),
      });
    }
    if (body.action === 'conectar') {
      const url = await urlParaConectar(ws, plataforma, linkApp('/automations', ws));
      return Response.json({ ok: true, url });
    }
    return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e) {
    const status = e instanceof ZernioError && e.status >= 400 && e.status < 500 ? 200 : 502;
    console.error(`[api:zernio] ${String(body.action)} ws${ws}: ${msg(e)}`);
    return Response.json({ ok: false, error: e instanceof ZernioError && e.status === 401 ? 'La key de Zernio no es válida' : 'Zernio no contestó' }, { status });
  }
}
