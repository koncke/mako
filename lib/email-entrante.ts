// =============================================================================
// email-entrante — un email que LLEGA dispara las automatizaciones de su lead
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, CRON 8): «Si recibo un email, que se pueda configurar
// automatizaciones». Las reglas (de quién es, de qué lead, qué no dispara) viven puras en
// lib/email-entrante-reglas.ts, con su porqué y lo que se midió. Acá, lo que toca la base.
//
// EL CAMINO, en orden, y cada paso con su salida escrita:
//   1. El webhook de Resend (`email.received`) ya llega firmado: lo verifica quien llama
//      (app/api/webhooks/email-entrante/route.ts).
//   2. DE QUIÉN ES, con la lectura ESTRICTA de los dominios reclamados: con la base caída, «no pude
//      leer» no es «no es de nadie» (AGENTS.md). Transitorio → 503 (Resend reintenta con Svix);
//      lo que no se arregla reintentando → 200 y anotado en el log.
//   3. LA FILA en `email_entrantes` (mig 0245) ES la deduplicación —`email_id` único: un reintento
//      del webhook trae el mismo— Y el rastro: lo que se descarta (sin workspace, sin lead,
//      automático, ambiguo) queda escrito con su motivo (AGENTS.md, «Una política puede RECHAZAR; no
//      puede no dejar rastro»). Se abre DESPUÉS del chequeo que puede cortar (el ruteo), y sin la
//      tabla no se dispara nada: sin fila no hay cómo deduplicar, y un reintento dispararía dos veces.
//   4. EL LEAD, dentro de su workspace (`runWithWorkspace`), por su email EXACTO.
//   5. EL DISPARO, por UNA función (`enrolarPorEmailRecibido`).
//
// ⚠️ NO MANDA NADA NI TOCA LA FICHA DEL LEAD: inscribe en las automatizaciones de ese evento, y lo que
// salga después lo manda el motor con sus frenos. Que un email del lead PAUSE una automatización que
// le está escribiendo (como una respuesta de WhatsApp) es del motor: queda en docs/hallazgos-chatbot.md.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getTenantDb, runWithWorkspace } from './workspace';
import { enrolarPorEvento, type CtxEvento } from './nutricion';
import { esErrorTransitorio, mensajeDeError } from './calendly-error';
import { responderFalloDeRuteo } from './webhook-fallo-ruteo';
import { EVENTOS_EMAIL } from './disparadores';
import {
  leerEmailRecibido, workspaceDelEmail, leadDelEmail, esRemitenteAutomatico, escaparIlike, yaProcesado,
  EVENTO_EMAIL_RECIBIDO, type EmailRecibido, type DominioReclamado, type EstadoEntrante,
} from './email-entrante-reglas';

const TABLA = 'email_entrantes';
const LOG = '[email-entrante]';

/**
 * EL DISPARO: UNA puerta. El `ctx` es el que lee `disparaPorEvento` (lib/disparadores.ts): para el email
 * alcanza con el evento —el CRON «Recibes un email» no filtra por casilla ni por asunto—, y el subtipo
 * va igual, en las palabras del CRON (`EVENTOS_EMAIL`), por si mañana el email tiene más de uno.
 *
 * (Hasta la segunda pasada de la sexta tanda, 09/10/2026, iba con dos casts y un `ctx.email` que no
 * leía nadie: lo de la casilla y el asunto, si algún día filtra, se suma a `CtxEvento` y a
 * `disparaPorEvento` juntos.)
 */
export async function enrolarPorEmailRecibido(leadId: number): Promise<number> {
  const ctx: CtxEvento = { subtipo: EVENTOS_EMAIL[0].subtipo };
  return enrolarPorEvento(leadId, EVENTO_EMAIL_RECIBIDO, ctx);
}

/**
 * Los dominios que reclamó cada workspace (`resend_domain`). ESTRICTA: un error de la base TIRA, con
 * `code`/`details`/`hint` para el clasificador de transitorios. Cross-workspace a propósito: la
 * titularidad de un dominio es global (app/api/email/dominio, `reclamadoPorOtroWs`).
 */
