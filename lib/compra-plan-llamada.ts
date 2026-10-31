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
import { enriquecerLead, logLeadEvent } from './leads';
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
      if (filas.length === 1) await enriquecerLead(filas[0].id, { telefono: `+${numero.replace(/\D/g, '')}` }, 'Cuenta de MaKo');
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
