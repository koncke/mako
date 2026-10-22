// =============================================================================
// STUB: las acciones de Automations para «está en una automatización» y «Frenar» (22/10/2026)
// =============================================================================
// Las de verdad son de Automations, con ESTAS firmas: app/automations/automatizaciones-del-lead-actions.ts ('use server')
// y el tipo en lib/automatizaciones-del-lead-reglas.ts (905c908a2, rama aut-prospeccion). La pantalla del CRM se dibuja
// contra éstas hasta que lleguen a main.
// ⚠️ AL INTEGRAR: los imports de app/crm/automatizacion-lead.ts, CrmBoard.tsx, AccionesLoteLeads.tsx y el bloque de la
//    ficha pasan a esos dos archivos, y éste se borra. Con el stub nadie aparece en una automatización y «Frenar» dice que
//    todavía no está: así NO sube a producción.
// =============================================================================

export type EnAutomatizacion = {
  secuenciaId: number;
  nombre: string;
  /** false = la automatización está PAUSADA: el lead quedó congelado en su paso y no le sale nada hasta que se active. */
  automatizacionActiva: boolean;
  estado: 'activa' | 'respondio';
  /** La tarjeta en la que está, como la nombra el lienzo («WHATSAPP: Hola {{nombre}}, soy…»). null = no se pudo ubicar. */
  paso: { numero: number; titulo: string } | null;
  proximoEnvioAt: string | null;
  link: string;
};

export async function enAutomatizacionesAction(leadIds: number[]): Promise<Record<number, EnAutomatizacion[]> | null> {
  void leadIds;
  return {};
}

export async function automatizacionesDelLeadAction(leadId: number): Promise<EnAutomatizacion[] | null> {
  void leadId;
  return [];
}

export async function frenarEnAutomatizacionAction(leadId: number, secuenciaId: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  void leadId; void secuenciaId;
  return { ok: false, error: 'Frenar todavía no está listo.' };
}

export async function frenarLeadsEnAutomatizacionesAction(leadIds: number[], secuenciaId?: number): Promise<
  { ok: true; frenados: number; yaHabianSalido: number; resumen: string } | { ok: false; error: string }
> {
  void leadIds; void secuenciaId;
  return { ok: false, error: 'Frenar todavía no está listo.' };
}