export async function dominiosReclamados(): Promise<DominioReclamado[]> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', 'resend_domain');
  if (error) {
    throw Object.assign(new Error(`app_settings (resend_domain): ${error.message}`), { code: error.code, details: error.details, hint: error.hint });
  }
  return ((data ?? []) as Array<{ workspace_id: number | string; value: string | null }>)
    .filter((r) => typeof r.value === 'string' && r.value.trim())
    .map((r) => ({ ws: Number(r.workspace_id), dominio: String(r.value) }));
}

export type RespuestaEntrante = { status: number; body: Record<string, unknown> };

const responder = (status: number, body: Record<string, unknown>): RespuestaEntrante => ({ status, body });

/** El código de PostgREST / Postgres de una tabla que no existe (la 0245 sin aplicar). */
const esTablaQueFalta = (code: unknown) => code === '42P01' || code === 'PGRST205';

/** Escribe el estado de la fila. Best-effort: el rastro no cambia la respuesta. */
async function marcar(emailId: string, patch: { estado: EstadoEntrante; motivo?: string | null; lead_id?: number | null; inscripciones?: number | null }): Promise<void> {
  const { error } = await getSupabaseServer().from(TABLA).update({ ...patch, updated_at: new Date().toISOString() }).eq('email_id', emailId);
  if (error) console.error(`${LOG} no pude marcar ${emailId} como ${patch.estado}: ${error.message}`);
}

/**
 * Abre la fila del email (la deduplicación). `nuevo`: hay que procesarlo. `duplicado`: ya se
 * procesó (o se está procesando). Un `error` anterior se RECLAMA con compare-and-set: dos reintentos
 * a la vez no lo procesan dos veces.
 */
async function abrirFila(email: EmailRecibido, ws: number | null, estado: EstadoEntrante, motivo: string | null):
  Promise<'nuevo' | 'duplicado' | { error: unknown }> {
  const db = getSupabaseServer();
  const { error } = await db.from(TABLA).insert({
    email_id: email.emailId, workspace_id: ws, de: email.de, para: email.para, asunto: email.asunto,
    message_id: email.messageId, recibido_at: email.recibidoAt, estado, motivo,
  });
  if (!error) return 'nuevo';
  if (error.code !== '23505') return { error: Object.assign(new Error(`${TABLA}: ${error.message}`), { code: error.code, details: error.details, hint: error.hint }) };
  const { data: previa, error: e2 } = await db.from(TABLA).select('estado').eq('email_id', email.emailId).maybeSingle();
  if (e2) return { error: Object.assign(new Error(`${TABLA}: ${e2.message}`), { code: e2.code, details: e2.details, hint: e2.hint }) };
  if (yaProcesado((previa as { estado?: unknown } | null)?.estado)) return 'duplicado';
  const { data: reclamada, error: e3 } = await db.from(TABLA)
    .update({ estado: 'procesando', motivo: null, updated_at: new Date().toISOString() })
    .eq('email_id', email.emailId).eq('estado', 'error').select('email_id');
  if (e3) return { error: Object.assign(new Error(`${TABLA}: ${e3.message}`), { code: e3.code, details: e3.details, hint: e3.hint }) };
  return (reclamada ?? []).length ? 'nuevo' : 'duplicado';
}

/** Un fallo: 503 si reintentar lo arregla (Resend reintenta), 200 con el motivo si no. */
function fallo(donde: string, e: unknown): RespuestaEntrante {
  const transitorio = esErrorTransitorio(e);
  const mensaje = mensajeDeError(e).slice(0, 300);
  console.error(`${LOG} ${donde}${transitorio ? ' (TRANSITORIO) → 503' : ' → 200'}: ${mensaje}`);
  return transitorio
    ? responder(503, { ok: false, error: donde, reintentar: true })
    : responder(200, { ok: false, error: donde, reintentar: false, message: mensaje });
}

