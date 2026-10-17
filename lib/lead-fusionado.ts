// =============================================================================
// lead-fusionado — los datos de un contacto que entró y MaKo sumó a un lead que ya estaba (puro, con test)
// =============================================================================
// «Nada por detrás», lote 2 (docs/inventario-nada-por-detras.md, 17/10/2026): el aviso «Entró un contacto por Meta y lo
// sumé a…» (`lead-fusionado`) lo mandaba lib/leads.ts (`avisarFusion`) con su texto escrito en el código, y su freno
// estaba al revés: 60 minutos SIN clave, así que la fusión de OTRO lead dentro de esa hora no se avisaba. Pasa a ser una
// automatización de la plataforma (el evento `lead_fusionado`) con el texto literal en su fila, y el freno es por LEAD.

export type CanalFusion = 'Meta' | 'Calendly' | 'Cal.com';

/** Los datos por nombre: «{{fusion_canal}}», «{{fusion_porque}}» y «{{fusion_link}}» (lib/variables-aviso.ts). */
export function datosFusion(input: { canal: CanalFusion; porQue: string; link: string }): { fusion_canal: string; fusion_porque: string; fusion_link: string } {
  return { fusion_canal: input.canal, fusion_porque: input.porQue, fusion_link: input.link };
}

/**
 * LA CLAVE DEL FRENO: el lead que se fundió. Una reentrega del mismo webhook no avisa dos veces; la fusión de otro lead
 * en la misma hora, sí (era lo que se perdía: el aviso es lo único que hace visible un match equivocado).
 */
export const claveFusion = (leadId: number): string => `fusion:${leadId}`;

/** Cuánto vale el freno: una hora, como antes. */
export const DEDUP_FUSION_MIN = 60;
