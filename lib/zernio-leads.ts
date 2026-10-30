// =============================================================================
// zernio-leads — lo que hace MaKo con un lead de Meta que llegó por el webhook de Zernio
// =============================================================================
// El lector (lib/zernio-lead.ts) traduce el cuerpo de `lead.received`; esto lo entrega a las MISMAS tres cosas que el
// webhook de Meta (app/api/webhooks/meta-leads) hace con un lead que nace:
//   1. `upsertLeadFromMeta` — la ÚNICA puerta de un lead de formulario: origen `instant_form`, dedup por `meta_lead_id`
//      (el leadgen_id: si el lead entra también por la app propia del negocio, o por el poll, es el MISMO lead) y después por
//      teléfono o email, producto según la campaña, respuestas crudas;
//   2. la conversión `Lead` a Meta (CAPI), con el MISMO `event_id` que usa el webhook de Meta: si el lead entra por los dos
//      caminos, Meta junta los dos eventos en uno;
//   3. «lo inmediato» de un lead nuevo (`alNacerLeadDeMeta`, lib/meta-lead-nuevo.ts): el aviso, los flujos y las
//      automatizaciones. Es lo que hace que el lead no sea una fila muda en el CRM.
//
// DOS PASOS Y NO UNO, porque Zernio corta a los 5 s y no espera: `cargarLeadDeZernio` (el alta, rápido, adentro del pedido: si
// falla, el webhook suelta el reclamo del evento y Zernio reintenta) y `alNacerLeadDeZernio` (la conversión y lo inmediato,
// lento, DESPUÉS de contestar con `after`). El Meta de siempre lo hace todo adentro del pedido; Zernio no deja.
//
// ⚠️ 2 Y 3 NO SE DECIDEN IGUAL (`queHacerConElLead`, lib/zernio-lead.ts: puro, y el test lo ejecuta). Lo inmediato (3) sólo con un lead CREADO por esta
// entrega y de menos de 24 h (`esNuevoParaElNegocio`): Zernio reintenta hasta 7 veces y un evento que llega días tarde (un corte de MaKo, una reentrega
// manual desde su panel) no es «un lead nuevo» para el negocio, y una persona que ya era un lead no recibe otro primer mensaje. La conversión (2) como en
// el webhook de Meta: TAMBIÉN con un lead que ya existía (esa persona llenó OTRO formulario: es otra conversión), con el event_id del leadgen_id para que
// Meta no la cuente dos veces, y dentro de la ventana de CAPI (7 días). Sin fecha legible se trata como recién llegado, porque callarlo dejaría a un
// lead real sin que nadie le escriba.
//
// Corre adentro de `runWithWorkspace(ws)`: lo llama el webhook DESPUÉS de saber de quién es.

import 'server-only';
import { upsertLeadFromMeta, logLeadEvent } from './leads';
import { sendMetaCAPIEvent } from './meta-capi';
import { eventIdLeadCrudo } from './meta-capi-payload';
import { alNacerLeadDeMeta } from './meta-lead-nuevo';
import { queHacerConElLead, type LeadDeZernio } from './zernio-lead';

export type LeadCargado = {
  leadId: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  /** ¿Lo creó ESTA entrega? Un reintento de Zernio, o un lead que ya entró por Meta, no. */
  creado: boolean;
  /** ¿Se anuncia? Sólo uno creado por ESTA entrega y reciente: lo único que justifica un primer mensaje (`queHacerConElLead`). */
  nuevo: boolean;
  /** ¿Se manda la conversión `Lead` a Meta? También un lead que ya existía, mientras entre en la ventana de CAPI. */
  conversion: boolean;
};

/** `soloCrear`: el barrido. La persona que ya es un lead (por teléfono o email) no se toca (`noTocarExistente`, lib/leads.ts). */
export async function cargarLeadDeZernio(l: LeadDeZernio, ahora: Date = new Date(), opc: { soloCrear?: boolean } = {}): Promise<LeadCargado> {
  const { created, lead } = await upsertLeadFromMeta({
    email: l.email,
    nombre: l.nombre,
    telefono: l.telefono,
    empresa: l.empresa,
    meta_lead_id: l.leadgenId,
    // Los ids deciden el producto (lib/campana-funnel.ts). Los nombres NO viajan en este evento: quedan vacíos.
    meta_ad_id: l.anuncioId,
    meta_campaign_id: l.campanaId,
    meta_adset_id: l.conjuntoId,
    meta_field_data: l.fieldData.length ? l.fieldData : null,
    meta_created_at: l.creadoEn,
    meta_campos_no_reconocidos: l.noReconocidos,
  }, { noTocarExistente: opc.soloCrear === true });
  return {
    leadId: lead.id,
    nombre: lead.nombre,
    telefono: lead.telefono ?? null,
    email: lead.email ?? null,
    creado: created,
    ...queHacerConElLead(created, l.creadoEn, ahora.getTime()),
  };
}

/**
 * La conversión `Lead` y lo inmediato de un lead que YA existe. Ninguna de las dos partes puede tumbar nada ni hacer que Zernio
 * reintente (un reintento sobre un lead ya creado no repite nada, pero tampoco arregla lo que falló acá): cada una atrapa su error.
 * La conversión primero y SIEMPRE que entre en la ventana; lo inmediato sólo con un lead nuevo.
 */
export async function alNacerLeadDeZernio(ws: number, c: LeadCargado, l: LeadDeZernio): Promise<void> {
  if (c.conversion) await conversionDelLead(ws, c, l);
  if (!c.nuevo) return;
  try {
    await alNacerLeadDeMeta(ws, { id: c.leadId, nombre: c.nombre, telefono: c.telefono }, {
      fieldData: l.fieldData.length ? l.fieldData : null, campana: null,
    });
  } catch (e) {
    // `alNacerLeadDeMeta` ya atrapa cada parte; esto es por si falla su carga.
    console.error(`[zernio-leads] lo inmediato (ws ${ws}, lead ${c.leadId}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function conversionDelLead(ws: number, c: LeadCargado, l: LeadDeZernio): Promise<void> {
  try {
    const capi = await sendMetaCAPIEvent({
      eventName: 'Lead',
      email: c.email,
      phone: c.telefono,
      metaLeadId: l.leadgenId,
      eventTime: l.creadoEn,
      eventId: eventIdLeadCrudo(l.leadgenId),
      customData: { lead_type: 'formulario_meta' },
    });
    if (!capi.ok && (capi.motivo === 'rechazado' || capi.motivo === 'http' || capi.motivo === 'red')) {
      // Lo que Meta rechaza va donde el dueño lo lee, no sólo al log.
      await logLeadEvent(c.leadId, 'Meta', `No entró la conversión Lead: ${capi.detalle}`.slice(0, 300), 'MaKo');
    }
  } catch (e) {
    console.error(`[zernio-leads] CAPI (ws ${ws}, lead ${c.leadId}): ${e instanceof Error ? e.message : String(e)}`);
  }
}
