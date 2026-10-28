// =============================================================================
// /api/whatsapp/advisor — MaKo asesora qué escribirle a un lead (metodología LM)
// =============================================================================
// action='recommend'      → analiza la conversación y devuelve 2-3 mensajes listos.
// action='chat'           → conversa sobre el lead; guarda historial POR contacto. Con fotos o PDF (multipart, 28/10/2026): se
//                            leen acá (lib/adjuntos-del-chat.ts) y su lectura va con el pedido; al historial, lo escrito y los nombres.
// action='history'        → historial del chat de asesoría de ese contacto.
// action='draft_template' → redacta una plantilla de Meta con la metodología.
// La conversación del lead la manda el cliente (ya la tiene cargada en pantalla);
// el historial de la asesoría se persiste en chart_sessions/chart_chats.
// =============================================================================

import type { NextRequest } from 'next/server';
import { recomendarMensajes, chatAdvisor, redactarTemplate, type WaMsg, type AdvisorLead } from '@/lib/whatsapp-advisor';
import { listSessions, createSession, getSessionMessages, appendMessage } from '@/lib/chart-chats';
import { getInstanciaRow } from '@/lib/evolution';
import { leerLosArchivos, pedidoConArchivos, traeArchivos } from '@/lib/adjuntos-del-chat';
import { memoriaConArchivos, pedidoConLecturas, type AdjuntoListo } from '@/lib/mako-adjuntos';

export const dynamic = 'force-dynamic';
/** Con fotos o PDF, la lectura (hasta 90 s: lib/adjuntos-del-chat.ts) y el modelo comparten esto. */
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const chartKeyDe = (groupId: string) => `wa-advisor:${groupId}`;

function leadDe(body: Record<string, unknown>): AdvisorLead {
  const mensajes: WaMsg[] = Array.isArray(body.mensajes)
    ? (body.mensajes as Record<string, unknown>[]).map((m) => ({ saliente: !!m.saliente, texto: typeof m.texto === 'string' ? m.texto : null }))
    : [];
  return {
    contacto: typeof body.contacto === 'string' && body.contacto ? body.contacto : 'el lead',
    empresa: typeof body.empresa === 'string' ? body.empresa : null,
    etapaLabel: typeof body.etapaLabel === 'string' ? body.etapaLabel : null,
    ventanaAbierta: !!body.ventanaAbierta,
    mensajes,
  };
}

/**
 * Suma lo que el lead contestó en el formulario de la agenda (#361). El `leadId` lo manda
 * la bandeja; `getLead` va por `getTenantDb`, así que un id de OTRO negocio devuelve null y
 * no entra nada. Si falla, el panel aconseja igual, sin el bloque.
 */
async function conFormulario(lead: AdvisorLead, body: Record<string, unknown>): Promise<AdvisorLead> {
  const leadId = typeof body.leadId === 'number' && Number.isInteger(body.leadId) && body.leadId > 0 ? body.leadId : null;
  if (!leadId) return lead;
  try {
    const [{ getLead, getLeadRespuestas }, { bloqueFormulario }] = await Promise.all([
      import('@/lib/leads'), import('@/lib/setter-conversacion'),
    ]);
    const fila = await getLead(leadId);
    const formulario = fila ? bloqueFormulario(await getLeadRespuestas(fila), 'asesor') : '';
    return formulario ? { ...lead, formulario } : lead;
  } catch {
    return lead;
  }
}

/** Sesión de asesoría del contacto (una por contacto); se crea al primer chat. */
async function sesionDeContacto(groupId: string, contacto: string, crear: boolean) {
  const chartKey = chartKeyDe(groupId);
  const existentes = await listSessions(chartKey);
  if (existentes[0]) return existentes[0];
  if (!crear) return null;
  return createSession(chartKey, contacto || 'Lead', null);
}

export async function POST(req: NextRequest) {
  // El asesor sirve con el número de empresa (Evolution) conectado. (Hasta el 09/10/2026
  // también con el WhatsApp oficial, Chatwoot, que se borró con toda la integración.)
  const inst = await getInstanciaRow().catch(() => null);
  if (inst?.estado !== 'conectado') {
    return Response.json({ ok: false, error: 'WhatsApp no está conectado en este workspace. Conecta tu número en la tab WhatsApp.' }, { status: 403 });
  }
  let body: Record<string, unknown>;
  let adjuntos: AdjuntoListo[] = [];
  if (traeArchivos(req)) {
    const p = await pedidoConArchivos(req);
    if (!p.ok) return Response.json({ ok: false, error: p.error }, { status: p.status });
    try { body = JSON.parse(p.campos.datos ?? '{}'); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
    adjuntos = p.adjuntos;
  } else {
    try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  }

  try {
    switch (body.action) {
      case 'recommend': {
        const recomendacion = await recomendarMensajes(await conFormulario(leadDe(body), body));
        return Response.json({ ok: true, recomendacion });
      }
      case 'history': {
        const groupId = typeof body.groupId === 'string' ? body.groupId : '';
        if (!groupId) return Response.json({ ok: false, error: 'falta groupId' }, { status: 400 });
        const s = await sesionDeContacto(groupId, '', false);
        const messages = s ? await getSessionMessages(s.id) : [];
        return Response.json({ ok: true, messages });
      }
      case 'chat': {
        const groupId = typeof body.groupId === 'string' ? body.groupId : '';
        const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
        if (!groupId || (!mensaje && !adjuntos.length)) return Response.json({ ok: false, error: 'falta groupId o mensaje' }, { status: 400 });
        const { lecturas, noLeidos } = await leerLosArchivos(adjuntos, 'wa-advisor-chat');
        const noPude = noLeidos.length ? `No pude leer ${noLeidos.map((n) => `«${n}»`).join(', ')}: escríbeme lo que dice.` : '';
        // Con archivos y nada legible ni escrito, no hay pedido: no se gasta el modelo.
        if (adjuntos.length && !lecturas.length && !mensaje) return Response.json({ ok: false, error: noPude }, { status: 422 });
        const lead = await conFormulario(leadDe(body), body);
        const s = await sesionDeContacto(groupId, lead.contacto, true);
        if (!s) return Response.json({ ok: false, error: 'no se pudo abrir la sesión' }, { status: 500 });
        const historial = (await getSessionMessages(s.id)).map((m) => ({ role: m.role, content: m.content }));
        const reply = await chatAdvisor(lead, historial, pedidoConLecturas(mensaje, lecturas, adjuntos[0]?.tipo));
        await appendMessage(s.id, 'user', memoriaConArchivos(mensaje, adjuntos.map((a) => a.nombre)));
        await appendMessage(s.id, 'assistant', reply);
        const messages = await getSessionMessages(s.id);
        return Response.json({ ok: true, messages, ...(noPude ? { aviso: noPude } : {}) });
      }
      case 'draft_template': {
        const objetivo = typeof body.objetivo === 'string' ? body.objetivo : '';
        const etapa = typeof body.etapa === 'string' ? body.etapa : '';
        const draft = await redactarTemplate(objetivo, etapa);
        return Response.json({ ok: true, draft });
      }
      default:
        return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    console.error(`[api:whatsapp/advisor] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