/**
 * «No pude leer de quién es» pasa por el MISMO clasificador que los demás webhooks
 * (`responderFalloDeRuteo`, lib/webhook-fallo-ruteo.ts): 503 sólo si reintentar lo arregla, y SIEMPRE
 * anotado en el super admin (`webhooks.fallos_ruteo`). Antes iba sólo al log, que a la hora no existe.
 */
async function falloDeRuteo(e: unknown, identificador: string | null): Promise<RespuestaEntrante> {
  const r = await responderFalloDeRuteo('email', e, identificador);
  return responder(r.status, (await r.json()) as Record<string, unknown>);
}

/** Un `email.received` ya verificado: de quién es, de qué lead, y el disparo. */
export async function recibirEmailEntrante(raw: unknown): Promise<RespuestaEntrante> {
  const email = leerEmailRecibido(raw);
  if (!email) return responder(200, { ok: true, ignorado: 'no es un email recibido' });

  // 2. De quién es.
  let reclamados: DominioReclamado[];
  try { reclamados = await dominiosReclamados(); } catch (e) { return falloDeRuteo(e, email.para[0] ?? null); }
  const destino = workspaceDelEmail(email.para, reclamados);

  // 3. La fila: la deduplicación y el rastro. Sin workspace también queda escrita, con su motivo.
  const automatico = destino.ws != null && esRemitenteAutomatico(email.de);
  const estadoInicial: EstadoEntrante = destino.ws == null ? 'sin_workspace' : automatico ? 'automatico' : 'procesando';
  const motivoInicial = destino.ws == null ? destino.motivo : automatico ? 'remitente automático' : null;
  const fila = await abrirFila(email, destino.ws, estadoInicial, motivoInicial);
  if (typeof fila === 'object') {
    const code = (fila.error as { code?: unknown }).code;
    if (esTablaQueFalta(code)) {
      console.error(`${LOG} falta la tabla ${TABLA} (mig 0245): no se dispara nada sin poder deduplicar`);
      return responder(200, { ok: false, error: 'sin_tabla' });
    }
    return fallo('registro', fila.error);
  }
  if (fila === 'duplicado') return responder(200, { ok: true, duplicado: true });
  if (destino.ws == null) {
    console.warn(`${LOG} ${email.emailId}: no es de ningún negocio (${destino.motivo})`);
    return responder(200, { ok: true, ignorado: destino.motivo });
  }
  if (automatico) return responder(200, { ok: true, ignorado: 'automatico' });
  const ws = destino.ws;

  // 4 y 5. El lead, adentro de su workspace, y el disparo.
  try {
    return await runWithWorkspace(ws, async () => {
      // El patrón trae candidatos (con `\ % _` escapados); la decisión es una igualdad exacta.
      const { data, error } = await (await getTenantDb()).from('leads').select('id, email').ilike('email', escaparIlike(email.de)).limit(10);
      if (error) throw Object.assign(new Error(`leads: ${error.message}`), { code: error.code, details: error.details, hint: error.hint });
      const lead = leadDelEmail((data ?? []) as Array<{ id: unknown; email: unknown }>, email.de);
      if (lead.leadId == null) {
        await marcar(email.emailId, { estado: lead.motivo, motivo: lead.motivo === 'ambiguo' ? 'varios leads con ese email' : 'ningún lead con ese email' });
        return responder(200, { ok: true, ignorado: lead.motivo });
      }
      const inscripciones = await enrolarPorEmailRecibido(lead.leadId);
      await marcar(email.emailId, { estado: 'disparado', lead_id: lead.leadId, inscripciones });
      return responder(200, { ok: true, leadId: lead.leadId, inscripciones });
    });
  } catch (e) {
    // La fila queda en 'error' para que el reintento de Resend la pueda reclamar.
    await marcar(email.emailId, { estado: 'error', motivo: mensajeDeError(e).slice(0, 300) });
    return fallo('lead', e);
  }
}
