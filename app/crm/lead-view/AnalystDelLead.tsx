'use client';

// =============================================================================
// AnalystDelLead — la pestaña «MaKo Analyst» de la ficha del lead (pop-up y ruta)
// =============================================================================
// Pedido de Martín (12/10/2026, punto 19): «Cambia el nombre de la tab "Análisis" por "MaKo
// Analyst" y replica el chat que tenemos en la tab de "Offer", basicamente que sea un chat con la
// IA que por defecto tenga atado los datos de ese lead, para eso tenemos una API de todo».
//
// Arriba, el CHAT (app/crm/lead-view/MakoAnalystLead.tsx: lo construye otra pieza, con el turno de
// MaKo de la app y la API de MaKo; acá sólo se le da el alto, porque «ocupa el alto que le den»).
// Debajo, PLEGADO y sólo si hay algo, lo que la pestaña mostraba hasta hoy: la lectura de MaKo
// sobre las llamadas analizadas (`GeneratedInsightCard`). No se borró: es otro dato —lo que se
// sacó de las llamadas— y quien ya lo generó lo tiene que poder volver a leer. Plegado, porque lo
// que la pestaña ES ahora es el chat.
//
// ⚠️ UNA PIEZA PARA LAS DOS PUERTAS (app/crm/LeadSheet.tsx y app/crm/[id]/page.tsx): la ficha del
// lead tiene dos implementaciones y lo que cambia en una tiene que cambiar en la otra.
// =============================================================================

import type { Lead } from '@/lib/leads';
import type { Stage } from '@/lib/pipeline';
import type { Step } from '@/lib/stage-requirements';
import type { LeadInsightGen } from '@/lib/lead-insights';
import { MakoAnalystLead } from './MakoAnalystLead';
import { GeneratedInsightCard, type LlamadaRef } from './GeneratedInsightCard';

export function AnalystDelLead({ lead, stages, tienePlan, inicial, faltantesIniciales, llamadas, alto }: {
  lead: Lead;
  stages: Stage[];
  tienePlan: boolean;
  /** El último análisis generado, o `null`. */
  inicial: LeadInsightGen | null;
  faltantesIniciales: Step[];
  /** Las llamadas analizadas (Closing Analyst): sin ninguna, el análisis no se puede generar. */
  llamadas: LlamadaRef[];
  /** El alto que se le da al chat: cada puerta sabe cuánto le queda visible. */
  alto: string;
}) {
  // «Sólo si hay algo»: un análisis ya generado, o al menos una llamada analizada (que es lo que
  // habilita generarlo). Sin ninguna de las dos, la tarjeta sólo decía que no había nada.
  const hayAnalisis = !!inicial || llamadas.length > 0;
  return (
    <>
      <div style={{ height: alto, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <MakoAnalystLead leadId={lead.id} nombre={lead.nombre} />
      </div>
      {hayAnalisis && (
        <details style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--dim)', padding: '2px 0' }}>
            Análisis de llamadas{llamadas.length > 0 ? ` (${llamadas.length})` : ''}
          </summary>
          <div style={{ marginTop: 14 }}>
            <GeneratedInsightCard
              lead={lead}
              stages={stages}
              tienePlan={tienePlan}
              inicial={inicial}
              faltantesIniciales={faltantesIniciales}
              llamadas={llamadas}
            />
          </div>
        </details>
      )}
    </>
  );
}
