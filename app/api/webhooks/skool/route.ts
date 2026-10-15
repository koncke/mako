// =============================================================================
// Webhook: Skool (por Zapier) → quien pide entrar a tu comunidad entra solo al CRM
// =============================================================================
// Skool no tiene un webhook propio documentado: lo oficial son los triggers de su app de Zapier
// («Answered Membership Questions», «New Paid Member»). El Zap termina en «Webhooks by Zapier →
// POST» a esta dirección, con el header `X-MaKo-Clave`: una clave que el negocio INVENTA y pega en
// los dos lados (como el «Secret» de Cal.com). Es lo único que dice de quién es el aviso y lo único
// que lo prueba. La forma del cuerpo, en lib/skool-evento.ts.
//
// El orden es el del webhook de Hotmart (app/api/webhooks/hotmart/route.ts), por las mismas razones:
// el secreto del header → sha256 → `wsPorIdentificadorEstricto('skool', …)` → la credencial de ESE
// workspace (estricta) → igual al header, en tiempo constante → el evento → la puerta
// (lib/fuentes-leads.ts) adentro de `runWithWorkspace`. El MISMO 401 para «no te conozco» y «no
// coincide». Zapier reintenta un 5xx (no medido cuánto): 503 sólo a lo transitorio.
//
// ⚠️ La clave va en un HEADER y no en la URL a propósito: una URL con la clave queda en los logs de
// cada salto, y con ella cualquiera mete leads en el CRM de otro.

import type { NextRequest } from 'next/server';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { credWsEstricta } from '@/lib/credenciales';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { hashDeRuteo, igualesSeguro, secretoDelHeader } from '@/lib/ruteo-hash';
import { leerEventoSkool, lineaDelHistorialSkool, respuestasEnUnaLinea } from '@/lib/skool-evento';
import { ingresarDeFuente } from '@/lib/fuentes-leads';
import { runWithWorkspace } from '@/lib/workspace';
import { esErrorTransitorio, mensajeDeError } from '@/lib/calendly-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TOPE_CUERPO = 64 * 1024;

export async function GET() {
  return Response.json({ ok: true, endpoint: 'skool webhook (por Zapier)', usage: 'POST con X-MaKo-Clave' });
}

/** El cuerpo de Zapier: JSON («Payload Type: json») o un formulario («form»). */
function cuerpoDe(raw: string, tipo: string | null): unknown {
  if ((tipo ?? '').includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return JSON.parse(raw);
}

export async function POST(req: NextRequest) {
  const clave = secretoDelHeader(req.headers.get('x-mako-clave'));
  if (!clave) return Response.json({ ok: false, error: 'clave' }, { status: 401 });

  let ws: number | null = null;
  let guardada: string | null = null;
  try {
    ws = await wsPorIdentificadorEstricto('skool', hashDeRuteo(clave));
    guardada = ws == null ? null : await credWsEstricta('SKOOL_WEBHOOK_CLAVE', ws);
  } catch (err) {
    return responderFalloDeRuteo('skool', err, `sha256:${hashDeRuteo(clave).slice(0, 12)}`);
  }
  if (ws == null || !igualesSeguro(guardada, clave)) {
    console.warn(`[webhook:skool] clave rechazada (ws ${ws ?? '—'})`);
    return Response.json({ ok: false, error: 'clave' }, { status: 401 });
  }
  const wsFinal = ws;

  const raw = await req.text();
  if (raw.length > TOPE_CUERPO) return Response.json({ ok: false, error: 'demasiado_grande' }, { status: 413 });
  let cuerpo: unknown;
  try {
    cuerpo = cuerpoDe(raw, req.headers.get('content-type'));
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const ev = leerEventoSkool(cuerpo);
  if ('ignorado' in ev) {
    console.log(`[webhook:skool] ws ${wsFinal}: ignorado — ${ev.ignorado}`);
    return Response.json({ ok: true, ignorado: ev.ignorado });
  }
  try {
    const r = await runWithWorkspace(wsFinal, () => ingresarDeFuente({
      fuente: 'skool',
      contacto: ev.contacto,
      linea: lineaDelHistorialSkool(ev),
      creaLead: true,
      respuestas: ev.respuestas,
      // A un lead que ya estaba no se le pisan las respuestas que tenga: van al historial.
      lineaExtra: respuestasEnUnaLinea(ev.respuestas),
    }));
    console.log(`[webhook:skool] ${ev.tipo} ws=${wsFinal}: ${r.estado}${'motivo' in r ? ` (${r.motivo})` : ''}`);
    return Response.json({ ok: true, tipo: ev.tipo, ...r });
  } catch (e) {
    const motivo = mensajeDeError(e).slice(0, 300);
    if (esErrorTransitorio(e)) {
      console.error(`[webhook:skool] ws=${wsFinal} (TRANSITORIO) → 503: ${motivo}`);
      return Response.json({ ok: false, error: 'proceso', reintentar: true }, { status: 503 });
    }
    // El motivo va al log y NO al cuerpo: un error de la base puede traer el email de la persona.
    console.error(`[webhook:skool] ws=${wsFinal} → 200, reintentar no lo arregla: ${motivo}`);
    return Response.json({ ok: false, error: 'proceso', reintentar: false });
  }
}
