// =============================================================================
// zernio-entrante — lo que entra por Instagram o Messenger: la persona, su mensaje y el disparador
// =============================================================================
// Lo llama el webhook de Zernio (app/api/webhooks/zernio/route.ts) DESPUÉS de verificar la firma,
// rutear el evento a su workspace y reclamar su id (dedup). Corre adentro de `runWithWorkspace(ws)`.
//
// Tres cosas, en este orden:
//   1. LA PERSONA en esa plataforma (`ig_conversaciones`, mig 0242): una fila por (plataforma, igsid).
//      Un mensaje abre la ventana de 24 h; un comentario deja el comentario para la respuesta privada.
//   2. EL MENSAJE (`ig_mensajes`), si es un mensaje: deduplicado por su id de Zernio.
//   3. EL LEAD y el DISPARADOR: si la persona ya es un lead, ése; si no, se crea SÓLO si alguna
//      automatización activa escucha este canal (`hayQuienEscuche`). Sin eso, cada persona que
//      comenta una publicación sería un lead del CRM.
//
// ⚠️ REGLA DE ORO (heredada del webhook de antes): el lead de una persona de Instagram NUNCA se deduce
// de un teléfono ni de un nombre. Un IGSID es un número de ~17 dígitos y el matcheo telefónico de la
// casa lo confundiría con un teléfono real. El lead se une por la fila de la persona, y nada más.
//
// ⚠️ UNA RESPUESTA POR INSTAGRAM NO PAUSA LA SALIDA (todavía). `pausarPorRespuesta` (lib/nutricion.ts)
// pausa y además contesta —el modo asistido, «Si responde», la charla— POR WHATSAPP, al teléfono del
// lead: llamarla desde acá le contestaría por otro canal a quien escribió por Instagram. Hasta que el
// motor sepa contestar por el canal por donde le escribieron, la respuesta se guarda y dispara lo que
// escuche «Te envía un mensaje», y la salida sigue. Está en el relevo como pendiente.

import 'server-only';
import { getTenantDb } from './workspace';
import { createLead } from './leads';
import { plataformaDe, ventanaDesde, nombreDeParticipante, type CanalSocial, type EventoSocial } from './canal-social';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type ResultadoEntrante = {
  accion: string;
  leadId: number | null;
  /** Hay que disparar las automatizaciones de este evento (fuera del pedido: `after`). */
  disparar: boolean;
};

/**
 * ¿Alguna automatización ACTIVA escucha este canal? INTEGRACIÓN: la parte «disparadores» de la sexta
 * tanda define los `trigger_tipo` de Instagram y Messenger; acá se asume que NOMBRAN el canal
 * (`instagram…` / `messenger…`). Si eligen otro nombre, cambiarlo acá y en `dispararEventoSocial`.
 */
export async function hayQuienEscuche(canal: CanalSocial): Promise<boolean> {
  const { getSecuenciasActivas } = await import('./nutricion');
  const secs = await getSecuenciasActivas();
  return secs.some((s) => (s.trigger_tipo ?? '').toLowerCase().includes(canal));
}

/**
 * LA ÚNICA LLAMADA AL MOTOR desde un evento de Instagram o Messenger.
 *
 * ⚠️ INTEGRACIÓN: la parte disparadores agrega el evento. `enrolarPorEvento` (lib/nutricion.ts) hoy
 * conoce `lead_nuevo | agenda_nueva | etapa | entrega | etiqueta`; la parte «disparadores» suma
 * `'instagram' | 'messenger'` a `EventoNutricion` y a `TRIGGERS_POR_EVENTO`, con este `ctx`. Mientras
 * tanto el cast compila y `TRIGGERS_POR_EVENTO[evento] ?? []` contesta 0: no inscribe a nadie.
 */
export async function dispararEventoSocial(leadId: number, canal: CanalSocial, ctx: {
  subtipo: EventoSocial['subtipo']; texto: string | null; ref: string | null; anuncioId: string | null; postId: string | null; comentarioId: string | null;
}): Promise<number> {
  const { enrolarPorEvento } = await import('./nutricion');
  type Enrolar = (leadId: number, evento: string, ctx?: Record<string, unknown>) => Promise<number>;
  return (enrolarPorEvento as unknown as Enrolar)(leadId, canal, ctx);
}

type Fila = { id: number; lead_id: number | null };

/** Lo que un evento le escribe a la persona: su cuenta, su usuario y, según el evento, la ventana o el comentario. */
function filaDe(e: EventoSocial): Record<string, unknown> {
  const f: Record<string, unknown> = { plataforma: plataformaDe(e.canal), igsid: e.participanteId };
  // Los campos de identidad sólo cuando HAY valor: un evento que no los trae no borra lo que se sabía.
  if (e.cuentaId) f.zernio_account_id = e.cuentaId;
  if (e.usuario) f.username = e.usuario;
  if (e.conversacionId) f.zernio_conversation_id = e.conversacionId;
  if (e.subtipo === 'comentario' || e.subtipo === 'comentario_vivo') {
    f.comentario_id = e.comentarioId;
    f.comentario_post_id = e.postId;
    f.comentario_at = e.fecha;
    f.comentario_respondido_at = null;
  } else {
    // Un mensaje, una respuesta a la historia, un clic en un anuncio o en un link de referencia abren
    // la ventana de 24 h (Meta: la abre la persona, escribiendo o tocando un m.me/ig.me).
    f.ultimo_mensaje_at = e.fecha;
    f.ventana_expira_at = ventanaDesde(e.fecha);
  }
  return f;
}

