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
import { getTenantDb, getWorkspaceActual } from './workspace';
import { borrarLeadConCamino } from './leads-bajas';
import { createLead, logLeadEvent } from './leads';
import {
  plataformaDe, ventanaDesde, nombreDeParticipante, instagramDelEvento, entradaSocialDe, lineaDeEntradaSocial, metadataParaGuardar, NOMBRE_CANAL,
  type CanalSocial, type EventoSocial,
} from './canal-social';
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
export async function hayQuienEscuche(canal: CanalSocial, subtipo: EventoSocial['subtipo'], texto?: string | null, publicacion?: string | null): Promise<boolean> {
  const sub = subtipoDelEvento(canal, subtipo);
  if (!sub) return false;
  const { getSecuenciasActivas } = await import('./nutricion');
  // Con lo que COMENTÓ (ticket #17) y DÓNDE (ticket #25): un CRON con palabras clave, o con su publicación, no crea el lead
  // de quien comentó otra cosa u otra publicación.
  return escuchaElEvento(await getSecuenciasActivas(), canal, { subtipo: sub, texto: texto ?? null, publicacion: publicacion ?? null });
}

/**
 * LA ÚNICA LLAMADA AL MOTOR desde un evento de Instagram o Messenger. El `ctx` es el que lee
 * `disparaPorEvento` (lib/disparadores.ts): el subtipo, en las palabras del CRON (`subtipoDelEvento`).
 * Un evento que ningún CRON escucha (una mención en una historia) no inscribe a nadie.
 */
export async function dispararEventoSocial(leadId: number, canal: CanalSocial, subtipo: EventoSocial['subtipo'], texto?: string | null, publicacion?: string | null): Promise<number> {
  const sub = subtipoDelEvento(canal, subtipo);
  if (!sub) return 0;
  const { enrolarPorEvento } = await import('./nutricion');
  // El texto de ESTE comentario (ticket #17) y su publicación (ticket #25): se miran en cada uno, no en el que creó el lead.
  return enrolarPorEvento(leadId, canal, { subtipo: sub, texto: texto ?? null, publicacion: publicacion ?? null });
}

/**
 * Los eventos en los que la persona ESCRIBIÓ un mensaje privado (un DM, una respuesta a la historia, el primer texto que
 * sigue a un anuncio o a un enlace de referencia). Un comentario no: es público, y su respuesta es otra (la privada).
 */
const ES_MENSAJE_QUE_SE_CONTESTA: ReadonlySet<EventoSocial['subtipo']> = new Set(['mensaje', 'historia', 'anuncio', 'referencia']);

/**
 * EL AI STEP CONTESTA EL MENSAJE QUE ARRANCÓ LA AUTOMATIZACIÓN (28/10/2026, la (a) del Cerebro, como ManyChat): DESPUÉS de
 * `dispararEventoSocial`, con lo que escribió. Lo decide el motor (`contestarElDisparo`): sólo una automatización de ESTE
 * evento cuya primera tarjeta es el AI Step, y sólo la inscripción que todavía no mandó nada.
 */
export async function contestarDisparoSocial(
  leadId: number, canal: CanalSocial, subtipo: EventoSocial['subtipo'], extra: { texto?: string | null; cuenta?: string | null; fecha?: string | null },
): Promise<number> {
  if (!ES_MENSAJE_QUE_SE_CONTESTA.has(subtipo) || !extra.texto?.trim()) return 0;
  const sub = subtipoDelEvento(canal, subtipo);
  if (!sub) return 0;
  const { contestarElDisparo } = await import('./nutricion');
  return contestarElDisparo(leadId, canal, sub, { texto: extra.texto, cuenta: extra.cuenta ?? null, recibidoAt: extra.fecha ?? null });
}

/**
 * La respuesta por Instagram o Messenger de alguien que ya es un lead: anota que contestó y, si una
 * automatización suya tiene un AI Step de ese medio, le contesta por ahí (ver la cabecera). `texto`: lo que
 * escribió; `cuenta`: la cuenta de Zernio que lo recibió. Devuelve cuántas inscripciones anotó y si ESTE mensaje
 * ya tuvo su respuesta (`contestada`: un AI Step o la charla abierta le contestó o le dejó el borrador).
 */
