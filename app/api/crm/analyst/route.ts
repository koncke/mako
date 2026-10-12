// =============================================================================
// /api/crm/analyst — el chat «MaKo Analyst» de la ficha de un lead
// =============================================================================
// GET  ?leadId=N                                         → { ok, lead, sesion, mensajes, propuestas }
// POST { action:'send', leadId, sessionId?, mensaje }    → RespuestaTurno
// POST multipart: leadId, sessionId?, mensaje, adjuntos[] → RespuestaTurno   (fotos y PDF)
// POST { action:'confirmar'|'cancelar', leadId, sessionId, pendienteId } → ResultadoTarjeta
//
// Lo que decide vive en lib/mako-analyst-lead.ts (quién, qué lead, qué lee MaKo) y el turno en
// lib/mako-turno-app.ts: esto sólo traduce HTTP. PRIVADA: no está en PUBLICOS
// (lib/rutas-publicas.ts) y además exige la sesión adentro, en cada pedido, con el lead del
// workspace de la sesión (`analystDelRequest`).
//
// ⚠️ CONFIRMAR VA POR ACÁ Y NO POR UNA SERVER ACTION: el techo de una action lo pone la PÁGINA
// que la monta (/crm, /crm/[id]), y confirmar puede correr una acción lenta con la pendiente ya
// reclamada (docs/hallazgos-infra.md). Acá el techo es el de la ruta.
//
// ⚠️ LOS ARCHIVOS VAN EN MULTIPART con los topes de lib/mako-adjuntos.ts (4 archivos, 4 MB):
// Vercel corta todo POST de más de ~4,5 MB con un 413 en TEXTO PLANO antes de llegar acá, y la
// pantalla lee la respuesta con `res.text()` primero (app/m/mako/chat-ui.ts → leerRespuesta).
//
// ⚠️ maxDuration 300: el doer encadena hasta 8 pasos de herramientas y leer una foto tardó 52 s
// medidos (11/10/2026). El `fetch` de la pantalla va con `AbortSignal.timeout(305_000)`.
// =============================================================================

import type { NextRequest } from 'next/server';
import { analystDelRequest, abrirDelLead, turnoDelLead, tarjetaDelLead, type AnalystDelLead } from '@/lib/mako-analyst-lead';
import { validarAdjuntos, ERROR_ADJUNTO, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES, MARGEN_MULTIPART_BYTES, type AdjuntoListo } from '@/lib/mako-adjuntos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });

const idDe = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function GET(req: NextRequest) {
  try {
    const a = await analystDelRequest(req.nextUrl.searchParams.get('leadId'));
    if ('error' in a) return json({ ok: false, error: a.error }, a.status);
    const c = await abrirDelLead(a);
    return json({ ok: true, lead: a.lead, ...c });
  } catch (e) {
    console.error('[api/crm/analyst] GET', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'No pude cargar el chat.' }, 500);
  }
}

async function mandar(a: AnalystDelLead, sessionId: number | null, mensaje: string, adjuntos: AdjuntoListo[]) {
  if (!mensaje.trim() && !adjuntos.length) return json({ ok: false, error: 'Escribe algo.' }, 400);
  const r = await turnoDelLead(a, sessionId, { mensaje, adjuntos });
  if (!r) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
  // Un fallo del modelo NO es un error HTTP: el mensaje quedó guardado y el aviso viaja adentro.
  return json({ ...r });
}

export async function POST(req: NextRequest) {
  try {
    const tipo = req.headers.get('content-type') ?? '';
    if (tipo.toLowerCase().startsWith('multipart/form-data')) {
      // El largo se mira ANTES de parsear: después del formData() el cuerpo ya está en memoria.
      const largo = Number(req.headers.get('content-length') ?? 0);
      if (largo > TOPE_TOTAL_BYTES + MARGEN_MULTIPART_BYTES) return json({ ok: false, error: ERROR_ADJUNTO.pesado }, 413);
      const form = await req.formData();
      const a = await analystDelRequest(form.get('leadId'));
      if ('error' in a) return json({ ok: false, error: a.error }, a.status);
      const archivos = form.getAll('adjuntos').filter((f): f is File => f instanceof File);
      if (archivos.length > TOPE_ADJUNTOS) return json({ ok: false, error: ERROR_ADJUNTO.muchos }, 400);
      if (archivos.reduce((n, f) => n + f.size, 0) > TOPE_TOTAL_BYTES) return json({ ok: false, error: ERROR_ADJUNTO.pesado }, 413);
      const leidos = await Promise.all(archivos.map(async (f) => ({ nombre: f.name, mime: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })));
      const v = validarAdjuntos(leidos);
      if (!v.ok) return json({ ok: false, error: v.error }, 400);
      return await mandar(a, idDe(form.get('sessionId')), String(form.get('mensaje') ?? ''), v.adjuntos);
    }

    let body: { action?: unknown; leadId?: unknown; sessionId?: unknown; mensaje?: unknown; pendienteId?: unknown };
    try { body = await req.json(); } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
    const a = await analystDelRequest(body.leadId);
    if ('error' in a) return json({ ok: false, error: a.error }, a.status);

    if (body.action === 'send') {
      return await mandar(a, idDe(body.sessionId), typeof body.mensaje === 'string' ? body.mensaje : '', []);
    }
    if (body.action === 'confirmar' || body.action === 'cancelar') {
      const sessionId = idDe(body.sessionId);
      const pendienteId = idDe(body.pendienteId);
      if (sessionId == null || pendienteId == null) return json({ ok: false, error: 'Acción inválida' }, 400);
      const r = await tarjetaDelLead(a, body.action, sessionId, pendienteId);
      return json({ ...r });
    }
    return json({ ok: false, error: 'Pedido inválido.' }, 400);
  } catch (e) {
    console.error('[api/crm/analyst] POST', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'Algo falló de nuestro lado. Intenta de nuevo.' }, 500);
  }
}
