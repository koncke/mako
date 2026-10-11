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
//        { action:'remitente', local, nombre }  → fija el "De:" del workspace
//        { action:'envio', on }                 → prende/apaga el envío real del ws
//        { action:'desconectar' }               → limpia la config local (no borra en Resend)
// Guard: solo el admin del workspace (incluido el dueño — sirve para la prueba
// E2E de reconectar el dominio de Mauricio desde la app).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getWorkspaceActual, getRolWsEfectivo, wsSuperAdmin } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { getSetting, setSetting } from '@/lib/settings';
import {
  createResendDomain, getResendDomain, verifyResendDomain,
  getEmailFrom, emailConectado, remitenteEsSandbox, resendConfigurado,
  type ResendDomain,
} from '@/lib/resend';
import { envioEmailHabilitado, setEnvioEmail } from '@/lib/envio-flags';
import { EMAIL_MAKO } from '@/lib/app-url';
import { esDominioDeMako } from '@/lib/email-remitente';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<{ ws: number } | { error: Response }> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return { error: Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar el email.' }, { status: 403 }) };
  }
  return { ws };
}

// Normaliza lo que escriba el usuario a un hostname: acepta que peguen una URL
// ("https://dominio.com/x") o un email ("hola@dominio.com") y extrae el dominio.
// IDN → punycode vía new URL (Node normaliza solo).
function normalizarDominio(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
  if (d.includes('@')) d = d.split('@').pop() ?? '';
  d = d.replace(/^www\./, '');
  try { d = new URL(`http://${d}`).hostname; } catch { return null; }
  // labels sin guión en los bordes; TLD que arranca con letra.
  const valido = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(d);
  return valido ? d : null;
}

// TITULARIDAD (anti-spoofing cross-tenant): con la cuenta única de Resend, un
// dominio verificado por el workspace B NO puede ser adoptado por el A. La
// fuente de verdad del reclamo es la setting resend_domain de cada workspace —
// consulta cross-ws deliberada (getSupabaseServer) porque la titularidad es
// global por definición.
async function reclamadoPorOtroWs(dominio: string, ws: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings')
    .select('workspace_id')
    .eq('key', 'resend_domain')
    .eq('value', dominio)
    .neq('workspace_id', ws)
    .limit(1);
  if (error) throw new Error(`reclamadoPorOtroWs: ${error.message}`);
  return ((data ?? []) as unknown[]).length > 0;
}

/**
 * ¿ESTE workspace es el de la PLATAFORMA (el del super admin)? Es el único que puede mandar con un email de
 * MaKo (décima tanda, EMAIL 1: «No permitas enviar emails con los email de MaKo, ellos deben poner sus propios
 * email»). Si no se puede saber, NO lo es: lo que se cierra es el email de MaKo, nunca el del negocio.
 */
async function esPlataforma(ws: number): Promise<boolean> {
  try { return ws === await wsSuperAdmin(); } catch { return false; }
}

/** El dominio de MaKo, en un negocio que no es la plataforma: no se conecta ni se usa de remitente. */
const NO_ES_TUYO = 'Ese dominio es de MaKo. Usa el de tu negocio.';

