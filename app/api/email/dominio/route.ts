// =============================================================================
// API: dominio de envío del workspace (mini-onboarding de Email Marketing)
// =============================================================================
// Opción A: la cuenta de Resend es de MaKo; cada workspace da de alta y verifica
// SU dominio adentro. El estado vive en app_settings del workspace:
//   resend_domain     → nombre del dominio ('multiplicatusresultados.com')
//   resend_domain_id  → id del dominio en Resend
//   resend_from       → remitente final ('Nombre <hola@dominio.com>')
//
// GET  → estado completo (conectado, envío habilitado, dominio+records en vivo).
// POST → { action:'crear', dominio }            → alta en Resend, devuelve records DNS
//        { action:'verificar' }                 → dispara verificación + estado fresco
//        { action:'remitente', local, nombre, responderA? } → fija el "De:" (y adónde van las respuestas)
//        { action:'envio', on }                 → prende/apaga el envío real del ws
//        { action:'desconectar' }               → limpia la config local (no borra en Resend)
// Guard: solo el admin del workspace (incluido el dueño — sirve para la prueba
// E2E de reconectar el dominio de Mauricio desde la app).
//
// ⚠️ LA LÓGICA VIVE EN lib/email-dominio.ts (4/11/2026): la usa también la API de MaKo (`conectar_dominio_email`,
// `fijar_remitente_email`). Acá queda la puerta HTTP de la pantalla: el guard, el body y el estado que contesta.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import {
  estadoDominio, conectarDominio, verificarDominio, fijarRemitente, cambiarEnvio, desconectarDominio, type Falla,
} from '@/lib/email-dominio';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<{ ws: number } | { error: Response }> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return { error: Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar el email.' }, { status: 403 }) };
  }
  return { ws };
}

const fallo = (f: Falla) => Response.json({ ok: false, error: f.error }, { status: f.status });

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  try {
    return Response.json({ ok: true, ...(await estadoDominio(g.ws)) });
  } catch (e) {
    console.error(`[api:email/dominio GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;

  let body: { action?: string; dominio?: string; local?: string; nombre?: string; responderA?: unknown; on?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'crear') {
      const r = await conectarDominio(g.ws, body.dominio);
      if (!r.ok) return fallo(r);
      return Response.json({ ok: true, ...(await estadoDominio(g.ws)) });
    }

    if (body.action === 'verificar') {
      const r = await verificarDominio();
      if (!r.ok) return fallo(r);
      return Response.json({ ok: true, ...(await estadoDominio(g.ws)) });
    }

    if (body.action === 'remitente') {
      const r = await fijarRemitente(g.ws, { local: body.local, nombre: body.nombre, ...('responderA' in body ? { responderA: body.responderA } : {}) });
      if (!r.ok) return fallo(r);
      return Response.json({ ok: true, ...(await estadoDominio(g.ws)) });
    }

    if (body.action === 'envio') {
      const r = await cambiarEnvio(body.on === true);
      if (!r.ok) return fallo(r);
      return Response.json({ ok: true, ...(await estadoDominio(g.ws)) });
    }

    if (body.action === 'desconectar') {
      await desconectarDominio();
      return Response.json({ ok: true, ...(await estadoDominio(g.ws)) });
    }

    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:email/dominio POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
