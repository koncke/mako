// =============================================================================
// La cabecera de la ficha en el PANEL del tablero: sus reglas, sin React ni server
// =============================================================================
// La dibujan CabeceraLead (con `panel`) y el esqueleto de LeadEditModal mientras la ficha carga; el test
// (tests/crm-ficha-panel.test.ts) las lee sin montar nada. Es la cabecera de la grabación del CRM de la portada que le
// gustó a Martín (14/11/2026): la cara en un círculo, el nombre y «empresa · canal».
// Sin 'use client' ni 'use server': son datos, los importa cualquiera.
// =============================================================================

import type { Lead } from '@/lib/leads';
import { canalDeLead, SIN_ORIGEN_LISTA } from '../origen-lead';

/** La cara del lead en el panel (px), la de la grabación. */
export const TAM_CARA_PANEL = 48;

/** «empresa · canal», lo que dice el panel debajo del nombre. Sin ninguno de los dos, el número del lead. */
export function bajadaDelPanel(lead: Pick<Lead, 'id' | 'empresa' | 'origen_lead' | 'meta_lead_id'>): string {
  const canal = canalDeLead(lead);
  return [lead.empresa?.trim(), canal === SIN_ORIGEN_LISTA ? null : canal].filter(Boolean).join(' · ') || `Lead #${lead.id}`;
}
