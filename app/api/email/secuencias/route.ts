// =============================================================================
// API interna: secuencias de email + KPIs para la tab /email
// =============================================================================
// GET   → { kpis, secuencias, etapas, triggers } (secuencias de email + stats)
// PATCH → activar/pausar, editar pasos, renombrar, o crear una secuencia nueva.
//         Body: { id, activa? } | { id, pasos? } | { id, nombre? }
//             | { action:'crear', nombre, etapa, trigger }
// =============================================================================

import type { NextRequest } from 'next/server';
import { setSecuenciaActiva, setSecuenciaPasos, type PasoSecuencia } from '@/lib/nutricion';
import {
  getEmailKpis, getEmailSecuencias, crearEmailSecuencia, actualizarMetaEmailSecuencia,
  ETAPAS, TRIGGERS,
} from '@/lib/email-marketing';
import { EMAIL_SEND_ENABLED, resendConfigurado } from '@/lib/resend';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  try {
    const [kpis, secuencias, resendOk] = await Promise.all([getEmailKpis(), getEmailSecuencias(), resendConfigurado()]);
    return Response.json({ ok: true, kpis, secuencias, etapas: ETAPAS, triggers: TRIGGERS, sendEnabled: EMAIL_SEND_ENABLED, resendConfigurado: resendOk });
  } catch (e) {
    console.error(`[api:email/secuencias GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: { id?: unknown; activa?: unknown; pasos?: unknown; nombre?: unknown; action?: unknown; etapa?: unknown; trigger?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  try {
    if (body.action === 'crear') {
      const id = await crearEmailSecuencia(String(body.nombre ?? ''), String(body.etapa ?? 'nutri'), String(body.trigger ?? 'manual'));
      return Response.json({ ok: true, id });
    }

    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
    }

    if (Array.isArray(body.pasos)) {
      // Las secuencias de email son single-channel: forzamos canal='email' en cada
      // paso para que la tab nunca convierta una secuencia en mixta sin querer.
      const pasos = (body.pasos as PasoSecuencia[]).map((p) => ({ ...p, canal: 'email' as const, template_wa: null }));
      await setSecuenciaPasos(id, pasos);
    }
    if (typeof body.nombre === 'string' || typeof body.etapa === 'string' || typeof body.trigger === 'string') {
      await actualizarMetaEmailSecuencia(id, {
        nombre: typeof body.nombre === 'string' ? body.nombre : undefined,
        etapa: typeof body.etapa === 'string' ? body.etapa : undefined,
        trigger_tipo: typeof body.trigger === 'string' ? body.trigger : undefined,
      });
    }
    if (typeof body.activa === 'boolean') {
      await setSecuenciaActiva(id, body.activa);
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[api:email/secuencias PATCH] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
