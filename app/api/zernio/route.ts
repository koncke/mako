// =============================================================================
// /api/zernio — la cuenta de Instagram o Messenger de un negocio, para sus automatizaciones
// =============================================================================
// Lo usa el editor de las tarjetas INSTAGRAM y MESSENGER (app/automations/EditorMensajeSocial.tsx) para
// decir desde qué cuenta sale el mensaje —como el número de salida de la de WhatsApp— y ofrecer
// «Conectar» cuando no hay ninguna. Sólo el admin del workspace.
//
//   POST { action: 'estado', plataforma }   → { ok, cuentas: [{ id, usuario, nombre }], webhook }
//   POST { action: 'conectar', plataforma } → { ok, url }   (el OAuth de Zernio; vuelve a /automations)
//   Sin Zernio (ni key propia ni la de la plataforma)  → { ok: true, configurado: false }
//   La key PROPIA no sirve (401 de Zernio)             → { ok: false, motivo: 'key', error }        (200)
//   La cuenta PROPIA está pausada (402 de Zernio)      → { ok: false, motivo: 'pausada', error, billingUrl } (402)
//
// ⚠️ EL 401 Y EL 402 SE DICEN COMO LO QUE SON, Y SÓLO CON KEY PROPIA (duodécima tanda, §2.11). Hasta el 12/10/2026
// todo 4xx llegaba como «Zernio no contestó»: ws11 (cuenta pausada por falta de pago, medido el 10/10) veía un
// error que no decía de quién era ni cómo se arreglaba (AGENTS.md: el error de un tercero dice las dos cosas).
// Con la key de la PLATAFORMA el 401/402 es de MaKo, no del cliente: su link de pago NO se le muestra a nadie.
// La pantalla (app/automations/ConectarMedio.tsx, `leerZernio`) pide la key ahí mismo con 'configurado: false'
// y con 'key', y con 'pausada' muestra el link.
//
// ⚠️ «ESTADO» TAMBIÉN DEJA ANDANDO LA RECEPCIÓN, a propósito: reclama el ruteo de cada cuenta (un
// comentario trae sólo la cuenta, no el profile) y registra el webhook en la cuenta de Zernio del
// negocio (`asegurarWebhook`). Las dos cosas son idempotentes. Medido el 09/10/2026: los dos negocios
// con Zernio tenían key propia y NUNCA habían recibido un evento — sin un webhook en SU cuenta, no
// llega nada y no da error. Es un POST, no un GET: escribe afuera.

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { cuentasConectadas, asegurarWebhook, urlParaConectar, usaCuentaPropia, zernioConfigurado, ZernioError } from '@/lib/zernio';
import { linkApp } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Los textos de la pantalla (los mismos de app/automations/ConectarMedio.tsx: el test los compara). */
const ZERNIO_KEY_MALA = 'Tu key de Zernio no sirve';
const ZERNIO_PAUSADA = 'Tu cuenta de Zernio está pausada';

/**
 * El link de pago del 402 de Zernio (`code: 'PAYMENT_REQUIRED'`, `billingUrl` en el cuerpo; por las dudas también
 * adentro de `details`). Sólo un https: va a un `href`, y un `javascript:` ahí es un XSS.
 */
function linkDePago(cuerpo: unknown): string | null {
  const o = cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : null;
  const d = o?.details && typeof o.details === 'object' ? (o.details as Record<string, unknown>) : null;
  const url = [o?.billingUrl, d?.billingUrl].find((x): x is string => typeof x === 'string');
  return url && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null;
}

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
    console.error(`[api:zernio] ${String(body.action)} ws${ws}: ${msg(e)}`);
    // La key y la cuenta del NEGOCIO (ver la cabecera). «No pude saber si es propia» cae en el genérico.
    if (e instanceof ZernioError && (e.status === 401 || e.status === 402) && (await usaCuentaPropia(ws).catch(() => false))) {
      if (e.status === 401) return Response.json({ ok: false, motivo: 'key', error: ZERNIO_KEY_MALA });
      return Response.json({ ok: false, motivo: 'pausada', error: ZERNIO_PAUSADA, billingUrl: linkDePago(e.body) }, { status: 402 });
    }
    const status = e instanceof ZernioError && e.status >= 400 && e.status < 500 ? 200 : 502;
    return Response.json({ ok: false, error: 'Zernio no contestó' }, { status });
  }
}
