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
//
// ⚠️ Y SE RECLAMA ANTES DE ANUNCIAR (F117, 18/11/2026). Si la puerta que lo creó se cae después del insert, el reintento
// lo encuentra (`created: false`) y antes nadie lo anunciaba nunca. Ahora el anuncio deja su MARCA en el historial
// (lib/meta-anuncio.ts) ANTES de mandar nada, y un reintento sin marca lo anuncia (`esReintento`). Dos puertas a la vez
// anuncian una vez: gana la marca más vieja. Un reintento que no pudo marcar no anuncia; la puerta que lo creó, sí.
// =============================================================================

import 'server-only';
import type { MetaFieldData } from './meta-leads-campos';
import { datosFormularioMeta } from './meta-form-aviso';
import { emitirDelCatalogo } from './avisos';
import { dispararEvento } from './flujos';
import { enrolarPorEvento } from './nutricion';
import { marcarAnunciado, reclamarAnuncio } from './meta-anuncio';

export type LeadNacidoDeMeta = { id: number; nombre: string; telefono?: string | null };

export async function alNacerLeadDeMeta(
  ws: number,
  lead: LeadNacidoDeMeta,
  form: { fieldData?: MetaFieldData | null; campana?: string | null },
  opc: { esReintento?: boolean } = {},
): Promise<void> {
  const reclamo = await reclamarAnuncio(ws, lead.id);
  if (reclamo === false) return; // otra puerta lo anuncia
  if (reclamo === null && opc.esReintento) return; // un reintento sin su marca no anuncia: sería el segundo aviso
  const parte = async (que: string, f: () => Promise<unknown>) => {
    try { await f(); } catch (e) { console.error(`[meta-lead-nuevo] ${que} (ws ${ws}, lead ${lead.id}): ${e instanceof Error ? e.message : String(e)}`); }
  };
  // ⚠️ VAN LOS DATOS, NO EL TEXTO. Desde el 17/10/2026 el texto es el de su automatización de SuperAdmin (evento
  // `lead_formulario_meta`, «nada por detrás», lote 3; nace PAUSADA, como nacía apagado). Del lead salen su nombre y el
  // link a su ficha; esto es lo que trae el formulario, y lo que falta no viaja: su renglón no va (antes se tapaba con
  // «sin teléfono» y «Sin preguntas extra», frases del código).
  await parte('aviso', () => emitirDelCatalogo('lead-formulario-meta', {
    ws,
    lead: { id: lead.id, nombre: lead.nombre },
    datos: datosFormularioMeta({ telefono: lead.telefono, campana: form.campana, fieldData: form.fieldData }),
  }));
  // Los flujos configurados por el dueño.
  // Con su `dedupKey`: una segunda entrega del mismo lead no vuelve a correr el flujo (AGENTS.md, «un evento que el
  // proveedor puede REENTREGAR»).
  await parte('flujos', () => dispararEvento('lead.form_meta', { ws, leadId: lead.id, leadNombre: lead.nombre, dedupKey: `meta-lead:${lead.id}` }));
  // Las automatizaciones, YA (reunión 31/07: al que llena el formulario se le escribe casi al instante, no en la próxima
  // corrida del cron). Desde el 17/10 también las de la etapa en la que nace («Lead entrante»): lib/nutricion.ts.
  await parte('automatizaciones', () => enrolarPorEvento(lead.id, 'lead_nuevo'));
  // La puerta que lo creó y no pudo marcarlo antes lo intenta otra vez: sin la marca, un reintento lo volvería a anunciar.
  if (reclamo === null) await marcarAnunciado(ws, lead.id);
}
