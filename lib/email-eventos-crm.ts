// =============================================================================
// email-eventos-crm — la tarjeta del CRM sigue a los emails: enviado, abrió, hizo clic (4/11/2026)
// =============================================================================
// La campaña de email de Mauricio (ws 1, un cliente), textual de la llamada: «si ya lo abrió me lo pones aquí», el clic en
// el botón pasa a otra columna, y una para el que compró. Cada automatización elige sus columnas (`columnasEmail`,
// lib/config-automatizacion.ts, editable con `configurar_automatizacion`), en el CRM al que está atada (su `funnel_id`).
//
// Lo llaman DOS lugares, y ninguno puede caerse por esto:
//   · el motor, cuando un email SALE (lib/nutricion.ts, la rama del email): `enviado`;
//   · el webhook de Resend, cuando se abre o se cliquea (`marcarEventoEmail`, lib/email-marketing.ts): `abrio` y `clic`.
//     Llega SIN sesión: corre adentro de `runWithWorkspace` con el workspace de la FILA del envío, nunca el del contexto.
//     Y el webhook sigue contestando 200 (un 5xx le pide a Resend que reintente: lib/webhooks).
//
// Mueve con las piezas de siempre: a un AGREGADO a ese CRM, `moverEtapaEnProducto`; si ese CRM es su casa,
// `setPipelineStage` (el movimiento automático dice en el historial qué se salteó). Nunca hacia atrás ni desde una terminal
// (lib/email-eventos-crm-reglas.ts). Sin columnas configuradas no pasa nada, como antes. NUNCA TIRA.
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';
import { leerConfigAutomatizacion } from './config-automatizacion-db';
import type { ConfigAutomatizacion, EventoColumna } from './config-automatizacion';
import { etapasDeProducto, moverEtapaEnProducto } from './lead-funnel';
import { idDelFunnelDefault } from './funnels';
import { casaReal } from './lead-funnel-reglas';
import { pipelineStageOf, type StageDerivable } from './pipeline';
import { setPipelineStage } from './leads';
import { columnaDeRebote, columnaDelEvento, decidirMovimiento, dejaDeRecibir } from './email-eventos-crm-reglas';

/** Quién movió la tarjeta, en el historial del lead. */
export const AUTOR_EMAIL = 'MaKo · email';
const OMITIR = 'Movido por un email de la automatización (salió, lo abrió, hizo clic o rebotó): lo que la etapa pida y falte queda pendiente en la ficha.';

const COLS_LEAD = 'id, funnel_id, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada';

/** Dónde está el lead en el CRM `funnelId`: su fila de agregado, su casa, o en ninguna (null). */
export type PosicionEnCrm = { tipo: 'agregado' | 'casa'; etapa: string } | null;

/**
 * El estado de lead y la columna del lead EN ESE CRM. Tira si no puede leer: quien llama decide (el motor no manda; el
 * webhook no mueve).
 */
export async function posicionEnCrm(leadId: number, funnelId: number): Promise<{ estadoLead: string | null; posicion: PosicionEnCrm }> {
  const db = await getTenantDb();
  const [{ data: lead, error: eL }, { data: filas, error: eF }, def] = await Promise.all([
    db.from('leads').select(COLS_LEAD).eq('id', leadId).maybeSingle(),
    db.from('lead_funnel').select('etapa').eq('lead_id', leadId).eq('funnel_id', funnelId).limit(1),
    idDelFunnelDefault(),
  ]);
  if (eL) throw new Error(`posicionEnCrm (lead): ${eL.message}`);
  if (eF) throw new Error(`posicionEnCrm (fila): ${eF.message}`);
  const l = lead as (StageDerivable & { funnel_id: number | string | null; estado_lead: string | null }) | null;
  if (!l) return { estadoLead: null, posicion: null };
  const fila = ((filas ?? []) as Array<{ etapa: string | null }>)[0];
  if (fila?.etapa) return { estadoLead: l.estado_lead, posicion: { tipo: 'agregado', etapa: fila.etapa } };
  const casa = casaReal(l.funnel_id == null ? null : Number(l.funnel_id), def);
  if (casa === funnelId) return { estadoLead: l.estado_lead, posicion: { tipo: 'casa', etapa: pipelineStageOf(l) } };
  return { estadoLead: l.estado_lead, posicion: null };
}

