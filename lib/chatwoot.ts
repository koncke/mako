// =============================================================================
// Chatwoot — envío de WhatsApp (templates) para la nutrición del VSL funnel
// =============================================================================
// La app le pega directo a la API de Chatwoot (mismo inbox que ya usa Mauricio:
// "Whatsapp Mauricio", inbox 3, +5216863996369). Flujo calcado del n8n de
// recordatorios (probado en producción):
//   1) buscar/crear contacto por teléfono
//   2) crear conversación (contact_id + inbox_id)
//   3) POST mensaje con template_params
//
// Fuera de la ventana de servicio de 24h, WhatsApp SOLO permite plantillas
// APROBADAS en Meta. Los templates de nutrición hay que darlos de alta antes
// de poder enviarlos. Config en .env.local: CHATWOOT_BASE_URL / _ACCOUNT_ID /
// _API_TOKEN / _WA_INBOX_ID.
// =============================================================================

import 'server-only';

type Cfg = { apiBase: string; token: string; inbox: number };

function cfg(): Cfg {
  const base = process.env.CHATWOOT_BASE_URL;
  const account = process.env.CHATWOOT_ACCOUNT_ID;
  const token = process.env.CHATWOOT_API_TOKEN;
  const inbox = Number(process.env.CHATWOOT_WA_INBOX_ID ?? '3');
  if (!base || !account || !token) {
    throw new Error('Chatwoot no configurado (CHATWOOT_BASE_URL / _ACCOUNT_ID / _API_TOKEN)');
  }
  return { apiBase: `${base.replace(/\/$/, '')}/api/v1/accounts/${account}`, token, inbox };
}

function authHeaders(token: string): Record<string, string> {
  return { api_access_token: token, 'Content-Type': 'application/json' };
}

function normalizarTel(p: string): string {
  return (p || '').replace(/[\s\-().]/g, '');
}

async function cwFetch<T>(url: string, init: RequestInit, token: string): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(token), ...(init.headers ?? {}) } });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* deja body como texto */
  }
  if (!res.ok) {
    const msg = typeof body === 'string' ? body.slice(0, 160) : JSON.stringify(body).slice(0, 160);
    throw new Error(`Chatwoot ${res.status}: ${msg}`);
  }
  return body as T;
}

// ── Contacto ─────────────────────────────────────────────────────────────────
type Contacto = { id?: number; phone_number?: string };
type ContactsResp = {
  payload?: Contacto[] | { contacts?: Contacto[]; results?: Contacto[] };
};
type CreateContactResp = { payload?: { contact?: Contacto; id?: number }; id?: number };

async function buscarContacto(c: Cfg, phone: string): Promise<number | null> {
  const r = await cwFetch<ContactsResp>(
    `${c.apiBase}/contacts/search?q=${encodeURIComponent(phone)}`,
    { method: 'GET' },
    c.token,
  );
  const p = r.payload;
  const list: Contacto[] = Array.isArray(p) ? p : (p?.contacts ?? p?.results ?? []);
  const norm = normalizarTel(phone);
  const found = list.find((x) => normalizarTel(x.phone_number ?? '') === norm);
  return found?.id ?? null;
}

async function buscarOCrearContacto(c: Cfg, phone: string, name: string): Promise<number> {
  const tel = normalizarTel(phone);
  if (!tel) throw new Error('teléfono vacío');

  const existente = await buscarContacto(c, tel);
  if (existente) return existente;

  try {
    const r = await cwFetch<CreateContactResp>(
      `${c.apiBase}/contacts`,
      { method: 'POST', body: JSON.stringify({ phone_number: tel, name }) },
      c.token,
    );
    const cid = r.payload?.contact?.id ?? r.payload?.id ?? r.id;
    if (cid) return cid;
  } catch {
    /* el create puede fallar si el número ya existe → reintentamos search */
  }

  const reintento = await buscarContacto(c, tel);
  if (!reintento) throw new Error(`no se pudo crear/encontrar contacto ${tel}`);
  return reintento;
}

// ── Conversación ─────────────────────────────────────────────────────────────
type ConvResp = { id?: number; payload?: { id?: number } };

async function crearConversacion(c: Cfg, contactId: number): Promise<number> {
  const r = await cwFetch<ConvResp>(
    `${c.apiBase}/conversations`,
    { method: 'POST', body: JSON.stringify({ contact_id: contactId, inbox_id: c.inbox }) },
    c.token,
  );
  const id = r.id ?? r.payload?.id;
  if (!id) throw new Error('Chatwoot: conversación sin id');
  return id;
}

// ── API pública: enviar un template de WhatsApp ──────────────────────────────
export type WhatsappTemplate = {
  name: string;                        // template aprobado en Meta (ej. 'nutricion_dia1')
  category: 'marketing' | 'utility' | 'authentication';
  language: string;                    // ej. 'es_MX'
  bodyParams: Record<string, string>;  // variables del cuerpo → processed_params.body
};

export type SendResult =
  | { ok: true; conversationId: number }
  | { ok: false; error: string };

/**
 * Envía un template de WhatsApp a un teléfono vía Chatwoot. Crea/reusa el
 * contacto y la conversación. `content` es el texto renderizado (lo que se ve
 * en el inbox); `template` son los datos que Meta exige para el envío.
 */
export async function sendWhatsappTemplate(params: {
  phone: string;
  name: string;
  content: string;
  template: WhatsappTemplate;
}): Promise<SendResult> {
  try {
    const c = cfg();
    const contactId = await buscarOCrearContacto(c, params.phone, params.name);
    const conversationId = await crearConversacion(c, contactId);
    await cwFetch(
      `${c.apiBase}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: params.content,
          message_type: 'outgoing',
          template_params: {
            name: params.template.name,
            category: params.template.category,
            language: params.template.language,
            processed_params: { body: params.template.bodyParams },
          },
        }),
      },
      c.token,
    );
    return { ok: true, conversationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