/** Los adjuntos se guardan por TIPO: la URL de Meta firma y vence (doc de Zernio), no se persiste. */
const adjuntosDe = (body: unknown): Array<{ type: string }> => {
  const m = (body as { message?: { attachments?: unknown } } | null)?.message;
  const a = Array.isArray(m?.attachments) ? (m!.attachments as Array<{ type?: unknown; originalType?: unknown }>) : [];
  return a.map((x) => ({ type: typeof x.originalType === 'string' ? x.originalType : typeof x.type === 'string' ? x.type : 'file' }));
};

/**
 * Guarda la persona y su mensaje, y encuentra o crea su lead. TIRA si no pudo guardar a la persona:
 * el webhook suelta el reclamo del evento y contesta 500, y Zernio reintenta.
 */
export async function procesarEventoSocial(e: EventoSocial, body: unknown): Promise<ResultadoEntrante> {
  const db = await getTenantDb();
  const { data, error } = await db.from('ig_conversaciones')
    .upsert(filaDe(e), { onConflict: 'workspace_id,plataforma,igsid' })
    .select('id, lead_id').single();
  if (error || !data) throw new Error(`ig_conversaciones (upsert): ${error?.message ?? 'sin fila'}`);
  const fila = data as Fila;

  let accion: string = e.subtipo;
  if (e.mensajeId) {
    const { error: eMsg } = await db.from('ig_mensajes').upsert({
      conversacion_id: fila.id, direccion: 'entrante', estado: 'recibido',
      texto: e.texto, adjuntos: adjuntosDe(body), zernio_message_id: e.mensajeId,
    }, { onConflict: 'workspace_id,zernio_message_id', ignoreDuplicates: true });
    if (eMsg) throw new Error(`ig_mensajes (insert): ${eMsg.message}`);
  }

  // Otra app de la página atiende la charla (handover de Meta): se guarda y no se dispara nada,
  // como hace Zernio con sus propias automatizaciones (`metadata.standby`).
  if (e.standby) return { accion: `${accion}_standby`, leadId: fila.lead_id, disparar: false };
  // Una mención en una historia no la escucha ningún disparador (lib/canal-social.ts).
  if (e.subtipo === 'mencion_historia') return { accion, leadId: fila.lead_id, disparar: false };

  let leadId = fila.lead_id == null ? null : Number(fila.lead_id);
  if (leadId == null) {
    if (!(await hayQuienEscuche(e.canal))) return { accion: `${accion}_sin_automatizacion`, leadId: null, disparar: false };
    leadId = await crearLeadDe(e, fila.id);
    accion = `${accion}_lead_nuevo`;
  }
  return { accion, leadId, disparar: leadId != null };
}

/**
 * EL LEAD NUEVO de una persona de Instagram o Messenger, unido a su fila con COMPARE-AND-SET: si otro
 * evento de la misma persona lo unió primero, gana ése y el nuevo queda sin fila (se loguea: dos
 * eventos de alguien que nunca escribió, en el mismo segundo, no pasa en la práctica).
 *
 * `permitirDuplicado`: la identidad se chequeó acá (la fila de la persona), y un nombre como «Juan»
 * chocaría con el «Juan» de WhatsApp — que puede ser otra persona. Es la regla de oro de arriba.
 */
async function crearLeadDe(e: EventoSocial, filaId: number): Promise<number | null> {
  try {
    const lead = await createLead({
      nombre: nombreDeParticipante(e),
      origen_lead: e.canal,
      utm_source: plataformaDe(e.canal),
      // ⚠️ El anuncio NO va acá: `createLead` no escribe `meta_ad_id` (lo tiene en el tipo y no en el
      // insert), así que pasarlo sería un dato que se tira sin avisar. Viaja en el `ctx` del disparador.
      permitirDuplicado: true,
    });
    const db = await getTenantDb();
    const { data, error } = await db.from('ig_conversaciones').update({ lead_id: lead.id }).eq('id', filaId).is('lead_id', null).select('lead_id');
    if (error) throw new Error(error.message);
    if (!(data ?? []).length) {
      const { data: actual } = await db.from('ig_conversaciones').select('lead_id').eq('id', filaId).maybeSingle();
      console.warn(`[zernio-entrante] la persona ${e.participanteId} ya tenía lead: el ${lead.id} quedó sin unir`);
      return (actual as { lead_id?: number | null } | null)?.lead_id ?? null;
    }
    return lead.id;
  } catch (err) {
    console.error(`[zernio-entrante] no pude crear el lead de ${e.participanteId} (${e.canal}): ${msg(err)}`);
    return null;
  }
}
