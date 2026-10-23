// =============================================================================
// Webhook: Zapier o Make → un lead de un formulario de Meta entra solo al CRM
// =============================================================================
// El puente de leads (23/10/2026, lib/zapier-lead.ts): la app de MaKo todavía no tiene `leads_retrieval`, así que el
// negocio arma un Zap con «Facebook Lead Ads → New Lead» y el paso «Webhooks by Zapier → POST» a esta dirección, con
// el header `X-MaKo-Clave`: una clave que el negocio INVENTA y pega en los dos lados (como el «Secret» de Cal.com).
// Es lo único que dice de quién es el aviso y lo único que lo prueba. Make hace lo mismo con su módulo HTTP.
//
// El orden es el del webhook de Skool (app/api/webhooks/skool/route.ts), por las mismas razones: el secreto del
// header → sha256 → `wsPorIdentificadorEstricto('zapier', …)` → la credencial de ESE workspace (estricta) → igual al
// header, en tiempo constante → el lead → `upsertLeadFromMeta` adentro de `runWithWorkspace`. El MISMO 401 para «no
// te conozco» y «no coincide». Zapier reintenta un 5xx (no medido cuánto): 503 sólo a lo transitorio.
//
// ⚠️ La clave va en un HEADER y no en la URL a propósito: una URL con la clave queda en los logs de cada salto, y con
// ella cualquiera mete leads en el CRM de otro.
//
// ⚠️ Y UN AVISO SIN CONTACTO VA 422, NO 200 (a diferencia de Skool): un Zap mal mapeado que manda leads sin email ni
// teléfono tiene que verse en el historial de tareas de Zapier, que es lo que le llega por mail al que lo armó. Con un
// 200, el puente «andaría» y no entraría nadie.

import type { NextRequest } from 'next/server';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { credWsEstricta } from '@/lib/credenciales';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { hashDeRuteo, igualesSeguro, secretoDelHeader } from '@/lib/ruteo-hash';
import { leerLeadDeZapier } from '@/lib/zapier-lead';
import { ingresarLeadDeZapier } from '@/lib/zapier-leads';
import { KEY_ESTADO_ZAPIER, estadoDespuesDe, parsearEstadoZapier } from '@/lib/zapier-estado';
import { getSetting, setSetting } from '@/lib/settings';
import { runWithWorkspace } from '@/lib/workspace';
import { esErrorTransitorio, mensajeDeError } from '@/lib/calendly-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TOPE_CUERPO = 64 * 1024;

export async function GET() {
  return Response.json({ ok: true, endpoint: 'webhook de leads de Meta (Make o Zapier)', usage: 'POST con X-MaKo-Clave' });
}

/** El cuerpo de Zapier o Make: JSON («Payload Type: json»), o un formulario («form»). */
function cuerpoDe(raw: string, tipo: string | null): unknown {
  if ((tipo ?? '').includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return JSON.parse(raw);
}

/**
 * Anota cuándo llegó el aviso y si fue un lead (lo lee la tarjeta de /integraciones). Nunca tira ni demora la respuesta:
 * es información para dibujar, no parte del alta.
 */
async function anotarEntrega(ws: number, r: { lead: boolean; motivo?: string | null }): Promise<void> {
  try {
    await runWithWorkspace(ws, async () => {
      const previo = parsearEstadoZapier(await getSetting(KEY_ESTADO_ZAPIER));
      await setSetting(KEY_ESTADO_ZAPIER, JSON.stringify(estadoDespuesDe(previo, r, new Date())));
    });
  } catch (e) {
    console.error(`[webhook:zapier] ws=${ws}: no pude anotar el estado de la tarjeta: ${mensajeDeError(e).slice(0, 200)}`);
  }
}

export async function POST(req: NextRequest) {
  const clave = secretoDelHeader(req.headers.get('x-mako-clave'));
  if (!clave) return Response.json({ ok: false, error: 'clave' }, { status: 401 });

  let ws: number | null = null;
  let guardada: string | null = null;
  try {
    ws = await wsPorIdentificadorEstricto('zapier', hashDeRuteo(clave));
    guardada = ws == null ? null : await credWsEstricta('ZAPIER_LEADS_CLAVE', ws);
  } catch (err) {
    return responderFalloDeRuteo('zapier', err, `sha256:${hashDeRuteo(clave).slice(0, 12)}`);
  }
  if (ws == null || !igualesSeguro(guardada, clave)) {
    console.warn(`[webhook:zapier] clave rechazada (ws ${ws ?? '—'})`);
    return Response.json({ ok: false, error: 'clave' }, { status: 401 });
  }
  const wsFinal = ws;

  const raw = await req.text();
  if (raw.length > TOPE_CUERPO) return Response.json({ ok: false, error: 'demasiado_grande' }, { status: 413 });
  let cuerpo: unknown;
  try {
    cuerpo = cuerpoDe(raw, req.headers.get('content-type'));
  } catch {
    await anotarEntrega(wsFinal, { lead: false, motivo: 'el cuerpo no es JSON' });
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const lead = leerLeadDeZapier(cuerpo);
  if ('ignorado' in lead) {
    console.log(`[webhook:zapier] ws ${wsFinal}: ignorado — ${lead.ignorado}`);
    await anotarEntrega(wsFinal, { lead: false, motivo: lead.ignorado });
    return Response.json({ ok: false, error: lead.porque === 'contacto' ? 'sin_contacto' : 'bad_json', detalle: lead.ignorado }, { status: lead.porque === 'contacto' ? 422 : 400 });
  }

  try {
    const r = await runWithWorkspace(wsFinal, () => ingresarLeadDeZapier(wsFinal, lead));
    console.log(`[webhook:zapier] ws=${wsFinal}: ${r.estado} lead=${r.leadId}${r.anunciado ? ' (anunciado)' : ''}`);
    await anotarEntrega(wsFinal, { lead: true });
    // Lo que se descartó vuelve en la respuesta: es lo único que ve el que arma el Zap para corregir su mapeo.
    return Response.json({ ok: true, ...r, ...(lead.sinUsar.length ? { sin_usar: lead.sinUsar } : {}) });
  } catch (e) {
    const motivo = mensajeDeError(e).slice(0, 300);
    if (esErrorTransitorio(e)) {
      console.error(`[webhook:zapier] ws=${wsFinal} (TRANSITORIO) → 503: ${motivo}`);
      return Response.json({ ok: false, error: 'proceso', reintentar: true }, { status: 503 });
    }
    // El motivo va al log y NO al cuerpo: un error de la base puede traer el email de la persona.
    console.error(`[webhook:zapier] ws=${wsFinal} → 200, reintentar no lo arregla: ${motivo}`);
    return Response.json({ ok: false, error: 'proceso', reintentar: false });
  }
}
