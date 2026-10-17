// =============================================================================
// meta-lead-nuevo — lo que pasa cuando NACE un lead de un formulario de Meta, entre por donde entre
// =============================================================================
// Tarjeta #868 (17/10/2026, la revisión del 16/10 con Joan, Código Inmobiliario): «la Brigitte sería la parte de las
// automatizaciones, esa es como la más prioritaria». Sus automatizaciones no respondían a los leads que entraban.
//
// ⚠️ EL DIAGNÓSTICO OBVIO («la automatización está mal armada») ERA LA MITAD. Lo de fondo: un lead de Meta entra por
// DOS puertas —el webhook y el poll de cada 10 minutos (lib/meta-leads.ts)— y sólo el webhook hacía lo inmediato: el
// aviso «lead-formulario-meta», los flujos (`lead.form_meta`) y la inscripción en las automatizaciones (`lead_nuevo`).
// El poll sólo cargaba el lead, suponiendo que lo otro ya lo había hecho el webhook. Pero la página de Brigitte (ws15)
// no está suscripta a la app (`subscribed_apps` = [], docs/hallazgos-ads.md), así que el webhook no llega NUNCA: desde
// el 08/10 sus leads entraban al CRM cada 10 minutos sin disparar nada. Medido el 17/10: 16 leads en 14 días, cero
// inscripciones en toda la historia del ws15.
//
// Por eso esto vive en UN lugar y lo llaman las dos puertas, sólo con un INSERT (`created`): `upsertLeadFromMeta`
// deduplica por `meta_lead_id`, así que la puerta que lo crea es la única que lo anuncia. El poll además sólo con un
// lead reciente (`esNuevoParaElNegocio`, lib/meta-leads-poll-reglas.ts): un rescate de 60 días no es «un lead nuevo».
//
// Best-effort y por partes: una que falla no se lleva a las otras ni tumba al que la llama (un webhook que no contesta
// 200 hace que Meta reenvíe el batch; un poll que tira corta los formularios que faltaban).
// =============================================================================

import 'server-only';
import { resumenRespuestas, type MetaFieldData } from './meta-leads-campos';
import { emitirDelCatalogo } from './avisos';
import { dispararEvento } from './flujos';
import { enrolarPorEvento } from './nutricion';

export type LeadNacidoDeMeta = { id: number; nombre: string; telefono?: string | null };

export async function alNacerLeadDeMeta(
  ws: number,
  lead: LeadNacidoDeMeta,
  form: { fieldData?: MetaFieldData | null; campana?: string | null },
): Promise<void> {
  const parte = async (que: string, f: () => Promise<unknown>) => {
    try { await f(); } catch (e) { console.error(`[meta-lead-nuevo] ${que} (ws ${ws}, lead ${lead.id}): ${e instanceof Error ? e.message : String(e)}`); }
  };
  // ⚠️ VAN LOS DATOS, NO EL TEXTO. Con `texto` armado acá, lo que el negocio escribiera en /automations no salía nunca:
  // el texto es el de la plantilla (lib/avisos-catalogo.ts, que nace APAGADA) y esto le pone los valores. Los que ya
  // están en la mano van en `datos`, que ganan sobre la lectura de la ficha. Y los dos que pueden faltar se dicen: un
  // `{{lead_telefono}}` crudo en el WhatsApp de un cliente se lee como que el mensaje está roto.
  await parte('aviso', () => emitirDelCatalogo('lead-formulario-meta', {
    ws,
    lead: { id: lead.id, nombre: lead.nombre },
    datos: {
      lead_telefono: lead.telefono?.trim() || 'sin teléfono',
      lead_formulario: resumenRespuestas(form.fieldData ?? null) ?? 'Sin preguntas extra en el formulario.',
      ...(form.campana ? { lead_campana: form.campana } : {}),
    },
  }));
  // Los flujos configurados por el dueño.
  await parte('flujos', () => dispararEvento('lead.form_meta', { ws, leadId: lead.id, leadNombre: lead.nombre }));
  // Las automatizaciones, YA (reunión 31/07: al que llena el formulario se le escribe casi al instante, no en la próxima
  // corrida del cron). Desde el 17/10 también las de la etapa en la que nace («Lead entrante»): lib/nutricion.ts.
  await parte('automatizaciones', () => enrolarPorEvento(lead.id, 'lead_nuevo'));
}
