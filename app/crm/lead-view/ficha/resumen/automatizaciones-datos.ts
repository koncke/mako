// =============================================================================
// ficha/resumen/automatizaciones-datos — de dónde lee y qué hace el bloque «Automatizaciones» (23/10/2026)
// =============================================================================
// El bloque es del CRM; los datos y las acciones son de Automations (app/automations/automatizaciones-del-lead-actions.ts,
// lib/automatizaciones-del-lead*.ts). Este archivo es la única puerta entre los dos: la pantalla no importa las actions
// de Automations directo, así un cambio de su contrato se arregla ACÁ y el bloque no se toca.
//
// Lee el DETALLE de Automations (`automatizacionesDelLeadDetalleAction`, 23/10/2026: vivas y terminadas de 30 días, lo
// enviado, lo que no entró y si se puede empezar de nuevo) y lo pasa a la vista (`vistaDeDetalle`). El contrato está en
// docs/relevo/crm.md, §0-Ω22.
// =============================================================================

import {
  automatizacionesDelLeadDetalleAction, empezarDeNuevoEnAutomatizacionAction, frenarEnAutomatizacionAction,
} from '@/app/automations/automatizaciones-del-lead-actions';
import { vistaDeDetalle, type AutomatizacionesVista } from '@/app/crm/automatizacion-lead';

type Resultado = { ok: true; resumen: string } | { ok: false; error: string };

/** Lo que el bloque dibuja de este lead. null = no se pudo leer (no es «ninguna»). */
export async function leerAutomatizacionesDelBloque(leadId: number): Promise<AutomatizacionesVista | null> {
  const r = await automatizacionesDelLeadDetalleAction(leadId);
  return r ? vistaDeDetalle(r) : null;
}

/** Lo saca de UNA automatización: no le sale nada más. Sólo el admin (lo corta la action). */
export function frenarDelBloque(leadId: number, secuenciaId: number): Promise<Resultado> {
  return frenarEnAutomatizacionAction(leadId, secuenciaId);
}

/** Vuelve a correr UNA automatización desde el primer paso (la regla de `reactivarInscripcion`). Sólo el admin. */
export function empezarDeNuevoDelBloque(leadId: number, secuenciaId: number): Promise<Resultado> {
  return empezarDeNuevoEnAutomatizacionAction(leadId, secuenciaId);
}