async function estadoActual(ws: number): Promise<Record<string, unknown>> {
  const [dominio, dominioId, remitente, conectado, envio, sandbox, keyOk] = await Promise.all([
    getSetting('resend_domain'),
    getSetting('resend_domain_id'),
    getEmailFrom(),
    emailConectado(),
    envioEmailHabilitado(),
    remitenteEsSandbox(),
    resendConfigurado(),
  ]);
  // Lo lee el «De» del editor de email y el emisor de «Probar» (`remitentesVinculados`, lib/email-remitente.ts).
  const plataforma = await esPlataforma(ws);
  const id = dominioId?.trim() || null;
  let vivo: ResendDomain | null = null;
  if (id) {
    const r = await getResendDomain(id);
    if (r.ok) vivo = r.domain;
  }
  return {
    conectado,
    envioHabilitado: envio,
    sandbox,
    resendConfigurado: keyOk,
    dominio: dominio?.trim() || null,
    remitente,
    estadoDominio: vivo?.status ?? null,
    records: vivo?.records ?? [],
    plataforma,
  };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  try {
    return Response.json({ ok: true, ...(await estadoActual(g.ws)) });
  } catch (e) {
    console.error(`[api:email/dominio GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;

  let body: { action?: string; dominio?: string; local?: string; nombre?: string; on?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'crear') {
      const dominio = normalizarDominio(String(body.dominio ?? ''));
      if (!dominio) return Response.json({ ok: false, error: 'Dominio inválido. Pon solo el dominio (ej: minegocio.com), sin https:// ni @.' }, { status: 400 });
      // El dominio de MaKo no lo conecta un cliente (EMAIL 1): sus emails salen desde el suyo.
      if (esDominioDeMako(dominio) && !(await esPlataforma(g.ws))) return Response.json({ ok: false, error: NO_ES_TUYO }, { status: 403 });
      // Anti-spoofing: un dominio reclamado por otro workspace no se puede adoptar.
      if (await reclamadoPorOtroWs(dominio, g.ws)) {
        return Response.json({ ok: false, error: `Ese dominio ya está conectado en otro workspace. Si es tuyo, escríbenos a ${EMAIL_MAKO}.` }, { status: 403 });
      }
      const r = await createResendDomain(dominio, 'sa-east-1');
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      await setSetting('resend_domain', r.domain.name);
      await setSetting('resend_domain_id', r.domain.id);
      return Response.json({ ok: true, ...(await estadoActual(g.ws)) });
    }

    if (body.action === 'verificar') {
      const id = (await getSetting('resend_domain_id'))?.trim();
      if (!id) return Response.json({ ok: false, error: 'Primero agrega tu dominio.' }, { status: 400 });
      const v = await verifyResendDomain(id);
      if (!v.ok) return Response.json({ ok: false, error: v.error }, { status: 502 });
      return Response.json({ ok: true, ...(await estadoActual(g.ws)) });
    }

    if (body.action === 'remitente') {
      const dominio = (await getSetting('resend_domain'))?.trim();
      const dominioId = (await getSetting('resend_domain_id'))?.trim();
      if (!dominio || !dominioId) return Response.json({ ok: false, error: 'Primero verifica tu dominio.' }, { status: 400 });
      // Y si el dominio cargado es el de MaKo (el ws1 lo tiene de cuando era el de la plataforma), tampoco se
      // arma un remitente con él (EMAIL 1).
      if (esDominioDeMako(dominio) && !(await esPlataforma(g.ws))) return Response.json({ ok: false, error: NO_ES_TUYO }, { status: 403 });
      // El remitente exige el dominio VERIFICADO en vivo (no alcanza con tenerlo cargado).
      const vivo = await getResendDomain(dominioId);
      if (!vivo.ok || vivo.domain.status !== 'verified') {
        return Response.json({ ok: false, error: 'Tu dominio todavía no está verificado. Carga los registros DNS y toca Verificar.' }, { status: 400 });
      }
      const local = String(body.local ?? '').trim().toLowerCase();
      // Saneo del display name: sin control chars, ángulos, comillas ni separadores
      // de direcciones (coma/;) — evita inyección de headers o From inválido.
      const nombre = String(body.nombre ?? '').replace(/[\r\n\t<>",;]/g, '').replace(/\s+/g, ' ').trim();
      if (!/^[a-z0-9._%+-]+$/.test(local)) return Response.json({ ok: false, error: 'La parte antes del @ solo puede tener letras, números y . _ -' }, { status: 400 });
      if (!nombre) return Response.json({ ok: false, error: 'Pon el nombre que van a ver tus leads.' }, { status: 400 });
      await setSetting('resend_from', `${nombre} <${local}@${dominio}>`);
      return Response.json({ ok: true, ...(await estadoActual(g.ws)) });
    }

    if (body.action === 'envio') {
      // Prender el envío real exige email conectado (dominio propio verificado,
      // o el remitente heredado del env en el caso del dueño). Apagar siempre se puede.
      if (body.on === true && !(await emailConectado())) {
        return Response.json({ ok: false, error: 'Primero verifica tu dominio y configura el remitente.' }, { status: 400 });
      }
      await setEnvioEmail(body.on === true);
      return Response.json({ ok: true, ...(await estadoActual(g.ws)) });
    }

    if (body.action === 'desconectar') {
      // Limpia SOLO la config del workspace; el dominio sigue en la cuenta de
      // Resend (borrarlo allá es manual — evita romper otro workspace por error).
      await setSetting('resend_domain', '');
      await setSetting('resend_domain_id', '');
      await setSetting('resend_from', '');
      await setEnvioEmail(false);
      return Response.json({ ok: true, ...(await estadoActual(g.ws)) });
    }

    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:email/dominio POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
