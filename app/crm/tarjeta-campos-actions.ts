'use server';

// =============================================================================
// Qué muestra la tarjeta de un lead, a elección de cada persona (20/10/2026)
// =============================================================================
// El porqué (por persona y no por funnel) está en lib/tarjeta-kanban.ts → CAMPOS_TARJETA_LEAD. Acá sólo la puerta:
// quien no tiene acceso al negocio no guarda nada, y lo que llega se limpia contra el catálogo (setCamposTarjetaCrm).
// =============================================================================

import { exigirSesion } from '@/lib/sesion-accion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { setCamposTarjetaCrm } from '@/lib/perfil';
import type { CampoTarjetaLead, DisenoTarjeta } from '@/lib/tarjeta-kanban';

export async function guardarCamposTarjetaAction(campos: string[], diseno?: string): Promise<{ ok: true; campos: CampoTarjetaLead[]; diseno: DisenoTarjeta; guardado: boolean } | { ok: false; error: string }> {
  await exigirSesion();
  try {
    if (!(await getRolWsEfectivo())) return { ok: false, error: 'No tienes acceso a este CRM.' };
    const r = await setCamposTarjetaCrm(campos, diseno);
    return { ok: true, ...r };
  } catch (e) {
    console.error('[crm] guardar campos de la tarjeta:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude guardarlo.' };
  }
}