/** El CRM de una automatización (su `funnel_id`), o null. Tira si no puede leer. */
export async function crmDeLaAutomatizacion(secuenciaId: number): Promise<number | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('funnel_id').eq('id', secuenciaId).maybeSingle();
  if (error) throw new Error(`crmDeLaAutomatizacion: ${error.message}`);
  const v = (data as { funnel_id?: unknown } | null)?.funnel_id;
  return v == null || v === '' ? null : Number(v);
}

export type ResultadoEvento = { movido: boolean; motivo?: string; de?: string; a?: string };

/**
 * MUEVE LA TARJETA por un evento de email de una automatización. `ws`: el workspace de la FILA del envío. `config`: la de
 * la automatización si quien llama ya la tiene (el motor la lee una vez por corrida); si no, se lee.
 */
export async function moverPorEventoEmail(o: { ws: number; leadId: number; secuenciaId: number; evento: EventoColumna; config?: ConfigAutomatizacion }): Promise<ResultadoEvento> {
  try {
    return await runWithWorkspace(o.ws, async () => {
      const config = o.config ?? await leerConfigAutomatizacion(o.secuenciaId);
      const rebote = o.evento === 'rebote';
      // El rebote (#93) puede ir a la columna «Rebotado» del CRM sin estar elegida: su columna sale de las etapas, más abajo.
      let destino = rebote ? null : columnaDelEvento(config.columnasEmail, o.evento);
      if (!rebote && !destino) return { movido: false, motivo: 'sin-columnas' };
      const funnelId = await crmDeLaAutomatizacion(o.secuenciaId);
      if (funnelId == null) return { movido: false, motivo: 'sin-crm' };
      const [{ posicion }, etapas] = await Promise.all([posicionEnCrm(o.leadId, funnelId), etapasDeProducto(funnelId)]);
      if (rebote) destino = columnaDeRebote(config.columnasEmail, etapas);
      if (!destino) return { movido: false, motivo: 'sin-columnas' };
      const d = decidirMovimiento({ etapas, actual: posicion?.etapa ?? null, destino, evento: o.evento });
      if (!d.mover) return { movido: false, motivo: d.motivo };
      if (posicion!.tipo === 'agregado') await moverEtapaEnProducto(o.leadId, funnelId, destino, { autor: AUTOR_EMAIL });
      else await setPipelineStage(o.leadId, destino, { autor: AUTOR_EMAIL, requisitos: { omitir: OMITIR } });
      return { movido: true, de: posicion!.etapa, a: destino };
    });
  } catch (e) {
    console.error(`[email-eventos-crm] lead ${o.leadId}, automatización ${o.secuenciaId}, ${o.evento}: ${e instanceof Error ? e.message : String(e)}`);
    return { movido: false, motivo: 'error' };
  }
}

/**
 * PUNTO 6, el corte al comprar: antes de que le salga a un lead el email de una automatización con `columnasEmail`, ¿lo
 * sigue recibiendo? `'corta'` si como lead ya no está abierto o en el CRM de la automatización llegó a una terminal (Ganado).
 * `'ilegible'` si no se pudo leer: el motor no manda esta vez y vuelve a mirar en la corrida siguiente (no corta a ciegas,
 * y tampoco le manda la campaña a quien quizás ya compró). Las demás automatizaciones no pasan por acá.
 */
export async function cortaPorCompra(o: { ws: number; leadId: number; secuenciaId: number; estadoLead: string | null | undefined }): Promise<'corta' | 'sigue' | 'ilegible'> {
  if (dejaDeRecibir({ estadoLead: o.estadoLead, etapaEnCrm: null })) return 'corta';
  try {
    return await runWithWorkspace(o.ws, async () => {
      const funnelId = await crmDeLaAutomatizacion(o.secuenciaId);
      if (funnelId == null) return 'sigue';
      const { estadoLead, posicion } = await posicionEnCrm(o.leadId, funnelId);
      return dejaDeRecibir({ estadoLead: estadoLead ?? o.estadoLead, etapaEnCrm: posicion?.etapa ?? null }) ? 'corta' : 'sigue';
    });
  } catch (e) {
    console.error(`[email-eventos-crm] corte de la automatización ${o.secuenciaId}, lead ${o.leadId}: ${e instanceof Error ? e.message : String(e)}`);
    return 'ilegible';
  }
}
