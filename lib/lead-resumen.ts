import 'server-only';

// =============================================================================
// lead-resumen — TODO lo que hay que saber de un lead antes y después de la llamada
// =============================================================================
// Existe para que el link que MaKo manda por WhatsApp («Mirá el resumen del
// lead») no sea otra pantalla más: una sola lectura que junta la ficha, las
// respuestas del formulario, la agenda y el análisis de las llamadas.
//
// POR QUÉ ACÁ Y NO ADENTRO DE LA PÁGINA: el mismo dato lo consumen la vista
// (/crm/[id]/resumen) y el cron del recordatorio, que arma el mensaje de
// WhatsApp con el nombre y la hora. Si cada uno lo leyera por su lado, el
// mensaje diría una cosa y la pantalla otra — que es exactamente el bug de
// «me dijo 11 y veo 4» que ya nos costó una vez (ver lib/reunion-auto.ts).
//
// NO GASTA IA. Todo sale de lo que ya está analizado: `closing_analyses` la
// llena el Closing Analyst después de cada llamada, y las respuestas del
// formulario las trae el webhook de Calendly. Abrir esta pantalla cien veces
// cuesta cero.
// =============================================================================

import { getLead, type Lead, type FathomLink } from './leads';
import { APP_BASE_URL } from './app-url';
import { getTenantDb, getWorkspaceActual, OWNER_WS } from './workspace';
import { tzDeWorkspace, TZ_DEFAULT } from './timezone';
import { getCampaignNameMap, resolverNombreCampana, getAdNameMap, resolverNombreAd, adIdDeLead } from './queries';
import type { ClosingObjection, ClosingMoment, CallTipo, Tone } from './closing';

/**
 * El link que MaKo manda por WhatsApp. Lo arma el CÓDIGO y nunca el modelo:
 * es un id exacto, sin redundancia, y un dígito cambiado abre la ficha de OTRO
 * lead sin que nada se vea roto (la regla vive en AGENTS.md → «un DATO EXACTO
 * que pasa por las manos de un LLM deja de ser exacto»).
 */
export function linkResumenLead(leadId: number): string {
  return `${APP_BASE_URL}/crm/${leadId}/resumen`;
}

/** Una llamada ya analizada de este lead, con lo único que se lee en el celular. */
export type LlamadaResumen = {
  recordingId: number;
  tipo: CallTipo | null;
  titulo: string | null;
  /** ISO exacto del arranque de la grabación. */
  startedAt: string | null;
  duracionMin: number | null;
  outcome: string | null;
  outcomeTone: Tone | null;
  resumen: string | null;
  proximoPaso: string | null;
  objeciones: ClosingObjection[];
  momentos: ClosingMoment[];
  /** Link a la grabación (share_url cuando existe, si no el call_url). */
  url: string | null;
};

/** Una pregunta del formulario de Calendly con su respuesta. */
export type RespuestaFormulario = { pregunta: string; respuesta: string };

export type ResumenLead = {
  lead: Lead;
  tz: string;
  /** Llamadas de venta analizadas, de la más NUEVA a la más vieja. */
  llamadas: LlamadaResumen[];
  /** Las respuestas que el lead dejó al agendar (solo las que contestó). */
  respuestas: RespuestaFormulario[];
  /** De dónde vino, ya resuelto a nombres legibles. */
  origen: { campana: string | null; anuncio: string | null; canal: string | null };
  /** La próxima reunión agendada (ISO), si la hay y todavía no pasó. */
  proximaReunion: { cual: 'R1' | 'R2'; iso: string } | null;
  /** Grabaciones cargadas a mano en la ficha (fathom_links). */
  grabaciones: FathomLink[];
  /**
   * El follow-up que MaKo dejó escrito y sin enviar, si lo hay.
   *
   * Vive acá y no en el WhatsApp por la regla del dueño: «no me puede decir que
   * me dejó un mensaje listo y no mandarme un link». Anunciarlo en el chat sin
   * poder abrirlo es un callejón; en la pantalla se lee entero y se manda con un
   * toque desde /whatsapp.
   */
  borradorSeguimiento: { texto: string; creadoIso: string | null } | null;
};

