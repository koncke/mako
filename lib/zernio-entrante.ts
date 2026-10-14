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
// ⚠️ UNA RESPUESTA POR INSTAGRAM O MESSENGER SE ANOTA Y LA CONTESTA EL AI STEP DE ESE MEDIO (TikTok fase 0,
// 14/10/2026; desde la sexta tanda hasta ese día sólo pausaba). Un mensaje o una respuesta a una historia de
// alguien que YA es un lead es una respuesta: se anota igual que una de WhatsApp (`pausarPorRespuesta`,
// lib/nutricion.ts, con `origen: canal`), y si una automatización suya tiene un AI Step de ese medio, le
// contesta POR ESE CANAL (la charla de `ig_mensajes`, la respuesta por Zernio). El borrador del modo asistido
// y lo demás del WhatsApp no corren: le contestarían por WhatsApp a quien escribió por Instagram.
//
// ⚠️ Y LA PAUSA VA ANTES DEL DISPARO, en el mismo `after` (app/api/webhooks/zernio/route.ts): el
// mismo DM puede arrancar una automatización de «Te envía un mensaje», y pausar después pausaría la
// que ese mensaje acaba de arrancar.

import 'server-only';
import { getTenantDb } from './workspace';
import { createLead } from './leads';
import { plataformaDe, ventanaDesde, nombreDeParticipante, type CanalSocial, type EventoSocial } from './canal-social';
import { escuchaElEvento, subtipoDelEvento } from './disparadores';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type ResultadoEntrante = {
  accion: string;
  leadId: number | null;
  /** Hay que disparar las automatizaciones de este evento (fuera del pedido: `after`). */
  disparar: boolean;
  /**
   * Es una RESPUESTA de alguien que ya era un lead (un mensaje o una respuesta a una historia): lo que
   * le estaban escribiendo se pausa (`pausarRespuestaSocial`), antes del disparo.
   */
  pausar: boolean;
};

/** Los eventos que son una respuesta de la persona (no un clic ni un comentario público). */
const ES_RESPUESTA: ReadonlySet<EventoSocial['subtipo']> = new Set(['mensaje', 'historia']);

/**
 * ¿Alguna automatización ACTIVA arranca con ESTE evento? Por CADA uno de sus CRON y con el subtipo
 * (`escuchaElEvento`, lib/disparadores.ts): la misma pregunta que hace el motor al inscribir. Un CRON
 * «comenta tu publicación» crea el lead de quien comenta, y no el de quien manda un DM.
 */
export async function hayQuienEscuche(canal: CanalSocial, subtipo: EventoSocial['subtipo']): Promise<boolean> {
  const sub = subtipoDelEvento(canal, subtipo);
  if (!sub) return false;
  const { getSecuenciasActivas } = await import('./nutricion');
  return escuchaElEvento(await getSecuenciasActivas(), canal, { subtipo: sub });
}

/**
 * LA ÚNICA LLAMADA AL MOTOR desde un evento de Instagram o Messenger. El `ctx` es el que lee
 * `disparaPorEvento` (lib/disparadores.ts): el subtipo, en las palabras del CRON (`subtipoDelEvento`).
 * Un evento que ningún CRON escucha (una mención en una historia) no inscribe a nadie.
 */
export async function dispararEventoSocial(leadId: number, canal: CanalSocial, subtipo: EventoSocial['subtipo']): Promise<number> {
  const sub = subtipoDelEvento(canal, subtipo);
  if (!sub) return 0;
  const { enrolarPorEvento } = await import('./nutricion');
  return enrolarPorEvento(leadId, canal, { subtipo: sub });
}

/**
 * La respuesta por Instagram o Messenger de alguien que ya es un lead: anota que contestó y, si una
 * automatización suya tiene un AI Step de ese medio, le contesta por ahí (ver la cabecera). `texto`: lo que
 * escribió; `cuenta`: la cuenta de Zernio que lo recibió. Devuelve cuántas inscripciones anotó.
 */
export async function pausarRespuestaSocial(leadId: number, canal: CanalSocial, extra: { texto?: string | null; cuenta?: string | null } = {}): Promise<number> {
  const { pausarPorRespuesta } = await import('./nutricion');
  return pausarPorRespuesta(leadId, { origen: canal, texto: extra.texto ?? undefined, cuenta: extra.cuenta ?? null });
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

  // Alguien que YA era un lead y escribió: es una respuesta, y lo que le estaban escribiendo se pausa
  // (también si otra app atiende la charla: pausar es lo que no le manda nada a nadie).
  const yaEraLead = fila.lead_id == null ? null : Number(fila.lead_id);
  const pausar = yaEraLead != null && ES_RESPUESTA.has(e.subtipo);

  // Otra app de la página atiende la charla (handover de Meta): se guarda y no se dispara nada,
  // como hace Zernio con sus propias automatizaciones (`metadata.standby`).
  if (e.standby) return { accion: `${accion}_standby`, leadId: yaEraLead, disparar: false, pausar };
  // Una mención en una historia no la escucha ningún disparador (lib/canal-social.ts).
  if (e.subtipo === 'mencion_historia') return { accion, leadId: yaEraLead, disparar: false, pausar };

  let leadId = yaEraLead;
  if (leadId == null) {
    if (!(await hayQuienEscuche(e.canal, e.subtipo))) return { accion: `${accion}_sin_automatizacion`, leadId: null, disparar: false, pausar: false };
    leadId = await crearLeadDe(e, fila.id);
    accion = `${accion}_lead_nuevo`;
  }
  return { accion, leadId, disparar: leadId != null, pausar };
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
