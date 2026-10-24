// =============================================================================
// ficha/resumen/automatizaciones-datos — de dónde lee y qué hace el bloque «Automatizaciones» (23/10/2026)
// =============================================================================
// El bloque es del CRM; los datos y las acciones son de Automations (app/automations/automatizaciones-del-lead-actions.ts,
// lib/automatizaciones-del-lead*.ts). Este archivo es la única puerta entre los dos: la pantalla no importa las actions
// de Automations directo, así el día que llega el detalle (lo enviado, las terminadas, lo que no entró, «Empezar de
// nuevo») se cambia ACÁ y el bloque no se toca.
//
// HOY lee la lista de siempre (`automatizacionesDelLeadAction`: las vivas con su paso y lo que las frena) y la pasa a la
// vista (`vistaDeEnAutomatizacion`); «Empezar de nuevo» no se ofrece (`puede.empezarDeNuevo: false`) hasta que
// Automations pase `empezarDeNuevoAction` (el contrato está en docs/relevo/crm.md, §0-Ω22).
// =============================================================================

import { automatizacionesDelLeadAction, frenarEnAutomatizacionAction } from '@/app/automations/automatizaciones-del-lead-actions';
import { vistaDeEnAutomatizacion, type AutomatizacionesVista } from '@/app/crm/automatizacion-lead';

type Resultado = { ok: true; resumen: string } | { ok: false; error: string };

/** Lo que el bloque dibuja de este lead. null = no se pudo leer (no es «ninguna»). */
export async function leerAutomatizacionesDelBloque(leadId: number): Promise<AutomatizacionesVista | null> {
  const r = await automatizacionesDelLeadAction(leadId);
  return r ? vistaDeEnAutomatizacion(r) : null;
}

/** Lo saca de UNA automatización: no le sale nada más. Sólo el admin (lo corta la action). */
export function frenarDelBloque(leadId: number, secuenciaId: number): Promise<Resultado> {
  return frenarEnAutomatizacionAction(leadId, secuenciaId);
}

/** Vuelve a correr UNA automatización desde el primer paso. Hasta que Automations pase su acción, no se ofrece. */
export async function empezarDeNuevoDelBloque(_leadId: number, _secuenciaId: number): Promise<Resultado> {
  return { ok: false, error: 'Empezar de nuevo todavía no está disponible desde la ficha.' };
}