/**
 * Las respuestas del formulario, con la PREGUNTA que las originó.
 *
 * Las columnas se llaman `respuesta_facturacion`, `respuesta_decisor`… y solas
 * no dicen nada: leídas en el celular treinta segundos antes de entrar a la
 * llamada, «Sí» sin la pregunta es ruido.
 *
 * ⚠️ EL NOMBRE DE LA COLUMNA NO ES LA PREGUNTA, y confundirlos acá miente en la
 * pantalla. Dos casos medidos contra el formulario real:
 *
 *  · `respuesta_facturacion` NO guarda cuánto factura: guarda el SÍ/NO a
 *    «este programa está enfocado en negocios que facturan +$20M MXN al año,
 *    ¿es tu caso?». Rotulada «¿Cuánto factura al año?» se leía «Si», que no es
 *    una facturación.
 *  · `respuesta_decisor` guarda el SÍ/NO a «¿alguien MÁS participa en la
 *    decisión?». Rotulada «¿Decide solo?» invertía el sentido: un «No» —que
 *    significa que decide él— se leía como que NO decide él. Esa es la que
 *    manda a la llamada con la estrategia al revés.
 *
 * La verdad de qué pregunta llena cada columna vive en el webhook
 * (`extractRespuestaPorFrase` en app/api/webhooks/calendly/route.ts): si ahí
 * cambian las frases que se matchean, estos rótulos se tocan en el mismo commit.
 */
const PREGUNTAS: ReadonlyArray<{ campo: keyof Lead; pregunta: string }> = [
  { campo: 'respuesta_objetivo', pregunta: '¿Qué quiere lograr?' },
  { campo: 'respuesta_colaboradores', pregunta: '¿Cuántos colaboradores tiene?' },
  { campo: 'respuesta_facturacion', pregunta: '¿Factura más de $20M MXN al año?' },
  { campo: 'respuesta_inversion', pregunta: '¿Tiene posibilidad de invertir?' },
  { campo: 'respuesta_decisor', pregunta: '¿Alguien más participa en la decisión?' },
  { campo: 'respuesta_cuando_empezar', pregunta: '¿Cuándo quiere empezar?' },
];

const COLS = [
  'recording_id', 'tipo', 'title', 'started_at', 'duration_min', 'outcome', 'outcome_tone',
  'summary', 'next_step', 'objections', 'moments', 'share_url', 'call_url',
].join(', ');

type Fila = {
  recording_id: number;
  tipo: CallTipo | null;
  title: string | null;
  started_at: string | null;
  duration_min: number | null;
  outcome: string | null;
  outcome_tone: Tone | null;
  summary: string | null;
  next_step: string | null;
  objections: ClosingObjection[] | null;
  moments: ClosingMoment[] | null;
  share_url: string | null;
  call_url: string | null;
};

/**
 * La reunión que VIENE: la primera de R1/R2 que todavía no pasó.
 *
 * Se mira `junta_1_at`/`junta_2_at` (el ISO con hora que deja Calendly) y NO
 * `fecha_junta_1`, que es solo el día: con la fecha suelta, una reunión de las
 * 09:00 sigue contando como futura hasta la medianoche, y el recordatorio de
 * «te falta media hora» saldría a destiempo todo el día.
 */
function proximaReunionDe(lead: Lead): { cual: 'R1' | 'R2'; iso: string } | null {
  const ahora = Date.now();
  const cand: Array<{ cual: 'R1' | 'R2'; iso: string | null }> = [
    { cual: 'R1', iso: lead.junta_1_at },
    { cual: 'R2', iso: lead.junta_2_at },
  ];
  const futuras = cand
    .filter((c): c is { cual: 'R1' | 'R2'; iso: string } => Boolean(c.iso))
    .map((c) => ({ ...c, t: Date.parse(c.iso) }))
    .filter((c) => Number.isFinite(c.t) && c.t > ahora)
    .sort((a, b) => a.t - b.t);
  return futuras[0] ? { cual: futuras[0].cual, iso: futuras[0].iso } : null;
}

/**
 * Junta todo lo del lead en una sola lectura. Devuelve null si el lead no existe
 * en el workspace actual (getLead ya está scopeado por getTenantDb).
 */
