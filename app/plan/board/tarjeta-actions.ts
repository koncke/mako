'use server';

// =============================================================================
// Cómo se ve la tarjeta de una tarea del Plan, a elección de cada persona (21/10/2026)
// =============================================================================
// Martín: «la personalización de las tarjetas en clientes, plan, etc.». El molde es el del CRM
// (app/crm/tarjeta-campos-actions.ts); el porqué de «por persona», en lib/tarjeta-plan.ts. Acá sólo la puerta: quien no
// tiene acceso al negocio no guarda nada, y lo que llega se limpia contra el catálogo (`setTarjetaPlan`).
// =============================================================================

import { exigirSesion } from '@/lib/sesion-accion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { setTarjetaPlan } from '@/lib/perfil';
import type { CampoTarjetaPlan, FormaTarjetaPlan, PlantillaTarjetaPlan } from '@/lib/tarjeta-plan';

/** `plantillas` ausente = se quedan las propias que tenía (elegir una o sacar un dato no las toca). */
export async function guardarTarjetaPlanAction(campos: string[], forma?: string, plantillas?: unknown[]): Promise<{ ok: true; campos: CampoTarjetaPlan[]; forma: FormaTarjetaPlan; plantillas: PlantillaTarjetaPlan[]; guardado: boolean } | { ok: false; error: string }> {
  await exigirSesion();
  try {
    if (!(await getRolWsEfectivo())) return { ok: false, error: 'No tienes acceso a este Plan.' };
    const r = await setTarjetaPlan(campos, forma, plantillas);
    return { ok: true, ...r };
  } catch (e) {
    console.error('[plan] guardar la tarjeta:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude guardarlo.' };
  }
}
