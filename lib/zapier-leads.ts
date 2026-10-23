// =============================================================================
// zapier-leads — lo que hace MaKo con un lead de Meta que llegó por Zapier o Make
// =============================================================================
// El puente de leads (23/10/2026). El lector (lib/zapier-lead.ts) traduce el cuerpo del Zap; esto lo entrega a las
// MISMAS tres cosas que el webhook de Meta (app/api/webhooks/meta-leads) hace con un lead que nace:
//   1. `upsertLeadFromMeta` — la ÚNICA puerta de un lead de formulario: origen `instant_form`, dedup por
//      `meta_lead_id` y después por teléfono o email, producto según la campaña, respuestas crudas;
//   2. la conversión `Lead` a Meta (CAPI), con el MISMO `event_id` que usaría el webhook: si después el lead entra
//      por Meta, Meta junta los dos eventos en uno;
//   3. «lo inmediato» de un lead nuevo (`alNacerLeadDeMeta`, lib/meta-lead-nuevo.ts): el aviso, los flujos y las
//      automatizaciones. Es lo que hace que el lead no sea una fila muda en el CRM.
//
// ⚠️ 2 Y 3 SÓLO CON UN LEAD NUEVO Y RECIENTE (`esNuevoParaElNegocio`, 24 h): el paso «Probar» de Zapier manda los
// últimos leads de la página, y un lead de hace una semana que Zapier acaba de traer no es «un lead nuevo»: se carga
// callado, como el rescate del poll. Sin fecha del formulario se trata como recién llegado —un Zap vivo dispara en
// segundos—, porque callarlo dejaría a un lead real sin que nadie le escriba.
//
// Corre adentro de `runWithWorkspace(ws)`: lo llama el webhook DESPUÉS de saber de quién es.

import 'server-only';
import { upsertLeadFromMeta, logLeadEvent } from './leads';
import { sendMetaCAPIEvent } from './meta-capi';
import { eventIdLeadCrudo } from './meta-capi-payload';
import { esNuevoParaElNegocio } from './meta-leads-poll-reglas';
import { alNacerLeadDeMeta } from './meta-lead-nuevo';
import { idDeLeadParaElUpsert, type LeadDeZapier } from './zapier-lead';

export type ResultadoZapier = { estado: 'creado' | 'actualizado'; leadId: number; anunciado: boolean };

export async function ingresarLeadDeZapier(ws: number, l: LeadDeZapier, ahora: Date = new Date()): Promise<ResultadoZapier> {
  const metaLeadId = idDeLeadParaElUpsert(ws, l, ahora);
  const { created, lead } = await upsertLeadFromMeta({
    email: l.email,
    nombre: l.nombre,
    telefono: l.telefono,
    empresa: l.empresa,
    meta_lead_id: metaLeadId,
    meta_ad_id: l.anuncioId,
    meta_ad_name: l.anuncioNombre,
    meta_campaign_name: l.campanaNombre,
    meta_adset_name: l.conjuntoNombre,
    meta_campaign_id: l.campanaId,
    meta_adset_id: l.conjuntoId,
    meta_field_data: l.fieldData.length ? l.fieldData : null,
    meta_created_at: l.creadoEn,
    meta_campos_no_reconocidos: l.noReconocidos,
  });

  const nuevo = created && esNuevoParaElNegocio(l.creadoEn ?? ahora.toISOString(), ahora.getTime());
  if (!nuevo) return { estado: created ? 'creado' : 'actualizado', leadId: lead.id, anunciado: false };

  // Lo que sigue es del lead que YA existe: ninguna de las dos partes puede tirar el alta ni hacer que Zapier
  // reintente (un reintento sobre un lead ya creado no repite nada, pero tampoco arregla lo que falló acá).
  try {
    const capi = await sendMetaCAPIEvent({
      eventName: 'Lead',
      email: lead.email,
      phone: lead.telefono,
      // El id propio (`zap:…`) NO es un leadgen_id: `leadIdDeMeta` lo descartaría con un aviso, y Meta rechaza
      // el evento entero ante un lead_id inválido. Sin id real viaja por email y teléfono.
      metaLeadId: l.leadgenId,
      eventTime: l.creadoEn,
      eventId: eventIdLeadCrudo(metaLeadId),
      customData: { lead_type: 'formulario_meta' },
    });
    if (!capi.ok && (capi.motivo === 'rechazado' || capi.motivo === 'http' || capi.motivo === 'red')) {
      await logLeadEvent(lead.id, 'Meta', `No entró la conversión Lead: ${capi.detalle}`.slice(0, 300), 'MaKo');
    }
  } catch (e) {
    console.error(`[zapier-leads] CAPI (ws ${ws}, lead ${lead.id}): ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    await alNacerLeadDeMeta(ws, { id: lead.id, nombre: lead.nombre, telefono: lead.telefono }, {
      fieldData: l.fieldData.length ? l.fieldData : null, campana: l.campanaNombre,
    });
  } catch (e) {
    // `alNacerLeadDeMeta` ya atrapa cada parte; esto es por si falla su carga.
    console.error(`[zapier-leads] lo inmediato (ws ${ws}, lead ${lead.id}): ${e instanceof Error ? e.message : String(e)}`);
  }
  return { estado: 'creado', leadId: lead.id, anunciado: true };
}