export async function pausarRespuestaSocial(leadId: number, canal: CanalSocial, extra: { texto?: string | null; cuenta?: string | null } = {}): Promise<{ pausadas: number; contestada: boolean }> {
  const { pausarPorRespuesta } = await import('./nutricion');
  const atencion = { contestada: false };
  const pausadas = await pausarPorRespuesta(leadId, { origen: canal, texto: extra.texto ?? undefined, cuenta: extra.cuenta ?? null, atencion });
  return { pausadas, contestada: atencion.contestada };
}

/**
 * EL TOQUE DE UN BOTÓN de un mensaje de MaKo (24/10/2026, lib/botones-social.ts): lo mueve el motor (`tocarBoton`). 'no_es' =
 * no es un botón de MaKo (y el texto no es el título de uno que esperaba): quien llama sigue con lo de siempre.
 */
export async function tocarBotonSocial(leadId: number, t: { payload?: string | null; texto?: string | null }): Promise<string> {
  const { tocarBoton } = await import('./nutricion');
  return tocarBoton(leadId, t);
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
    // Lo que vino con el mensaje (ticket #33). En una escritura APARTE y sin tirar: es para poder mirarlo después, y guardarlo
    // (o que la columna no esté todavía) nunca puede hacer que se pierda el mensaje ni que Zernio reintente.
    const metadata = metadataParaGuardar(body);
    if (metadata) {
      try {
        const { error: eMeta } = await db.from('ig_mensajes').update({ metadata_zernio: metadata }).eq('zernio_message_id', e.mensajeId);
        if (eMeta) console.error(`[zernio-entrante] lo que vino con el mensaje ${e.mensajeId}: ${eMeta.message}`);
      } catch (err) { console.error(`[zernio-entrante] lo que vino con el mensaje ${e.mensajeId}: ${err instanceof Error ? err.message : String(err)}`); }
    }
  }

  // Alguien que YA era un lead y escribió: es una respuesta, y lo que le estaban escribiendo se pausa
  // (también si otra app atiende la charla: pausar es lo que no le manda nada a nadie).
  const yaEraLead = fila.lead_id == null ? null : Number(fila.lead_id);
  const pausar = yaEraLead != null && ES_RESPUESTA.has(e.subtipo);

  // Otra app de la página atiende la charla (handover de Meta): se guarda y no se dispara nada,
  // como hace Zernio con sus propias automatizaciones (`metadata.standby`).
  if (e.standby) return { accion: `${accion}_standby`, leadId: yaEraLead, disparar: false, pausar };
  // Una mención en una historia (10/11/2026): la escucha su propio CRON («Te menciona en su historia»). No pausa nada —no es
  // una respuesta a lo que se le mandó (`ES_RESPUESTA`)— y crea el lead sólo si hay quien la escuche, como cualquier otro evento.

  let leadId = yaEraLead;
  if (leadId == null) {
    if (!(await hayQuienEscuche(e.canal, e.subtipo, e.texto, e.postId))) return { accion: `${accion}_sin_automatizacion`, leadId: null, disparar: false, pausar: false };
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
 *
 * ⚠️ CÓMO ENTRÓ SE GUARDA ACÁ Y SÓLO ACÁ (tanda B del CRM, 14/10/2026). La fila de la persona
 * (`filaDe`) guarda el ÚLTIMO comentario, y cada comentario nuevo pisa al anterior porque el motor
 * necesita ése para la respuesta privada; el texto de un comentario no iba a ningún lado y el `ref` y
 * el anuncio se tiraban. El lead, en cambio, nace UNA vez: lo que trae su alta —su @, el anuncio de un
 * DM pagado en `meta_ad_id` y la entrada (`entradaSocialDe`)— no lo vuelve a escribir nadie. Y su
 * línea en el historial, que hasta acá no existía: el lead de Instagram aparecía sin decir de dónde.
 */
/** El lead que perdió el compare-and-set se borra y le pasa al que ganó lo que éste no tenga. Nunca tira. */
async function quitarHuerfano(huerfano: number, ganador: number | null, anuncioId: string | null, entrada: unknown): Promise<void> {
  const db = await getTenantDb();
  if (ganador != null && ganador !== huerfano) {
    if (anuncioId) {
      const { error } = await db.from('leads').update({ meta_ad_id: anuncioId }).eq('id', ganador).is('meta_ad_id', null);
      if (error) console.warn(`[zernio-entrante] no pude pasarle el anuncio al lead ${ganador}: ${error.message}`);
    }
    if (entrada) {
      const { error } = await db.from('leads').update({ entrada_social: entrada }).eq('id', ganador).is('entrada_social', null);
      if (error) console.warn(`[zernio-entrante] no pude pasarle la entrada al lead ${ganador}: ${error.message}`);
    }
  }
  if (ganador === huerfano) return;
  // ⚠️ NO VA A LA PAPELERA, A PROPÓSITO: nació segundos antes en esta misma corrida, nadie lo vio y lo que traía ya se le pasó al
  // ganador. Una foto suya llenaría la papelera de duplicados que nadie eliminó. Queda anotado (mig 0356).
  const ws = await getWorkspaceActual();
  if (ws == null) { console.error(`[zernio-entrante] el lead ${huerfano} quedó huérfano: no sé de qué negocio es`); return; }
  const { error } = await borrarLeadConCamino(db, ws, huerfano, 'zernio_duplicado', 'MaKo');
  if (error) console.error(`[zernio-entrante] el lead ${huerfano} quedó huérfano (no pude quitarlo): ${error.message}`);
}

async function crearLeadDe(e: EventoSocial, filaId: number): Promise<number | null> {
  try {
    const entrada = entradaSocialDe(e);
    const lead = await createLead({
      nombre: nombreDeParticipante(e),
      origen_lead: e.canal,
      utm_source: plataformaDe(e.canal),
      // Sólo de Instagram: en Messenger el usuario es el de Facebook (`instagramDelEvento`).
      instagram: instagramDelEvento(e),
      // El anuncio de un DM pagado, en la MISMA columna que el del formulario de Meta: así lo cuentan
      // la atribución por anuncio y el diagnóstico (`ad_transcripts` por `meta_ad_id`). ⚠️ El comentario
      // de antes decía que «viaja en el `ctx` del disparador», y no: `dispararEventoSocial` manda sólo
      // `{ subtipo }`. El anuncio no quedaba en NINGÚN lado.
      meta_ad_id: e.anuncioId,
      entrada_social: entrada,
      permitirDuplicado: true,
    });
    const db = await getTenantDb();
    const { data, error } = await db.from('ig_conversaciones').update({ lead_id: lead.id }).eq('id', filaId).is('lead_id', null).select('lead_id');
    if (error) throw new Error(error.message);
    if (!(data ?? []).length) {
      const { data: actual } = await db.from('ig_conversaciones').select('lead_id').eq('id', filaId).maybeSingle();
      const ganador = (actual as { lead_id?: number | null } | null)?.lead_id ?? null;
      // ⚠️ DOS MENSAJES JUNTOS DE LA MISMA PERSONA NUEVA (17/10/2026): en un anuncio de DM, Meta manda el primero sin
      // `referral` y el segundo con el anuncio, casi a la vez. Los dos ven `lead_id` null, los dos crean un lead y gana
      // uno. El que perdió quedaba HUÉRFANO con el anuncio y la entrada: le contaba al anuncio un lead que nunca agenda,
      // y el real quedaba sin atribuir (docs/relevo/crm-tanda-b1.md, b4). Ahora el huérfano se borra —lo creó esta misma
      // llamada: no tiene charla ni historial, y `createLead` no dispara nada— y el anuncio y la entrada pasan al que
      // ganó, sólo si no los tiene (compare-and-set: no se pisa lo que ya dijo el otro mensaje).
      await quitarHuerfano(lead.id, ganador, e.anuncioId ?? null, entrada);
      console.warn(`[zernio-entrante] la persona ${e.participanteId} ya tenía lead (${ganador}): el ${lead.id} quedó sin unir y se quitó`);
      return ganador;
    }
    // Sólo el lead que QUEDÓ unido: el que perdió el compare-and-set no es el de esta persona.
    // `logLeadEvent` no tira (un historial caído no deshace el alta).
    await logLeadEvent(lead.id, 'Entrada', lineaDeEntradaSocial(entrada), NOMBRE_CANAL[e.canal]);
    return lead.id;
  } catch (err) {
    console.error(`[zernio-entrante] no pude crear el lead de ${e.participanteId} (${e.canal}): ${msg(err)}`);
    return null;
  }
}
