import 'server-only';

// =============================================================================
// compra-plan-llamada — quien pagó su plan de MaKo queda en la lista de llamadas (30/10/2026)
// =============================================================================
// docs/estrategia-lanzamiento-low-to-high.md: anuncios → landing → COMPRA MaKo → Martín lo contacta → llamada → high ticket de
// US$1.500. «Quien pagó está cualificado. Ese es el filtro.» El checkout ya dejaba el lead (lib/compra-plan.ts) y pagar lo pasa a Ganado
// en su CRM, que es lo correcto para esa venta; pero ahí no hay de dónde llamar: Ganado es el final, y esto es el principio del otro.
//
// Se AGREGA al CRM de llamadas, en su primera etapa (`agregarAProducto`, la regla de la casa: «No se debe "Mover" se debe agregar al
// otro producto»). Agregar no dispara ninguna automatización. Qué CRM es lo dice un setting de la plataforma, no el código: sin el
// setting no pasa nada. Sólo en el primer pago: una renovación no vuelve a pedir la llamada, y una prueba gratis no pasa por acá.
//
// ⚠️ NUNCA TIRA: la plata ya entró y la cuenta ya se dio de alta. Lo que no se pudo queda en el historial del lead.
// =============================================================================

import { getSetting } from './settings';
import { enriquecerLead, getLead, logLeadEvent, normalizarTelefono } from './leads';
import { agregarAProducto } from './lead-funnel';
import { getTenantDb, runWithWorkspace, wsSuperAdmin } from './workspace';

export const CLAVE_CRM_LLAMADAS = 'planes.crm_llamadas';

export function crmDeLlamadasDe(crudo: string | null | undefined): number | null {
  const n = Number(crudo);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * EL WHATSAPP DE QUIEN YA ENTRÓ, A SU LEAD (30/10/2026). El checkout lo pide desde el 31/10, sin obligar: quien no lo dejó ahí lo da al entrar, y el
 * número del dueño de la cuenta (`guardarNumeroDueno`, lib/mako-grupo.ts) es el mismo por el que se lo llama. Sólo llena un teléfono
 * vacío (`enriquecerLead`: lo cargado gana) y sólo si hay UN lead de esa cuenta. Es otro negocio: corre con el ws de la plataforma. Nunca tira.
 *
 * ⚠️ LO ÚNICO QUE SE REEMPLAZA ES LO QUE ESCRIBIÓ EN EL CHECKOUT (31/10/2026): un dígito mal en un formulario público llenaba la ficha, y el
 * número que WhatsApp sí reconoce ya no entraba, sin rastro. Por esa ficha se lo llama. Si alguien lo cambió a mano, ya no es el del
 * checkout y gana lo cargado.
 */
export async function anotarTelefonoDelComprador(cuentaWs: number, numero: string): Promise<void> {
  try {
    const plataforma = await wsSuperAdmin();
    if (cuentaWs === plataforma) return;
    await runWithWorkspace(plataforma, async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('leads').select('id').eq('cliente_ws', cuentaWs).limit(2);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as Array<{ id: number }>;
      if (filas.length !== 1) return;
      const id = filas[0].id;
      const digitos = numero.replace(/\D/g, '');
      if ((await enriquecerLead(id, { telefono: `+${digitos}` }, 'Cuenta de MaKo')).length) return;
      const hoy = normalizarTelefono((await getLead(id))?.telefono_normalizado);
      if (!hoy || hoy === digitos) return;
      const { data: compras, error: e2 } = await db.from('cobros').select('origen').eq('alta_ws', cuentaWs).limit(20);
      if (e2) throw new Error(e2.message);
      if (!((compras ?? []) as Array<{ origen?: { whatsapp?: unknown } | null }>).some((c) => c.origen?.whatsapp === hoy)) return;
      const { error: e3 } = await db.from('leads').update({ telefono: `+${digitos}`, telefono_normalizado: digitos }).eq('id', id);
      if (e3) throw new Error(e3.message);
      await logLeadEvent(id, 'WhatsApp', `Su WhatsApp es +${digitos}: reemplaza al que escribió en el checkout, +${hoy}.`, 'Cuenta de MaKo');
    });
  } catch (e) {
    console.error(`[compra-plan] no pude anotar el teléfono de la cuenta ${cuentaWs}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Corre adentro de `runWithWorkspace` de la plataforma, como `aplicarPagoAprobado`. */
export async function anotarParaLlamar(c: { workspace_id: number; lead_id: number | null; alta_capa: string | null }): Promise<void> {
  if (!c.lead_id || !c.alta_capa) return;
  try {
    if (c.workspace_id !== await wsSuperAdmin()) return;
    const crm = crmDeLlamadasDe(await getSetting(CLAVE_CRM_LLAMADAS));
    if (crm == null) return;
    await agregarAProducto(c.lead_id, crm, { autor: 'Checkout de MaKo' });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error(`[compra-plan] no pude anotar para llamar al lead ${c.lead_id}: ${m}`);
    await logLeadEvent(c.lead_id, 'Funnel', `Pagó y no pude sumarlo a la lista de llamadas: ${m}`.slice(0, 300), 'Checkout de MaKo').catch(() => {});
  }
}