export async function getResumenLead(leadId: number): Promise<ResumenLead | null> {
  const lead = await getLead(leadId);
  if (!lead) return null;

  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const supabase = await getTenantDb();

  const [tz, filas, campMap, adMap, borrador] = await Promise.all([
    tzDeWorkspace(ws).catch(() => TZ_DEFAULT),
    supabase
      .from('closing_analyses')
      .select(COLS)
      .eq('lead_id', leadId)
      .eq('status', 'analizada')
      .order('started_at', { ascending: false })
      .then((r) => (r.data ?? []) as unknown as Fila[]),
    getCampaignNameMap().catch(() => ({} as Record<string, string>)),
    getAdNameMap().catch(() => ({} as Record<string, string>)),
    // Solo el PENDIENTE: uno ya enviado o descartado no es algo «que te dejé
    // listo», y anunciarlo mandaría a /whatsapp a buscar algo que no está.
    Promise.resolve(
      supabase
        .from('wa_borradores')
        .select('texto, created_at')
        .eq('lead_id', leadId)
        .eq('origen', 'post_llamada')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1),
    )
      .then((r) => ((r.data ?? [])[0] as { texto: string; created_at: string } | undefined) ?? null)
      .catch(() => null),
  ]);

  const llamadas: LlamadaResumen[] = filas.map((f) => ({
    recordingId: f.recording_id,
    tipo: f.tipo,
    titulo: f.title,
    startedAt: f.started_at,
    duracionMin: f.duration_min,
    outcome: f.outcome,
    outcomeTone: f.outcome_tone,
    resumen: f.summary,
    proximoPaso: f.next_step,
    // Las objeciones ABIERTAS primero: es lo único de toda la pantalla que hay
    // que resolver, y en el celular lo que queda abajo no se lee.
    objeciones: [...(f.objections ?? [])].sort((a, b) => Number(a.handled) - Number(b.handled)),
    momentos: f.moments ?? [],
    url: f.share_url || f.call_url || null,
  }));

  const respuestas: RespuestaFormulario[] = PREGUNTAS
    .map(({ campo, pregunta }) => ({ pregunta, respuesta: String(lead[campo] ?? '').trim() }))
    .filter((r) => r.respuesta.length > 0);

  const utmC = lead.utm_content?.trim() || null;
  const adId = adIdDeLead(lead.meta_ad_id, utmC, adMap);

  return {
    lead,
    tz,
    llamadas,
    respuestas,
    origen: {
      campana: resolverNombreCampana(lead.utm_campaign, campMap).texto || lead.meta_campaign_name || null,
      anuncio: resolverNombreAd(adId, lead.meta_ad_name ?? utmC, adMap) || null,
      canal: lead.origen_lead || lead.utm_source || null,
    },
    proximaReunion: proximaReunionDe(lead),
    grabaciones: lead.fathom_links ?? [],
    borradorSeguimiento: borrador ? { texto: borrador.texto, creadoIso: borrador.created_at ?? null } : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los dos mensajes de WhatsApp que linkean acá
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ EL MENSAJE NO CUENTA LA REUNIÓN. Pedido textual del dueño (11/08/2026):
// «no quiero que en WhatsApp me diga absolutamente nada de lo que pasó en la reu
// o lo que quedó pendiente o nada. Solo quiero que me mande el link, dentro de
// MaKo se verá todo eso».
//
// No es una preferencia de largo: es dónde vive cada cosa. El resumen, las
// objeciones y el próximo paso viven en la pantalla, que los muestra ordenados,
// completos y actualizados. Repetirlos en el chat los deja congelados en el
// momento del envío, obliga a leer un ladrillo en el celular y —lo peor— hace
// que abrir el link se sienta redundante justo cuando es lo único que importa.
// El WhatsApp avisa QUÉ pasó y a dónde ir. Nada más.
//
// ⚠️ Y NADA DE «TE DEJÉ ALGO LISTO» SIN SU LINK. Segunda regla del mismo pedido:
// «no me puede decir que me dejó un mensaje listo y no mandarme un link». Si el
// mensaje nombra algo que MaKo preparó, ese algo se abre desde ahí mismo, o no
// se nombra. El borrador de seguimiento se anuncia y se linkea EN LA PANTALLA,
// que es donde se puede leer antes de mandarlo.

/**
 * DESPUÉS de la reunión. Se manda cuando el análisis YA corrió — no para
 * contarlo, sino para que el link lleve a algo que ya está completo.
 */
export async function textoAvisoPostLlamada(input: {
  leadId: number;
  nombre: string;
  reunion: 'R1' | 'R2';
  duracionMin: number | null;
}): Promise<string> {
  const { leadId, nombre, reunion, duracionMin } = input;
  const dur = duracionMin ? ` (${duracionMin} min)` : '';
  return [
    `✅ Terminó la *${reunion} con ${nombre}*${dur}.`,
    '',
    '👉 Mirá el resumen de la llamada:',
    linkResumenLead(leadId),
    '',
    '— MaKo',
  ].join('\n');
}

/**
 * ANTES de la reunión. Con quién y cuándo, y el link. El repaso de la charla
 * anterior y las objeciones abiertas están en la pantalla.
 */
export async function textoAvisoPreLlamada(input: {
  leadId: number;
  cual: 'R1' | 'R2';
  /** Cuánto falta, ya redondeado a minutos. */
  minutos: number;
}): Promise<string> {
  const { leadId, cual, minutos } = input;
  const data = await getResumenLead(leadId);
  if (!data) return '';
  const { lead } = data;

  const cuanto = minutos >= 60 ? `${Math.round(minutos / 60)} h` : `${minutos} min`;
  const quien = lead.empresa ? `*${lead.nombre}* (${lead.empresa})` : `*${lead.nombre}*`;
  return [
    `⏰ En ${cuanto} tenés la *${cual}* con ${quien}.`,
    '',
    '👉 Mirá el resumen del lead:',
    linkResumenLead(leadId),
    '',
    '— MaKo',
  ].join('\n');
}
