'use server';

// =============================================================================
// Server action — búsqueda automática de datos de reuniones (wizard "Automático")
// =============================================================================

import { getLead } from '@/lib/leads';
import { buscarReunionesAutomatico, type AutoReuniones } from '@/lib/auto-reuniones';

export async function autoReunionesAction(leadId: number): Promise<AutoReuniones | { error: string }> {
  try {
    if (!Number.isFinite(leadId) || leadId <= 0) return { error: 'Lead inválido.' };
    const lead = await getLead(leadId);
    if (!lead) return { error: 'El lead no existe.' };
    return await buscarReunionesAutomatico(lead);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
