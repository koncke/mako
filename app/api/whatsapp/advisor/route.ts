// =============================================================================
// /api/whatsapp/advisor — MaKo asesora qué escribirle a un lead (metodología LM)
// =============================================================================
// action='recommend'      → analiza la conversación y devuelve 2-3 mensajes listos.
// action='chat'           → conversa sobre el lead; guarda historial POR contacto.
// action='history'        → historial del chat de asesoría de ese contacto.
// action='draft_template' → redacta una plantilla de Meta con la metodología.
// La conversación del lead la manda el cliente (ya la tiene cargada en pantalla);
// el historial de la asesoría se persiste en chart_sessions/chart_chats.
// =============================================================================

import type { NextRequest } from 'next/server';
import { recomendarMensajes, chatAdvisor, redactarTemplate, type WaMsg, type AdvisorLead } from '@/lib/whatsapp-advisor';
import { listSessions, createSession, getSessionMessages, appendMessage } from '@/lib/chart-chats';
import { integracionConectada } from '@/lib/credenciales';
import { getInstanciaRow } from '@/lib/evolution';

export const dynamic = 'force-dynamic';

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

/** Sesión de asesoría del contacto (una por contacto); se crea al primer chat. */
async function sesionDeContacto(groupId: string, contacto: string, crear: boolean) {
  const chartKey = chartKeyDe(groupId);
  const existentes = await listSessions(chartKey);
  if (existentes[0]) return existentes[0];
  if (!crear) return null;
  return createSession(chartKey, contacto || 'Lead', null);
}

export async function POST(req: NextRequest) {
  // El asesor sirve para AMBOS canales: WhatsApp oficial (Chatwoot/Meta) o el no
  // oficial (Evolution). Permitimos si cualquiera de los dos está conectado — un
  // workspace con solo Evolution también debe poder pedirle a MaKo qué escribir.
  if (!(await integracionConectada('whatsapp'))) {
    const inst = await getInstanciaRow().catch(() => null);
    if (inst?.estado !== 'conectado') {
      return Response.json({ ok: false, error: 'WhatsApp no está conectado en este workspace. Conecta el número oficial o el no oficial en la tab WhatsApp.' }, { status: 403 });
    }
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }

  try {
    switch (body.action) {
      case 'recommend': {
        const recomendacion = await recomendarMensajes(leadDe(body));
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
        if (!groupId || !mensaje) return Response.json({ ok: false, error: 'falta groupId o mensaje' }, { status: 400 });
        const lead = leadDe(body);
        const s = await sesionDeContacto(groupId, lead.contacto, true);
        if (!s) return Response.json({ ok: false, error: 'no se pudo abrir la sesión' }, { status: 500 });
        const historial = (await getSessionMessages(s.id)).map((m) => ({ role: m.role, content: m.content }));
        const reply = await chatAdvisor(lead, historial, mensaje);
        await appendMessage(s.id, 'user', mensaje);
        await appendMessage(s.id, 'assistant', reply);
        const messages = await getSessionMessages(s.id);
        return Response.json({ ok: true, messages });
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
